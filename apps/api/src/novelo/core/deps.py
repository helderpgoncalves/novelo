"""Dependências partilhadas: utilizador autenticado e RBAC."""

import uuid
from collections.abc import Callable, Coroutine
from typing import Annotated, Any

from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.errors import AppError
from novelo.core.security import decode_token
from novelo.features.users.models import User


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    access_token: Annotated[str | None, Cookie()] = None,
) -> User:
    if not access_token:
        raise UnauthorizedError("Sessão em falta")
    try:
        payload = decode_token(access_token, "access")
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError) as exc:
        raise UnauthorizedError("Sessão inválida ou expirada") from exc
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Conta inexistente ou inativa")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: str) -> Callable[..., Coroutine[Any, Any, User]]:
    async def _dependency(user: CurrentUser) -> User:
        if user.role not in roles:
            raise ForbiddenError("Sem permissão para esta ação")
        return user

    return _dependency
