"""
HTTP Security Headers Middleware for OWASP Compliance.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.config import get_settings

settings = get_settings()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Clickjacking defense
        response.headers["X-Frame-Options"] = "DENY"
        
        # XSS filtering
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer privacy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Disable unwanted browser features
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=()"

        # Content Security Policy (allows local Next.js frontend communication)
        csp = (
            "default-src 'self'; "
            f"connect-src 'self' {settings.FRONTEND_URL} https://generativelanguage.googleapis.com; "
            "img-src 'self' data: blob:; "
            "style-src 'self' 'unsafe-inline'; "
            "script-src 'self' 'unsafe-inline'; "
            "frame-ancestors 'none';"
        )
        response.headers["Content-Security-Policy"] = csp

        # HSTS in production
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"

        return response


def add_security_headers(app):
    app.add_middleware(SecurityHeadersMiddleware)
