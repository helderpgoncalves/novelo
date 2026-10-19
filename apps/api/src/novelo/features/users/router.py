import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import require_role
from novelo.core.errors import CannotModifySelfError, UserNotFoundError
from novelo.features.auth import service as auth_service
from novelo.features.users import service
from novelo.features.users.models import User
from novelo.features.users.schemas import UserAdminOut, UserAdminUpdate

router = APIRouter()

Db = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[User, Depends(require_role("admin"))]


@router.get("", response_model=list[UserAdminOut])
async def list_users(_: Admin, db: Db) -> list[UserAdminOut]:
    """Platform accounts (admins only)."""
    return [service.to_admin_out(u) for u in await service.list_users(db)]


@router.patch("/{user_id}", response_model=UserAdminOut)
async def update_user(user_id: uuid.UUID, body: UserAdminUpdate, admin: Admin, db: Db) -> UserAdminOut:
    """Change role or activate/deactivate an account. Admins cannot change themselves."""
    if user_id == admin.id:
        raise CannotModifySelfError("You cannot change your own role or status")
    user = await db.get(User, user_id)
    if user is None:
        raise UserNotFoundError("User not found")
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
        if not body.is_active:
            await auth_service.revoke_all_sessions(db, user.id)
    await db.commit()
    return service.to_admin_out(user)
