"""
RECALL Main FastAPI Application Entrypoint.
Initializes database, CORS, security headers, lifespan events, and modular API routers.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database.session import init_db
from app.security.headers import add_security_headers
from app.routers.auth_router import router as auth_router
from app.routers.device_router import router as device_router
from app.routers.index_router import router as index_router
from app.routers.search_router import router as search_router
from app.routers.privacy_router import router as privacy_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database tables & vector extensions
    await init_db()
    yield
    # Shutdown: Clean up resources if needed


app = FastAPI(
    title=settings.APP_NAME,
    description="Cross-Platform Personal AI Semantic Search & File Memory System",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs" if not settings.is_production else None,
    redoc_url=None,
)

# 1. CORS Configuration (Strict Origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# 2. Add OWASP Security Headers Middleware
add_security_headers(app)

# 3. Mount Modular API Routers under /api/v1
API_V1_PREFIX = "/api/v1"
app.include_router(auth_router, prefix=API_V1_PREFIX)
app.include_router(device_router, prefix=API_V1_PREFIX)
app.include_router(index_router, prefix=API_V1_PREFIX)
app.include_router(search_router, prefix=API_V1_PREFIX)
app.include_router(privacy_router, prefix=API_V1_PREFIX)


@app.get("/health")
async def health_check():
    """Health check endpoint for container and uptime probes."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "tagline": settings.APP_TAGLINE,
    }


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "tagline": settings.APP_TAGLINE,
        "status": "online",
        "docs": "/api/docs" if not settings.is_production else "disabled",
    }
