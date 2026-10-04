"""
Multi-Factor Hybrid Ranking and Relevance Classification Engine.
Combines Vector Cosine Similarity, BM25 Keyword Overlap, File Type Matching,
Date Constraints, and Recency Decay.
Translates mathematical scores into human-readable relevance classifications:
'VERY RELEVANT', 'RELEVANT', 'POSSIBLE MATCH'.
"""
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel

from app.search.query_parser import ParsedQuery


class RelevanceTier(str, Enum):
    VERY_RELEVANT = "VERY RELEVANT"
    RELEVANT = "RELEVANT"
    POSSIBLE_MATCH = "POSSIBLE MATCH"


class SearchResultItem(BaseModel):
    file_id: str
    filename: str
    relative_path: str
    extension: str
    size_bytes: int
    file_modified_at: Optional[str]
    device_id: str
    device_name: str
    device_platform: str
    sync_status: str  # "local_only", "index_synced", "full_synced"
    relevance: RelevanceTier
    reason: str
    action_label: str  # "OPEN / DOWNLOAD" or "VIEW INFORMATION"
    matched_snippet: str
    score: float


def calculate_keyword_score(query_text: str, content: str, filename: str) -> float:
    """Calculate simple lexical overlap score between query keywords and file/content."""
    q_tokens = set(re.findall(r"\w+", query_text.lower()))
    if not q_tokens:
        return 0.0

    target = f"{filename} {content}".lower()
    matches = sum(1 for token in q_tokens if token in target)
    return min(1.0, matches / len(q_tokens))


import re


def generate_match_reason(parsed_query: ParsedQuery, item: Dict[str, Any], sim_score: float) -> str:
    """Generates an honest, human-readable explanation of why this file matched."""
    reasons = []
    
    # 1. Topic match
    if sim_score >= 0.80:
        reasons.append(f"Content strongly matches '{parsed_query.semantic_topic}'")
    elif sim_score >= 0.60:
        reasons.append(f"Discusses themes related to '{parsed_query.semantic_topic}'")

    # 2. File type match
    if parsed_query.target_extensions and item.get("extension") in parsed_query.target_extensions:
        reasons.append(f"matches requested {item.get('extension').upper()} format")

    # 3. Filename mention
    tokens = set(re.findall(r"\w+", parsed_query.semantic_topic.lower()))
    if any(t in item.get("filename", "").lower() for t in tokens if len(t) > 2):
        reasons.append("filename directly references search terms")

    if not reasons:
        reasons.append("Semantic similarity across document passages")

    return "; ".join(reasons).capitalize() + "."


def rank_results(
    candidates: List[Dict[str, Any]],
    parsed_query: ParsedQuery
) -> List[SearchResultItem]:
    """
    Ranks candidates using multi-factor weights and categorizes into relevance tiers.
    Deduplicates multiple chunks from the same file, keeping the highest-scoring chunk.
    """
    now = datetime.now(timezone.utc)
    file_best_chunk: Dict[str, Dict[str, Any]] = {}

    for cand in candidates:
        file_id = cand["file_id"]
        v_sim = cand.get("similarity_score", 0.0)
        kw_score = calculate_keyword_score(parsed_query.semantic_topic, cand.get("matched_content", ""), cand.get("filename", ""))
        
        # File type bonus
        type_bonus = 0.0
        if parsed_query.target_extensions:
            if cand.get("extension", "").lower() in parsed_query.target_extensions:
                type_bonus = 1.0

        # Device bonus
        device_bonus = 0.0
        if parsed_query.target_device:
            if parsed_query.target_device.lower() in cand.get("device_platform", "").lower() or \
               parsed_query.target_device.lower() in cand.get("device_name", "").lower():
                device_bonus = 1.0

        # Date constraint check & recency
        date_score = 0.5
        mod_at_str = cand.get("file_modified_at")
        if mod_at_str:
            try:
                mod_dt = datetime.fromisoformat(mod_at_str)
                if mod_dt.tzinfo is None:
                    mod_dt = mod_dt.replace(tzinfo=timezone.utc)
                
                # Check explicit date bounds
                if parsed_query.time_after and mod_dt < parsed_query.time_after:
                    date_score = 0.0
                elif parsed_query.time_before and mod_dt > parsed_query.time_before:
                    date_score = 0.0
                else:
                    # Recency decay (more recent = higher score)
                    days_ago = max(0, (now - mod_dt).days)
                    date_score = max(0.2, 1.0 - (days_ago / 365.0))
            except Exception:
                pass

        # Composite multi-factor score
        composite_score = (
            0.50 * v_sim +
            0.20 * kw_score +
            0.15 * type_bonus +
            0.10 * date_score +
            0.05 * device_bonus
        )

        cand["composite_score"] = composite_score

        if file_id not in file_best_chunk or composite_score > file_best_chunk[file_id]["composite_score"]:
            file_best_chunk[file_id] = cand

    # Sort files by highest composite score
    sorted_items = sorted(file_best_chunk.values(), key=lambda x: x["composite_score"], reverse=True)

    results: List[SearchResultItem] = []
    for item in sorted_items:
        score = item["composite_score"]
        
        # Categorize into human-understandable relevance tiers
        if score >= 0.75:
            tier = RelevanceTier.VERY_RELEVANT
        elif score >= 0.55:
            tier = RelevanceTier.RELEVANT
        elif score >= 0.35:
            tier = RelevanceTier.POSSIBLE_MATCH
        else:
            continue  # Exclude irrelevant noise

        sync_status = item.get("sync_status", "local_only")
        action_label = "OPEN / DOWNLOAD" if sync_status == "full_synced" else "VIEW INFORMATION"
        reason = generate_match_reason(parsed_query, item, item.get("similarity_score", 0.0))

        results.append(SearchResultItem(
            file_id=item["file_id"],
            filename=item["filename"],
            relative_path=item["relative_path"],
            extension=item["extension"],
            size_bytes=item["size_bytes"],
            file_modified_at=item["file_modified_at"],
            device_id=item["device_id"],
            device_name=item["device_name"],
            device_platform=item["device_platform"],
            sync_status=sync_status,
            relevance=tier,
            reason=reason,
            action_label=action_label,
            matched_snippet=item.get("matched_content", "")[:280] + ("..." if len(item.get("matched_content", "")) > 280 else ""),
            score=round(score, 4),
        ))

    return results
