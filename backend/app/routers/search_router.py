"""
Semantic Search Router for RECALL.
Provides natural language semantic query endpoint with multi-factor relevance ranking.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.database.models import User
from app.security.auth import get_current_user
from app.search.vector_search import execute_search

router = APIRouter(prefix="/search", tags=["Semantic Search"])


class SearchQueryRequest(BaseModel):
    query: str
    device_filter: Optional[List[str]] = None
    limit: int = 25


@router.post("/query")
async def perform_search(
    req: SearchQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Execute natural language search across all user indexed devices.
    Returns categorized relevance results with human-readable reasoning.
    """
    if not req.query.strip():
        return {
            "query": "",
            "parsed_intent": None,
            "total_results": 0,
            "results": [],
        }

    search_output = await execute_search(
        session=db,
        user_id=current_user.id,
        query_text=req.query,
        device_filter=req.device_filter,
        limit=req.limit,
    )

    return search_output
