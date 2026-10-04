"""
Vector Search Execution Pipeline for RECALL.
Coordinates Query Parsing, Embedding Generation, Vector Distance Computation,
and Multi-Factor Relevance Ranking.
"""
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.search.query_parser import parse_query, ParsedQuery
from app.search.ranker import rank_results, SearchResultItem
from app.indexer.embeddings import generate_embedding
from app.database.vector_store import vector_store


async def execute_search(
    session: AsyncSession,
    user_id: str,
    query_text: str,
    device_filter: Optional[List[str]] = None,
    limit: int = 25
) -> Dict[str, Any]:
    """
    Executes an end-to-end semantic search query for the authenticated user.
    """
    if not query_text or not query_text.strip():
        return {
            "query": "",
            "parsed_intent": None,
            "total_results": 0,
            "results": [],
        }

    # 1. Natural Language Query Understanding
    parsed = parse_query(query_text)

    # 2. Vector Embedding of the Semantic Topic
    query_vector = generate_embedding(parsed.semantic_topic)

    # 3. Vector Database Retrieval
    candidates = await vector_store.search_similar_chunks(
        session=session,
        user_id=user_id,
        query_vector=query_vector,
        top_k=limit * 2,
        device_ids=device_filter,
        file_types=parsed.target_extensions if parsed.target_extensions else None,
    )

    # 4. Multi-Factor Ranking & Relevance Labeling
    ranked_results = rank_results(candidates, parsed)

    return {
        "query": query_text,
        "parsed_intent": {
            "semantic_topic": parsed.semantic_topic,
            "detected_types": parsed.target_extensions,
            "detected_device": parsed.target_device,
            "time_filter_active": bool(parsed.time_after or parsed.time_before),
        },
        "total_results": len(ranked_results),
        "results": [r.model_dump() for r in ranked_results[:limit]],
    }
