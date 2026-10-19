from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSender, get_email_sender
from novelo.core.config import get_settings
from novelo.core.database import get_db
from novelo.core.deps import CurrentUser, UnauthorizedError
from novelo.core.errors import AppError
from novelo.core.ratelimit import auth_limiter, reset_limiter
from novelo.core.security import create_state_token, decode_token, new_opaque_token
from novelo.features.auth import google, service
from novelo.features.auth.schemas import (
    AuthConfig,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
)
from novelo.features.users.schemas import UserOut
from novelo.features.users.service import to_out

router = APIRouter()

Db = Annotated[AsyncSession, Depends(get_db)]
Sender = Annotated[EmailSender, Depends(get_email_sender)]

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
STATE_COOKIE = "oauth_state"
REFRESH_PATH = "/api/v1/auth"


def _set_cookie(response: Response, key: str, value: str, max_age: int, path: str) -> None:
    response.set_cookie(
        key,
        value,
        max_age=max_age,
        path=path,
        httponly=True,
        secure=get_settings().secure_cookies,
        samesite="lax",
    )


def _set_session(response: Response, access: str, refresh: str) -> None:
    s = get_settings()
    _set_cookie(response, ACCESS_COOKIE, access, s.access_token_minutes * 60, "/")
    _set_cookie(response, REFRESH_COOKIE, refresh, s.refresh_token_days * 86400, REFRESH_PATH)


def _clear_session(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_PATH)


@router.get("/config", response_model=AuthConfig)
def get_auth_config() -> AuthConfig:
    """O que o ecrã de entrada precisa de saber: Google ligado? registo aberto?"""
    s = get_settings()
    return AuthConfig(google_enabled=s.google_enabled, registration_open=s.allow_registration)


@router.post("/login", response_model=UserOut, dependencies=[Depends(auth_limiter)])
async def login(body: LoginRequest, response: Response, db: Db) -> UserOut:
    user, access, refresh = await service.login(db, body.email, body.password)
    _set_session(response, access, refresh)
    return to_out(user)


@router.post("/register", response_model=UserOut, status_code=201, dependencies=[Depends(auth_limiter)])
async def register(body: RegisterRequest, response: Response, db: Db, sender: Sender) -> UserOut:
    user, access, refresh = await service.register(db, sender, body.email, body.password, body.name)
    _set_session(response, access, refresh)
    return to_out(user)


@router.post("/refresh", status_code=204)
async def refresh(response: Response, db: Db, refresh_token: Annotated[str | None, Cookie()] = None) -> None:
    if not refresh_token:
        _clear_session(response)
        raise UnauthorizedError("Sem sessão")
    access, new_refresh = await service.rotate_refresh(db, refresh_token)
    _set_session(response, access, new_refresh)


@router.post("/logout", status_code=204)
async def logout(response: Response, db: Db, refresh_token: Annotated[str | None, Cookie()] = None) -> None:
    await service.logout(db, refresh_token)
    _clear_session(response)


@router.get("/me", response_model=UserOut)
async def get_me(user: CurrentUser) -> UserOut:
    return to_out(user)


@router.post("/forgot-password", status_code=204, dependencies=[Depends(reset_limiter)])
async def forgot_password(body: ForgotPasswordRequest, db: Db, sender: Sender) -> None:
    """Responde 204 exista ou não a conta: não revela que emails estão registados."""
    await service.request_password_reset(db, sender, body.email)


@router.post("/reset-password", status_code=204, dependencies=[Depends(reset_limiter)])
async def reset_password(body: ResetPasswordRequest, response: Response, db: Db) -> None:
    await service.reset_password(db, body.token, body.password)
    _clear_session(response)


@router.post("/change-password", status_code=204)
async def change_password(body: ChangePasswordRequest, response: Response, user: CurrentUser, db: Db) -> None:
    await service.change_password(db, user, body.current_password, body.new_password)
    _clear_session(response)


@router.get("/google/login", include_in_schema=False)
def google_login(next: Annotated[str, Query()] = "/") -> RedirectResponse:
    s = get_settings()
    if not s.google_enabled:
        raise AppError("Entrar com a Google não está configurado")
    nonce = new_opaque_token()
    target = next if next.startswith("/") and not next.startswith("//") else "/"
    state = create_state_token({"nonce": nonce, "next": target})
    redirect = RedirectResponse(google.authorization_url(state), status_code=302)
    _set_cookie(redirect, STATE_COOKIE, nonce, 600, REFRESH_PATH)
    return redirect


@router.get("/google/callback", include_in_schema=False)
async def google_callback(
    request: Request,
    db: Db,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    oauth_state: Annotated[str | None, Cookie()] = None,
) -> RedirectResponse:
    s = get_settings()
    base = s.app_url.rstrip("/")
    if error or not code or not state:
        return RedirectResponse(f"{base}/entrar?erro=google", status_code=302)
    try:
        claims = decode_token(state, "state")
    except ValueError:
        return RedirectResponse(f"{base}/entrar?erro=google", status_code=302)
    if not oauth_state or claims.get("nonce") != oauth_state:
        return RedirectResponse(f"{base}/entrar?erro=google", status_code=302)
    try:
        profile = await google.fetch_profile(code)
        _, access, refresh_token = await service.login_with_google(db, profile)
    except AppError as exc:
        return RedirectResponse(f"{base}/entrar?erro={exc.code}", status_code=302)
    redirect = RedirectResponse(f"{base}{claims.get('next', '/')}", status_code=302)
    _set_session(redirect, access, refresh_token)
    redirect.delete_cookie(STATE_COOKIE, path=REFRESH_PATH)
    return redirect
