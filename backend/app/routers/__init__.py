"""API Routers package."""
from app.routers.auth_router import router as auth_router
from app.routers.device_router import router as device_router
from app.routers.index_router import router as index_router
from app.routers.search_router import router as search_router
from app.routers.privacy_router import router as privacy_router

__all__ = [
    "auth_router",
    "device_router",
    "index_router",
    "search_router",
    "privacy_router",
]
