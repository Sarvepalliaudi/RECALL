"""
RECALL Backend Configuration Management.
Validates all runtime environment settings using Pydantic Settings v2.
"""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Core App
    ENVIRONMENT: str = "development"
    APP_NAME: str = "RECALL"
    APP_TAGLINE: str = "Your devices remember files. RECALL remembers meaning."
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Security & Auth
    SECRET_KEY: str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    SESSION_COOKIE_NAME: str = "recall_session"
    SESSION_EXPIRE_HOURS: int = 72
    SECURE_COOKIES: bool = False
    ALGORITHM: str = "HS256"

    # Database & Storage
    # Default to a local SQLite async database for effortless standalone developer setup.
    # When connecting to PostgreSQL, set DATABASE_URL=postgresql+asyncpg://...
    DATABASE_URL: str = "sqlite+aiosqlite:///./recall_local.db"
    USE_PGVECTOR: bool = False

    # Google GenAI / Gemini API
    GEMINI_API_KEY: str = ""
    GEMINI_EMBEDDING_MODEL: str = "text-embedding-004"
    GEMINI_REASONING_MODEL: str = "gemini-3.8-flash"

    # Storage & Uploads
    LOCAL_VAULT_PATH: str = "./storage/vault"
    MAX_UPLOAD_SIZE_MB: int = 50

    # OCR Settings
    TESSERACT_CMD: str = ""
    ENABLE_OCR: bool = True

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
