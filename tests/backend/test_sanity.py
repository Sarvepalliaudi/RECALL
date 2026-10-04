"""
RECALL Backend Sanity and Unit Test Suite.
Tests Query Parsing, Text Chunking, Extraction, Password Hashing, and Ranking.
"""
import pytest
from app.search.query_parser import parse_query
from app.indexer.chunker import chunk_text
from app.indexer.extractors import compute_sha256, extract_plain_text
from app.security.passwords import hash_password, verify_password
from app.search.ranker import rank_results, RelevanceTier, calculate_keyword_score


def test_sha256_computation():
    data = b"Hello RECALL Semantic Engine"
    digest = compute_sha256(data)
    assert len(digest) == 64
    import hashlib
    assert digest == hashlib.sha256(data).hexdigest()


def test_password_hashing():
    pw = "SuperSecureMemory123!"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_query_parsing_aws_screenshot():
    q = "Find the AWS architecture screenshot I saved last month"
    parsed = parse_query(q)
    assert "aws architecture" in parsed.semantic_topic.lower()
    assert ".png" in parsed.target_extensions or ".jpg" in parsed.target_extensions
    assert parsed.time_after is not None


def test_query_parsing_gate_pdf():
    q = "Show everything related to GATE preparation that I downloaded this week"
    parsed = parse_query(q)
    assert "gate preparation" in parsed.semantic_topic.lower()
    assert parsed.time_after is not None
    assert parsed.is_multi_result is True


def test_text_chunking():
    sample_text = (
        "Heading 1: System Overview\n\n"
        "RECALL is an intelligent semantic search system for personal devices. "
        "It indexes local files and generates high dimensional vector embeddings.\n\n"
        "Heading 2: Security Architecture\n\n"
        "All user data remains strictly isolated by tenant ID and protected by cryptographic session tokens."
    )
    chunks = chunk_text(sample_text, max_chunk_chars=150, overlap_chars=20)
    assert len(chunks) >= 2
    assert all("content" in c and "chunk_index" in c for c in chunks)


def test_ranking_relevance_tiers():
    parsed = parse_query("AWS cloud architecture diagram")
    mock_candidates = [
        {
            "file_id": "file-1",
            "filename": "AWS_Cloud_Architecture.png",
            "relative_path": "Downloads/AWS_Cloud_Architecture.png",
            "extension": ".png",
            "size_bytes": 102400,
            "file_modified_at": "2026-10-01T10:00:00Z",
            "device_id": "dev-win",
            "device_name": "Windows PC",
            "device_platform": "windows",
            "sync_status": "index_synced",
            "matched_content": "Diagram of AWS VPC peering, subnets, and internet gateway routing.",
            "similarity_score": 0.88,
        },
        {
            "file_id": "file-2",
            "filename": "Grocery_List.txt",
            "relative_path": "Documents/Grocery_List.txt",
            "extension": ".txt",
            "size_bytes": 120,
            "file_modified_at": "2025-01-01T10:00:00Z",
            "device_id": "dev-phone",
            "device_name": "iPhone",
            "device_platform": "ios",
            "sync_status": "local_only",
            "matched_content": "Apples, bananas, milk, bread.",
            "similarity_score": 0.12,
        }
    ]

    ranked = rank_results(mock_candidates, parsed)
    assert len(ranked) >= 1
    top_result = ranked[0]
    assert top_result.filename == "AWS_Cloud_Architecture.png"
    assert top_result.relevance in (RelevanceTier.VERY_RELEVANT, RelevanceTier.RELEVANT)
    assert "aws" in top_result.reason.lower() or "diagram" in top_result.reason.lower() or "content" in top_result.reason.lower()
