"""
Device Management Router for RECALL.
Handles device registration, status tracking, sync opt-in toggles, and device unlinking.
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.database.models import User, Device, IndexedFile
from app.security.auth import get_current_user

router = APIRouter(prefix="/devices", tags=["Device Management"])


class DeviceRegisterRequest(BaseModel):
    device_id: Optional[str] = None
    name: str  # e.g. "Windows PC", "iPhone", "MacBook Pro"
    platform: str  # "windows", "macos", "ios", "android", "linux"
    client_type: str = "pwa"
    sync_enabled: bool = False


class DeviceResponse(BaseModel):
    id: str
    name: str
    platform: str
    client_type: str
    is_active: bool
    sync_enabled: bool
    files_indexed: int
    files_synced: int
    last_seen_at: str
    created_at: str


class SyncToggleRequest(BaseModel):
    sync_enabled: bool


@router.get("", response_model=List[DeviceResponse])
async def list_devices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all registered devices for the current user."""
    stmt = select(Device).where(Device.user_id == current_user.id).order_by(Device.last_seen_at.desc())
    result = await db.execute(stmt)
    devices = result.scalars().all()
    
    return [
        DeviceResponse(
            id=d.id,
            name=d.name,
            platform=d.platform,
            client_type=d.client_type,
            is_active=d.is_active,
            sync_enabled=d.sync_enabled,
            files_indexed=d.files_indexed,
            files_synced=d.files_synced,
            last_seen_at=d.last_seen_at.isoformat(),
            created_at=d.created_at.isoformat(),
        )
        for d in devices
    ]


@router.post("/register", response_model=DeviceResponse)
async def register_device(
    req: DeviceRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Register or refresh an existing device instance."""
    now = datetime.now(timezone.utc)
    device = None

    if req.device_id:
        result = await db.execute(
            select(Device).where(Device.id == req.device_id, Device.user_id == current_user.id)
        )
        device = result.scalar_one_or_none()

    if device:
        # Update heartbeat and metadata
        device.name = req.name
        device.platform = req.platform
        device.client_type = req.client_type
        device.last_seen_at = now
        device.is_active = True
    else:
        device = Device(
            user_id=current_user.id,
            name=req.name,
            platform=req.platform,
            client_type=req.client_type,
            sync_enabled=req.sync_enabled,
            last_seen_at=now,
        )
        db.add(device)

    await db.commit()
    await db.refresh(device)

    return DeviceResponse(
        id=device.id,
        name=device.name,
        platform=device.platform,
        client_type=device.client_type,
        is_active=device.is_active,
        sync_enabled=device.sync_enabled,
        files_indexed=device.files_indexed,
        files_synced=device.files_synced,
        last_seen_at=device.last_seen_at.isoformat(),
        created_at=device.created_at.isoformat(),
    )


@router.patch("/{device_id}/sync", response_model=DeviceResponse)
async def toggle_device_sync(
    device_id: str,
    req: SyncToggleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Enable or disable synchronization for a specific device."""
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.user_id == current_user.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")

    device.sync_enabled = req.sync_enabled
    await db.commit()
    await db.refresh(device)

    return DeviceResponse(
        id=device.id,
        name=device.name,
        platform=device.platform,
        client_type=device.client_type,
        is_active=device.is_active,
        sync_enabled=device.sync_enabled,
        files_indexed=device.files_indexed,
        files_synced=device.files_synced,
        last_seen_at=device.last_seen_at.isoformat(),
        created_at=device.created_at.isoformat(),
    )


@router.delete("/{device_id}")
async def unlink_device(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Unlink a device and remove all its remote index records.
    Explicitly DOES NOT touch or delete original local files on the device.
    """
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.user_id == current_user.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")

    await db.delete(device)
    await db.commit()

    return {
        "message": f"Device '{device.name}' and all associated cloud index records were removed. Original local files remain completely untouched."
    }
