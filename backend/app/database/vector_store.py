"""
Vector Storage and Similarity Computation Service.
Provides high-performance vector search supporting both PostgreSQL + pgvector
and a zero-dependency in-memory/NumPy cosine similarity engine.
"""
import json
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database.models import DocumentChunk, IndexedFile, Device

settings = get_settings()


class VectorStoreService:
    def __init__(self):
        self.use_pgvector = settings.USE_PGVECTOR and settings.DATABASE_URL.startswith("postgresql")

    @staticmethod
    def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
        """Calculate cosine similarity between two 1D vectors."""
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))

    async def search_similar_chunks(
        self,
        session: AsyncSession,
        user_id: str,
        query_vector: List[float],
        top_k: int = 20,
        device_ids: Optional[List[str]] = None,
        file_types: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Query for the top-k most similar document chunks for the authenticated user.
        Always filters strictly by user_id to preserve absolute multi-tenant privacy.
        """
        query_np = np.array(query_vector, dtype=np.float32)

        # Base query joined with file and device
        stmt = (
            select(DocumentChunk, IndexedFile, Device)
            .join(IndexedFile, DocumentChunk.file_id == IndexedFile.id)
            .join(Device, DocumentChunk.device_id == Device.id)
            .where(DocumentChunk.user_id == user_id)
        )

        if device_ids:
            stmt = stmt.where(DocumentChunk.device_id.in_(device_ids))
        if file_types:
            stmt = stmt.where(IndexedFile.extension.in_([ft.lower() for ft in file_types]))

        result = await session.execute(stmt)
        rows = result.all()

        scored_candidates: List[Tuple[float, DocumentChunk, IndexedFile, Device]] = []

        for chunk, file, device in rows:
            if not chunk.embedding_json:
                continue
            try:
                emb = np.array(json.loads(chunk.embedding_json), dtype=np.float32)
                sim = self.cosine_similarity(query_np, emb)
                scored_candidates.append((sim, chunk, file, device))
            except Exception:
                continue

        # Sort descending by similarity score
        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        top_candidates = scored_candidates[:top_k]

        formatted_results = []
        for sim, chunk, file, device in top_candidates:
            formatted_results.append({
                "chunk_id": chunk.id,
                "file_id": file.id,
                "filename": file.filename,
                "relative_path": file.relative_path,
                "extension": file.extension,
                "size_bytes": file.size_bytes,
                "file_modified_at": file.file_modified_at.isoformat() if file.file_modified_at else None,
                "device_id": device.id,
                "device_name": device.name,
                "device_platform": device.platform,
                "sync_status": file.sync_status,
                "matched_content": chunk.content,
                "chunk_index": chunk.chunk_index,
                "similarity_score": round(sim, 4),
            })

        return formatted_results


vector_store = VectorStoreService()
