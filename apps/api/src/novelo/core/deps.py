"""Dependências partilhadas: utilizador autenticado, RBAC e bloqueio durante impersonação."""

import uuid
from collections.abc import Callable, Coroutine
from typing import Annotated, Any

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.errors import (
    AccountInactiveError,
    AccountPendingError,
    AccountRejectedError,
    ForbiddenError,
    ImpersonationBlockedError,
    SessionExpiredError,
    UnauthenticatedError,
)
from novelo.core.request_meta import get_request_meta
from novelo.core.security import decode_token
from novelo.features.audit import service as audit
from novelo.features.auth.cookies import ACCESS_COOKIE, read_cookie
from novelo.features.users import impersonation
from novelo.features.users.models import User

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


async def get_session_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    access_token = read_cookie(request, ACCESS_COOKIE)
    if not access_token:
        raise UnauthenticatedError("Missing session")
    try:
        payload = decode_token(access_token, "access")
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError) as exc:
        raise SessionExpiredError("Invalid or expired session") from exc
    user = await db.get(User, user_id)
    if user is None:
        raise SessionExpiredError("Account no longer exists")
    if not user.is_active:
        raise AccountInactiveError("Account is inactive")
    user.impersonation = None  # o objeto pode vir da cache da sessão: o estado é sempre recalculado por pedido
    if "imp" in payload:
        user.impersonation = await impersonation.resolve(db, payload, user)
        if request.method not in SAFE_METHODS:
            # Escritas em nome de outra pessoa ficam registadas antes de executar (mesmo que depois falhem).
            await audit.record(
                db,
                "impersonation.write",
                actor_id=user.impersonation.admin_id,
                effective_actor_id=user.id,
                target_type="request",
                meta=get_request_meta(request),
                details={"method": request.method, "path": request.url.path},
            )
            await db.commit()
    return user


SessionUser = Annotated[User, Depends(get_session_user)]


async def get_current_user(user: SessionUser) -> User:
    """O utilizador da sessão, só se a conta estiver aprovada: é a guarda de TODAS as rotas protegidas.

    `/auth/me`, `/auth/approval-status` e pouco mais usam `SessionUser` (sem esta guarda) para o ecrã de espera.
    """
    if user.approval_status == "pending":
        raise AccountPendingError("Your account is waiting for approval")
    if user.approval_status == "rejected":
        raise AccountRejectedError("Your account was not approved")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: str) -> Callable[..., Coroutine[Any, Any, User]]:
    async def _dependency(user: CurrentUser) -> User:
        if user.role not in roles:
            raise ForbiddenError("Insufficient permissions")
        if user.impersonation is not None and user.role == "admin":  # defesa extra: nunca acontece com alvos válidos
            raise ImpersonationBlockedError("Not allowed while impersonating")
        return user

    return _dependency


def forbid_impersonation(request: Request) -> None:
    """Bloqueia a rota se o token de sessão for de impersonação (alterar password, exportar dados, apagar, etc.).

    Lê só o token assinado (sem base de dados): um token de impersonação já terminado também é recusado por
    `get_current_user`, e aqui basta saber que é de impersonação para negar.
    """
    access_token = read_cookie(request, ACCESS_COOKIE)
    if not access_token:
        return
    try:
        payload = decode_token(access_token, "access")
    except ValueError:
        return  # inválido/expirado: quem responde é `get_current_user`
    if "imp" in payload:
        raise ImpersonationBlockedError("Not allowed while impersonating")


NotImpersonating = Depends(forbid_impersonation)
