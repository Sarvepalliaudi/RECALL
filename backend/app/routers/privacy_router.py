"""
Privacy & Data Controls Router for RECALL.
Provides audit summaries, index purge tools, and full account erasure.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.database.models import User, Device, IndexedFile, DocumentChunk
from app.security.auth import get_current_user

router = APIRouter(prefix="/privacy", tags=["Privacy Controls"])


@router.get("/summary")
async def get_privacy_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns complete summary of what user data is indexed and synchronized."""
    # Count devices
    dev_count = await db.scalar(
        select(func.count(Device.id)).where(Device.user_id == current_user.id)
    ) or 0

    # Count files
    file_count = await db.scalar(
        select(func.count(IndexedFile.id)).where(IndexedFile.user_id == current_user.id)
    ) or 0

    # Count chunks
    chunk_count = await db.scalar(
        select(func.count(DocumentChunk.id)).where(DocumentChunk.user_id == current_user.id)
    ) or 0

    # Synced files
    synced_count = await db.scalar(
        select(func.count(IndexedFile.id)).where(
            IndexedFile.user_id == current_user.id,
            IndexedFile.sync_status != "local_only"
        )
    ) or 0

    return {
        "user_email": current_user.email,
        "account_created": current_user.created_at.isoformat(),
        "total_devices_connected": dev_count,
        "total_files_indexed": file_count,
        "total_chunks_stored": chunk_count,
        "total_files_synced": synced_count,
        "storage_mode": "Local-First with Opt-in Encrypted Vector Index",
    }


@router.post("/purge-device/{device_id}")
async def purge_device_index(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Purge all vector embeddings and indexed files for a specific device.
    Original files on the device remain completely untouched.
    """
    dev_res = await db.execute(
        select(Device).where(Device.id == device_id, Device.user_id == current_user.id)
    )
    device = dev_res.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")

    await db.execute(delete(IndexedFile).where(IndexedFile.device_id == device.id))
    device.files_indexed = 0
    device.files_synced = 0
    await db.commit()

    return {
        "message": f"All indexed memories and vectors for '{device.name}' have been purged. Local files are untouched."
    }


@router.post("/purge-all")
async def purge_all_indexes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Purge all index representations and vectors across all devices for this user."""
    await db.execute(delete(IndexedFile).where(IndexedFile.user_id == current_user.id))
    devices = (await db.execute(select(Device).where(Device.user_id == current_user.id))).scalars().all()
    for d in devices:
        d.files_indexed = 0
        d.files_synced = 0
    await db.commit()

    return {"message": "All indexed memories across all devices have been purged."}


@router.delete("/account")
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Permanently delete user account, all devices, and all stored vectors."""
    await db.delete(current_user)
    await db.commit()
    return {"message": "User account and all associated memory indices were permanently deleted."}
