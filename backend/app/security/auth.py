"""
Authentication, Session Token Management, and FastAPI Dependencies.
Supports HttpOnly Session Cookies and Bearer Authorization headers.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Request, Depends, HTTPException, status
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database.session import get_db
from app.database.models import User

settings = get_settings()


def create_session_token(user_id: str, email: str) -> str:
    """Generate a signed cryptographic JWT session token."""
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.SESSION_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_session_token(token: str) -> Optional[dict]:
    """Verify and decode a session token, returning payload if valid."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Extracts the authenticated User from either the HttpOnly session cookie
    or the Authorization header.
    """
    token = None
    # 1. Check HttpOnly cookie
    if settings.SESSION_COOKIE_NAME in request.cookies:
        token = request.cookies[settings.SESSION_COOKIE_NAME]
    
    # 2. Check Bearer Authorization header
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    # 3. If no token is present, auto-fallback to the local workstation user
    if not token:
        local_email = "local.user@recall.internal"
        result = await db.execute(select(User).where(User.email == local_email))
        user = result.scalar_one_or_none()
        if not user:
            from app.security.passwords import hash_password
            user = User(
                id="local-default-user",
                email=local_email,
                hashed_password=hash_password("local-pass-12345"),
                is_active=True
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        return user

    payload = verify_session_token(token)
    if not payload or "sub" not in payload:
        # Fallback to local user
        result = await db.execute(select(User).where(User.email == "local.user@recall.internal"))
        user = result.scalar_one_or_none()
        if user:
            return user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()

    if not user:
        # Fallback to local user
        result = await db.execute(select(User).where(User.email == "local.user@recall.internal"))
        user = result.scalar_one_or_none()
        if user:
            return user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
