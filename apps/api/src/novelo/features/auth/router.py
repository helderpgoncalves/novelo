import io
from typing import Annotated

import segno
from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSender, get_email_sender
from novelo.core.captcha import captcha
from novelo.core.config import get_settings
from novelo.core.database import get_db
from novelo.core.deps import CurrentUser, require_role
from novelo.core.errors import (
    AppError,
    FeatureDisabledError,
    RateLimitError,
    SessionExpiredError,
)
from novelo.core.ratelimit import (
    auth_limiter,
    client_ip,
    magic_email_limiter,
    magic_link_limiter,
    magic_verify_limiter,
    quick_join_code_limiter,
    quick_join_email_limiter,
    quick_join_limiter,
    reset_limiter,
)
from novelo.core.security import create_state_token, decode_token, hash_token, new_opaque_token
from novelo.features.auth import google, passwordless, service
from novelo.features.auth.schemas import (
    AuthConfig,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GuestPage,
    LoginRequest,
    MagicLinkRequest,
    MagicLinkVerifyRequest,
    QuickJoinInfo,
    QuickJoinPoster,
    QuickJoinRequest,
    QuickJoinResult,
    RegisterRequest,
    ResetPasswordRequest,
    SignedIn,
    VerifyEmailRequest,
)
from novelo.features.users.models import User
from novelo.features.users.schemas import Locale, ProfileUpdate, UserOut
from novelo.features.users.service import to_out

router = APIRouter()  # os erros comuns são declarados no include_router (main.py)

Db = Annotated[AsyncSession, Depends(get_db)]
Sender = Annotated[EmailSender, Depends(get_email_sender)]
Admin = Annotated[User, Depends(require_role("admin"))]

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
STATE_COOKIE = "oauth_state"
REFRESH_PATH = "/api/v1/auth"


def _set_cookie(response: Response, key: str, value: str, max_age: int | None, path: str) -> None:
    # max_age=None cria um cookie de sessão: some quando o browser fecha ("não manter sessão").
    response.set_cookie(
        key,
        value,
        max_age=max_age,
        path=path,
        httponly=True,
        secure=get_settings().secure_cookies,
        samesite="lax",
    )


def _set_session(response: Response, access: str, refresh: str, remember: bool = True) -> None:
    s = get_settings()
    _set_cookie(response, ACCESS_COOKIE, access, s.access_token_minutes * 60, "/")
    max_age = s.refresh_token_days * 86400 if remember else None
    _set_cookie(response, REFRESH_COOKIE, refresh, max_age, REFRESH_PATH)


def _clear_session(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_PATH)


@router.get("/config", response_model=AuthConfig)
def get_auth_config() -> AuthConfig:
    """O que o ecrã de entrada precisa de saber: Google ligado? registo aberto?"""
    s = get_settings()
    return AuthConfig(
        google_enabled=s.google_enabled,
        registration_open=s.allow_registration,
        magic_link_enabled=s.magic_link_enabled,
        quick_join_enabled=s.quick_join_active,
        turnstile_enabled=s.turnstile_enabled,
        turnstile_site_key=s.turnstile_site if s.turnstile_enabled and s.turnstile_secret else None,
    )


def _user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


def _queue(background: BackgroundTasks, sender: EmailSender, mails: list[passwordless.Outgoing]) -> None:
    for m in mails:
        background.add_task(service.send_quietly, sender, m.to, m.subject, m.html, m.text)


@router.post("/magic-link", status_code=204, dependencies=[Depends(magic_link_limiter), Depends(captcha("magic_link"))])
async def request_magic_link(
    body: MagicLinkRequest, request: Request, db: Db, sender: Sender, background: BackgroundTasks
) -> None:
    """Envia um link de entrada válido 15 min e de uso único. Responde 204 exista ou não a conta."""
    s = get_settings()
    if not s.magic_link_enabled:
        raise FeatureDisabledError("Email sign-in is not available")
    try:
        magic_email_limiter.check(f"magic-email:{hash_token(body.email.lower())}")
    except RateLimitError:
        return  # em silêncio: não permite encher a caixa de alguém nem sondar contas
    mail = await passwordless.request_magic_link(
        db, body.email, body.next, ip=client_ip(request), user_agent=_user_agent(request)
    )
    _queue(background, sender, [mail] if mail else [])


@router.post("/magic-link/verify", response_model=SignedIn, dependencies=[Depends(magic_verify_limiter)])
async def verify_magic_link(body: MagicLinkVerifyRequest, response: Response, db: Db) -> SignedIn:
    """Troca o link por uma sessão de 30 dias e confirma o email. O token só funciona uma vez."""
    user, access, refresh, next_path = await passwordless.verify_magic_link(db, body.token)
    _set_session(response, access, refresh, True)
    return SignedIn(user=to_out(user), next=next_path)


@router.get("/quick-join/info", response_model=QuickJoinInfo)
def get_quick_join_info() -> QuickJoinInfo:
    """Público: o web mostra ou esconde a entrada por QR."""
    s = get_settings()
    return QuickJoinInfo(enabled=s.quick_join_active, consent_version=s.quick_join_consent_version)


@router.post(
    "/quick-join",
    response_model=QuickJoinResult,
    dependencies=[Depends(quick_join_limiter), Depends(captcha("quick_join"))],
)
async def quick_join(
    body: QuickJoinRequest, request: Request, response: Response, db: Db, sender: Sender, background: BackgroundTasks
) -> QuickJoinResult:
    """Entrada do evento com nome, email e código do QR. Email novo: convidado com sessão iniciada.
    Email que já tem conta: não inicia sessão; envia um link de entrada e responde `check_email`."""
    if body.website:
        return QuickJoinResult(status="check_email")  # honeypot: o bot recebe um sucesso plausível e nada acontece
    ip = client_ip(request)
    passwordless.require_quick_join_enabled()
    code_key = f"quick-join-code:{ip}"
    if quick_join_code_limiter.is_blocked(code_key):
        raise RateLimitError("Too many attempts. Try again in a few minutes.")
    try:
        passwordless.check_event_code(body.code)
    except AppError:
        quick_join_code_limiter.check(code_key)  # só as falhas contam
        raise
    quick_join_email_limiter.check(f"quick-join-email:{hash_token(body.email.lower())}")
    outcome = await passwordless.quick_join(
        db, name=body.name, email=body.email, locale=body.locale, ip=ip, user_agent=_user_agent(request)
    )
    _queue(background, sender, outcome.emails)
    if outcome.user is None or outcome.access is None or outcome.refresh is None:
        return QuickJoinResult(status="check_email")
    _set_session(response, outcome.access, outcome.refresh, True)
    return QuickJoinResult(status="signed_in", user=to_out(outcome.user))


@router.get("/quick-join/qr", response_model=QuickJoinPoster)
def get_quick_join_qr(_: Admin, response: Response) -> QuickJoinPoster:
    """URL, código e QR (SVG) de entrada do evento (`/join?c=<código>`). Só administradores."""
    passwordless.require_quick_join_enabled()
    url = passwordless.event_url()
    buf = io.BytesIO()
    segno.make(url, error="m").save(buf, kind="svg", scale=10, border=2, xmldecl=False)
    response.headers["Cache-Control"] = "no-store"
    return QuickJoinPoster(url=url, code=get_settings().quick_join_secret, svg=buf.getvalue().decode())


@router.get("/quick-join/guests", response_model=GuestPage)
async def list_guests(
    _: Admin,
    db: Db,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    q: Annotated[str | None, Query(max_length=100, description="Procura no nome ou email")] = None,
) -> GuestPage:
    """Convidados que entraram pelo QR, do mais recente para o mais antigo."""
    return await passwordless.list_guests(db, offset, limit, q)


@router.post("/login", response_model=UserOut, dependencies=[Depends(auth_limiter), Depends(captcha("login"))])
async def login(body: LoginRequest, response: Response, db: Db) -> UserOut:
    user, access, refresh = await service.login(db, body.email, body.password, body.remember_me)
    _set_session(response, access, refresh, body.remember_me)
    return to_out(user)


@router.post(
    "/register",
    response_model=UserOut,
    status_code=201,
    dependencies=[Depends(auth_limiter), Depends(captcha("register"))],
)
async def register(body: RegisterRequest, response: Response, db: Db, sender: Sender) -> UserOut:
    if body.website:
        raise AppError("Could not create the account")  # honeypot: sem detalhes úteis para o bot
    user, access, refresh = await service.register(
        db, sender, body.email, body.password, body.name, body.remember_me, body.locale
    )
    _set_session(response, access, refresh, body.remember_me)
    return to_out(user)


@router.post("/refresh", status_code=204)
async def refresh(response: Response, db: Db, refresh_token: Annotated[str | None, Cookie()] = None) -> None:
    if not refresh_token:
        _clear_session(response)
        raise SessionExpiredError("No session cookie")
    access, new_refresh = await service.rotate_refresh(db, refresh_token)
    remember = bool(decode_token(new_refresh, "refresh").get("remember", True))
    _set_session(response, access, new_refresh, remember)


@router.post("/logout", status_code=204)
async def logout(response: Response, db: Db, refresh_token: Annotated[str | None, Cookie()] = None) -> None:
    await service.logout(db, refresh_token)
    _clear_session(response)


@router.get("/me", response_model=UserOut)
async def get_me(user: CurrentUser) -> UserOut:
    return to_out(user)


@router.patch("/me", response_model=UserOut)
async def update_me(body: ProfileUpdate, user: CurrentUser, db: Db) -> UserOut:
    return to_out(await service.update_profile(db, user, body.name, body.locale))


@router.post("/logout-all", status_code=204)
async def logout_all(response: Response, user: CurrentUser, db: Db) -> None:
    """Termina a sessão em todos os dispositivos."""
    await service.revoke_all_sessions(db, user.id)
    await db.commit()
    _clear_session(response)


@router.post("/verify-email", status_code=204, dependencies=[Depends(reset_limiter)])
async def verify_email(body: VerifyEmailRequest, db: Db) -> None:
    await service.verify_email(db, body.token)


@router.post(
    "/resend-verification",
    status_code=204,
    dependencies=[Depends(reset_limiter), Depends(captcha("resend_verification"))],
)
async def resend_verification(user: CurrentUser, db: Db, sender: Sender) -> None:
    await service.send_verification(db, sender, user)


@router.post(
    "/forgot-password", status_code=204, dependencies=[Depends(reset_limiter), Depends(captcha("forgot_password"))]
)
async def forgot_password(body: ForgotPasswordRequest, db: Db, sender: Sender) -> None:
    """Responde 204 exista ou não a conta: não revela que emails estão registados."""
    await service.request_password_reset(db, sender, body.email, body.locale)


@router.post(
    "/reset-password", status_code=204, dependencies=[Depends(reset_limiter), Depends(captcha("reset_password"))]
)
async def reset_password(body: ResetPasswordRequest, response: Response, db: Db) -> None:
    await service.reset_password(db, body.token, body.password)
    _clear_session(response)


@router.post("/change-password", status_code=204)
async def change_password(body: ChangePasswordRequest, response: Response, user: CurrentUser, db: Db) -> None:
    await service.change_password(db, user, body.current_password, body.new_password)
    _clear_session(response)


@router.get(
    "/google/login",
    status_code=302,
    responses={302: {"description": "Redirects to Google"}},
    response_class=RedirectResponse,
)
def google_login(
    next: Annotated[str, Query(description="Path to return to after signing in")] = "/",
    locale: Annotated[Locale, Query(description="Interface language for new accounts")] = "pt-PT",
) -> RedirectResponse:
    s = get_settings()
    if not s.google_enabled:
        raise FeatureDisabledError("Google sign-in is not configured")
    nonce = new_opaque_token()
    target = next if next.startswith("/") and not next.startswith("//") else "/"
    state = create_state_token({"nonce": nonce, "next": target, "locale": locale})
    redirect = RedirectResponse(google.authorization_url(state), status_code=302)
    _set_cookie(redirect, STATE_COOKIE, nonce, 600, REFRESH_PATH)
    return redirect


@router.get(
    "/google/callback",
    status_code=302,
    responses={302: {"description": "Returns to the app with the session created"}},
    response_class=RedirectResponse,
)
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
        return RedirectResponse(f"{base}/login?error=google_failed", status_code=302)
    try:
        claims = decode_token(state, "state")
    except ValueError:
        return RedirectResponse(f"{base}/login?error=google_failed", status_code=302)
    if not oauth_state or claims.get("nonce") != oauth_state:
        return RedirectResponse(f"{base}/login?error=google_failed", status_code=302)
    try:
        profile = await google.fetch_profile(code)
        _, access, refresh_token = await service.login_with_google(db, profile, claims.get("locale", "pt-PT"))
    except AppError as exc:
        return RedirectResponse(f"{base}/login?error={exc.code}", status_code=302)
    redirect = RedirectResponse(f"{base}{claims.get('next', '/')}", status_code=302)
    _set_session(redirect, access, refresh_token)
    redirect.delete_cookie(STATE_COOKIE, path=REFRESH_PATH)
    return redirect
