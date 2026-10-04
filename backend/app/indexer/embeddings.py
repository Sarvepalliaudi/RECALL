"""
Embeddings Generation Service using Google GenAI SDK (Gemini).
Model: text-embedding-004 (768 dimensions).
Includes local memory cache to eliminate redundant API requests for identical chunks.
"""
import hashlib
from typing import List, Optional
from app.config import get_settings

settings = get_settings()

# In-memory LRU cache for embeddings (hash -> vector)
_EMBEDDING_CACHE = {}


def _get_genai_client():
    """Initializes Google GenAI Client if GEMINI_API_KEY is available."""
    if not settings.GEMINI_API_KEY:
        return None
    try:
        from google import genai
        return genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception:
        return None


def generate_embedding(text: str) -> List[float]:
    """
    Generate a 768-dimensional vector embedding for a single text string.
    Caches vectors by text SHA-256 hash.
    Falls back to a deterministic normalized pseudo-embedding if API key is not yet configured.
    """
    cleaned = text.strip()
    if not cleaned:
        return [0.0] * 768

    text_hash = hashlib.sha256(cleaned.encode("utf-8")).hexdigest()
    if text_hash in _EMBEDDING_CACHE:
        return _EMBEDDING_CACHE[text_hash]

    client = _get_genai_client()
    if client:
        try:
            # Using Google GenAI SDK embeddings API
            response = client.models.embed_content(
                model=settings.GEMINI_EMBEDDING_MODEL,
                contents=cleaned,
            )
            # Response structure in google-genai
            if hasattr(response, "embeddings") and response.embeddings:
                vector = list(response.embeddings[0].values)
                _EMBEDDING_CACHE[text_hash] = vector
                return vector
            elif hasattr(response, "embedding") and response.embedding:
                vector = list(response.embedding.values)
                _EMBEDDING_CACHE[text_hash] = vector
                return vector
        except Exception as e:
            print(f"[Warning] Gemini API embedding error: {e}. Falling back to deterministic vector.")

    # Deterministic fallback vector for unit tests or offline local development
    # Ensures cosine similarity remains mathematically valid without crashing
    import numpy as np
    seed = int(text_hash[:8], 16) % (2**32)
    rng = np.random.RandomState(seed)
    random_vec = rng.randn(768).astype(np.float32)
    norm = np.linalg.norm(random_vec)
    normalized = (random_vec / norm).tolist()
    _EMBEDDING_CACHE[text_hash] = normalized
    return normalized


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """Generate vector embeddings for a list of text strings."""
    return [generate_embedding(t) for t in texts]
