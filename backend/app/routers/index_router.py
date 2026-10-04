"""
File Indexing and Content Synchronization Router for RECALL.
Processes incoming files, text extractions, chunking, and embedding generation.
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.database.models import User, Device, IndexedFile, DocumentChunk
from app.security.auth import get_current_user
from app.indexer.extractors import extract_content_from_file, compute_sha256
from app.indexer.chunker import chunk_text
from app.indexer.ocr import extract_ocr_from_image
from app.indexer.embeddings import generate_embedding, generate_embeddings_batch

router = APIRouter(prefix="/index", tags=["Indexing & Extraction"])


class ChunkInput(BaseModel):
    chunk_index: int
    content: str


class ClientIndexItem(BaseModel):
    device_id: str
    filename: str
    relative_path: str
    extension: str
    size_bytes: int
    content_hash: str
    file_modified_at: Optional[str] = None
    sync_status: str = "index_synced"
    extracted_text: Optional[str] = None
    chunks: Optional[List[ChunkInput]] = None


@router.post("/item")
async def index_client_item(
    item: ClientIndexItem,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Indexes a file representation sent by the client.
    Generates embeddings for chunks and persists them in the user's vector store.
    """
    dev_res = await db.execute(
        select(Device).where(Device.id == item.device_id, Device.user_id == current_user.id)
    )
    device = dev_res.scalar_one_or_none()
    if not device:
        device = Device(
            id=item.device_id,
            user_id=current_user.id,
            name="Current Client Device",
            platform="desktop",
            client_type="pwa",
            sync_enabled=True,
            last_seen_at=datetime.now(timezone.utc),
        )
        db.add(device)
        await db.flush()

    # Check if this exact file version already exists
    existing = await db.execute(
        select(IndexedFile).where(
            IndexedFile.user_id == current_user.id,
            IndexedFile.device_id == item.device_id,
            IndexedFile.relative_path == item.relative_path,
        )
    )
    db_file = existing.scalar_one_or_none()

    mod_dt = None
    if item.file_modified_at:
        try:
            mod_dt = datetime.fromisoformat(item.file_modified_at)
        except Exception:
            pass

    if db_file:
        if db_file.content_hash == item.content_hash:
            return {"message": "File unchanged. Index up to date.", "file_id": db_file.id}
        # Update existing record
        db_file.filename = item.filename
        db_file.extension = item.extension.lower()
        db_file.size_bytes = item.size_bytes
        db_file.content_hash = item.content_hash
        db_file.file_modified_at = mod_dt
        db_file.sync_status = item.sync_status
        # Delete old chunks
        await db.execute(delete(DocumentChunk).where(DocumentChunk.file_id == db_file.id))
    else:
        db_file = IndexedFile(
            user_id=current_user.id,
            device_id=device.id,
            filename=item.filename,
            relative_path=item.relative_path,
            extension=item.extension.lower(),
            size_bytes=item.size_bytes,
            content_hash=item.content_hash,
            file_modified_at=mod_dt,
            sync_status=item.sync_status,
        )
        db.add(db_file)
        device.files_indexed += 1
        if item.sync_status == "full_synced":
            device.files_synced += 1

    await db.flush()

    # Determine chunks to embed
    chunks_to_process = []
    if item.chunks:
        chunks_to_process = [{"index": c.chunk_index, "text": c.content} for c in item.chunks]
    elif item.extracted_text:
        text_chunks = chunk_text(item.extracted_text)
        chunks_to_process = [{"index": c["chunk_index"], "text": c["content"]} for c in text_chunks]

    chunk_texts = [c["text"] for c in chunks_to_process]
    if chunk_texts:
        # Offload batch embedding generation so it executes in a background thread
        vectors = await asyncio.to_thread(generate_embeddings_batch, chunk_texts)
        for c, vec in zip(chunks_to_process, vectors):
            chunk_obj = DocumentChunk(
                file_id=db_file.id,
                user_id=current_user.id,
                device_id=device.id,
                chunk_index=c["index"],
                content=c["text"],
                token_count=len(c["text"].split()),
                embedding_json=json.dumps(vec),
            )
            db.add(chunk_obj)

    await db.commit()
    await db.refresh(db_file)

    return {
        "message": f"Successfully indexed '{db_file.filename}'.",
        "file_id": db_file.id,
        "chunks_indexed": len(chunks_to_process)
    }


@router.post("/upload")
async def upload_and_index_file(
    device_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Accepts direct file upload (e.g. from mobile or upload zone), extracts content,
    performs OCR if image, chunks text, and generates embeddings.
    """
    dev_res = await db.execute(
        select(Device).where(Device.id == device_id, Device.user_id == current_user.id)
    )
    device = dev_res.scalar_one_or_none()
    if not device:
        device = Device(
            id=device_id,
            user_id=current_user.id,
            name="Current Client Device",
            platform="desktop",
            client_type="pwa",
            sync_enabled=True,
            last_seen_at=datetime.now(timezone.utc),
        )
        db.add(device)
        await db.flush()

    data = await file.read()
    content_hash = compute_sha256(data)

    # Fast hash check: Skip repeat indexing if unchanged
    existing = await db.execute(
        select(IndexedFile).where(
            IndexedFile.user_id == current_user.id,
            IndexedFile.device_id == device.id,
            IndexedFile.content_hash == content_hash,
        )
    )
    db_existing = existing.scalar_one_or_none()
    if db_existing:
        return {"message": f"File '{file.filename}' unchanged. Index up to date.", "file_id": db_existing.id, "chunks_indexed": 0}

    # Offload CPU extraction to thread pool
    extracted = await asyncio.to_thread(extract_content_from_file, file.filename, data)

    full_text = extracted.get("text", "")
    if extracted.get("is_image"):
        ocr_res = await asyncio.to_thread(extract_ocr_from_image, data)
        if ocr_res.get("text"):
            full_text = f"{full_text}\n{ocr_res['text']}".strip()

    item = ClientIndexItem(
        device_id=device.id,
        filename=file.filename,
        relative_path=file.filename,
        extension=extracted.get("extension", ""),
        size_bytes=len(data),
        content_hash=content_hash,
        extracted_text=full_text,
        sync_status="full_synced",
    )

    return await index_client_item(item, current_user, db)


@router.get("/files")
async def list_indexed_files(
    device_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all indexed files for the user with device metadata."""
    stmt = select(IndexedFile, Device).join(Device, IndexedFile.device_id == Device.id).where(IndexedFile.user_id == current_user.id)
    if device_id:
        stmt = stmt.where(IndexedFile.device_id == device_id)
    
    stmt = stmt.order_by(IndexedFile.updated_at.desc())
    res = await db.execute(stmt)
    rows = res.all()

    return [
        {
            "id": f.id,
            "filename": f.filename,
            "relative_path": f.relative_path,
            "extension": f.extension,
            "size_bytes": f.size_bytes,
            "file_modified_at": f.file_modified_at.isoformat() if f.file_modified_at else None,
            "content_hash": f.content_hash,
            "sync_status": f.sync_status,
            "device_id": d.id,
            "device_name": d.name,
            "device_platform": d.platform,
        }
        for f, d in rows
    ]


@router.delete("/files/{file_id}")
async def delete_indexed_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an indexed file representation and its vectors. Does NOT touch local file."""
    res = await db.execute(
        select(IndexedFile).where(IndexedFile.id == file_id, IndexedFile.user_id == current_user.id)
    )
    file_obj = res.scalar_one_or_none()
    if not file_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File index not found.")

    await db.delete(file_obj)
    await db.commit()

    return {"message": f"Index representation for '{file_obj.filename}' removed successfully."}
