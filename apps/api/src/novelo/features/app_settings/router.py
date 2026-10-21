from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import require_role
from novelo.core.ratelimit import admin_approval_limiter
from novelo.core.request_meta import Meta
from novelo.features.app_settings import service
from novelo.features.app_settings.schemas import AppSettingsOut, AppSettingsUpdate, AppSettingsUpdated
from novelo.features.users.models import User

router = APIRouter()  # prefixo /admin/settings; só administradores
Db = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[User, Depends(require_role("admin"))]


@router.get("", response_model=AppSettingsOut)
async def get_app_settings(_: Admin, db: Db) -> AppSettingsOut:
    """Global application settings (admins only): open registration and how many accounts wait for approval."""
    return await service.get_out(db)


@router.patch("", response_model=AppSettingsUpdated)
async def update_app_settings(body: AppSettingsUpdate, admin: Admin, db: Db, meta: Meta) -> AppSettingsUpdated:
    """Change global settings (admins only, audited). `approve_pending=true` also approves the accounts already
    waiting (only with open registration; emails rejected before keep waiting). Each approval is audited."""
    admin_approval_limiter.check(f"admin-approval:{admin.id}")
    return await service.update(db, admin, body, meta)
