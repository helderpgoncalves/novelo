import io
from typing import Annotated, cast

import segno
from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSender, get_email_sender
from novelo.core.captcha import captcha
from novelo.core.config import get_settings
from novelo.core.database import get_db
from novelo.core.deps import CurrentUser, NotImpersonating, SessionUser, require_role
from novelo.core.errors import (
    AppError,
    ConflictError,
    FeatureDisabledError,
    InvalidCredentialsError,
    RateLimitError,
    SessionExpiredError,
)
from novelo.core.ratelimit import (
    auth_limiter,
    client_ip,
    invite_accept_limiter,
    invite_preview_limiter,
    login_account_limiter,
    magic_email_limiter,
    magic_link_limiter,
    magic_verify_limiter,
    quick_join_code_limiter,
    quick_join_email_limiter,
    quick_join_limiter,
    register_limiter,
    registration_resend_limiter,
    reset_limiter,
    verify_cooldown_limiter,
)
from novelo.core.request_meta import Meta
from novelo.core.security import (
    create_access_token,
    create_state_token,
    decode_token,
    hash_token,
    new_opaque_token,
)
from novelo.features.auth import cookies, entry, google, passwordless, service
from novelo.features.auth.schemas import (
    AcceptInvitationRequest,
    AuthConfig,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GuestPage,
    InvitationTokenRequest,
    LoginRequest,
    MagicLinkRequest,
    MagicLinkVerifyRequest,
    QuickJoinInfo,
    QuickJoinPoster,
    QuickJoinRequest,
    QuickJoinResult,
    RegisterRequest,
    RegistrationInfo,
    ResetPasswordRequest,
    SignedIn,
    VerifyEmailRequest,
)
from novelo.features.email_log import monitor
from novelo.features.email_log import service as email_log
from novelo.features.email_log.schemas import DeliveryStatusOrNone
from novelo.features.users import approvals, impersonation, invitations, onboarding, open_registration
from novelo.features.users import service as users_service
from novelo.features.users.models import ApprovalStatus, User
from novelo.features.users.schemas import (
    ApprovalStatusOut,
    ImpersonationOut,
    InvitationPreview,
    Locale,
    MeOut,
    OnboardingOut,
    OnboardingUpdate,
    ProfileUpdate,
    UserOut,
)
from novelo.features.users.service import to_out

router = APIRouter()  # os erros comuns são declarados no include_router (main.py)

Db = Annotated[AsyncSession, Depends(get_db)]
Sender = Annotated[EmailSender, Depends(get_email_sender)]
Admin = Annotated[User, Depends(require_role("admin"))]

_set_cookie = cookies.set_cookie
_set_session = cookies.set_session
_clear_session = cookies.clear_session
STATE_COOKIE = cookies.STATE_COOKIE
REFRESH_PATH = cookies.REFRESH_PATH


@router.get("/config", response_model=AuthConfig)
async def get_auth_config(db: Db) -> AuthConfig:
    """O que o ecrã de entrada precisa de saber: Google ligado? registo permitido? precisa de aprovação?"""
    s = get_settings()
    return AuthConfig(
        google_enabled=s.google_enabled,
        registration_open=s.allow_registration,
        magic_link_enabled=s.magic_link_enabled,
        quick_join_enabled=s.quick_join_active,
        turnstile_enabled=s.turnstile_enabled,
        turnstile_site_key=s.turnstile_site if s.turnstile_enabled and s.turnstile_secret else None,
        approval_required=not await open_registration.is_open(db),
    )


@router.get("/registration", response_model=RegistrationInfo)
async def get_registration_info(db: Db) -> RegistrationInfo:
    """Público (sem sessão): o registo está aberto? Com `open=true` quem se regista entra logo, sem esperar pela
    aprovação de um administrador. Não expõe mais nada."""
    return RegistrationInfo(open=get_settings().allow_registration and await open_registration.is_open(db))


def _user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


@router.post("/magic-link", status_code=204, dependencies=[Depends(magic_link_limiter), Depends(captcha("magic_link"))])
async def request_magic_link(body: MagicLinkRequest, request: Request, db: Db, sender: Sender, meta: Meta) -> None:
    """Envia um email, SEMPRE, e responde 204 exista ou não a conta: link de entrada (15 min, uso único) para contas
    ativas; aviso sem link para contas desativadas/recusadas; o convite de novo para quem só tem convite; e um
    email neutro para o resto. Se o email não puder sair responde 503 `email_unavailable` (igual para todos)."""
    s = get_settings()
    if not s.magic_link_enabled:
        raise FeatureDisabledError("Email sign-in is not available")
    try:
        magic_email_limiter.check(f"magic-email:{hash_token(body.email.lower())}")
    except RateLimitError:
        return  # em silêncio: não permite encher a caixa de alguém nem sondar contas
    await entry.request_entry(
        db,
        sender,
        body.email,
        flow="magic_link",
        locale=body.locale,
        next_path=body.next,
        ip=client_ip(request),
        user_agent=_user_agent(request),
        meta=meta,
    )


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
    body: QuickJoinRequest, request: Request, response: Response, db: Db, sender: Sender, meta: Meta
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
        db, sender, name=body.name, email=body.email, locale=body.locale, ip=ip, user_agent=_user_agent(request),
        meta=meta,
    )  # fmt: skip
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
    """Credenciais erradas: sempre a mesma resposta. Além do limite por IP, há um limite de falhas por CONTA
    (independente do IP), que também responde igual para emails que não existem."""
    max_failures = get_settings().login_account_max_failures
    account_key = f"login-account:{hash_token(body.email.strip().lower())}"
    if login_account_limiter.is_blocked(account_key, max_failures):
        raise RateLimitError("Too many attempts. Try again in a few minutes.")
    try:
        user, access, refresh = await service.login(db, body.email, body.password, body.remember_me)
    except InvalidCredentialsError:
        login_account_limiter.check(account_key, max_failures)
        raise
    _set_session(response, access, refresh, body.remember_me)
    return to_out(user)


@router.post(
    "/register",
    response_model=UserOut,
    status_code=201,
    dependencies=[Depends(auth_limiter), Depends(register_limiter), Depends(captcha("register"))],
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
async def refresh(request: Request, response: Response, db: Db) -> None:
    refresh_token = cookies.read_cookie(request, cookies.REFRESH_COOKIE)
    if not refresh_token:
        _clear_session(response)
        raise SessionExpiredError("No session cookie")
    access, new_refresh = await service.rotate_refresh(db, refresh_token)
    remember = bool(decode_token(new_refresh, "refresh").get("remember", True))
    _set_session(response, access, new_refresh, remember)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, db: Db) -> None:
    await impersonation.end_by_token(db, cookies.read_cookie(request, cookies.ACCESS_COOKIE))
    await service.logout(db, cookies.read_cookie(request, cookies.REFRESH_COOKIE))
    _clear_session(response)


def _impersonation_out(user: User) -> ImpersonationOut:
    info = user.impersonation
    if info is None:
        return ImpersonationOut()
    return ImpersonationOut(active=True, admin_id=info.admin_id, admin_name=info.admin_name, expires_at=info.expires_at)


@router.get("/me", response_model=MeOut)
async def get_me(user: SessionUser, db: Db, sender: Sender) -> MeOut:
    """O utilizador da sessão (mesmo com a conta por aprovar, para o ecrã de espera). Em impersonação é o impersonado
    e `impersonation` traz o administrador real. Para administradores traz `pending_approvals` e `email_alerts`
    (e dispara, no máximo 1x por dia, o lembrete de contas por aprovar há mais de 24 h)."""
    pending = alerts = None
    if user.role == "admin" and user.impersonation is None and user.approval_status == "approved":
        await approvals.remind_if_overdue(db, sender)
        alerts = len(await monitor.admin_tick(db, sender))
        await db.refresh(user)  # um erro de monitorização pode ter feito rollback e expirado o objeto
        pending = await users_service.count_pending(db)
    return MeOut(
        **to_out(user).model_dump(),
        impersonation=_impersonation_out(user),
        onboarding=await onboarding.build(db, user),
        pending_approvals=pending,
        email_alerts=alerts,
    )


@router.put("/me/onboarding", response_model=OnboardingOut, dependencies=[NotImpersonating])
async def update_onboarding(body: OnboardingUpdate, user: CurrentUser, db: Db) -> OnboardingOut:
    """Guarda o progresso da introdução guiada (vista/saltada/repetir, primeiros passos). Não vale em impersonação."""
    return await onboarding.update(db, user, body)


@router.get("/approval-status", response_model=ApprovalStatusOut)
async def get_approval_status(user: SessionUser, db: Db) -> ApprovalStatusOut:
    """Leve, para o ecrã de espera fazer polling (e redirecionar quando `status` passa a `approved`).
    Funciona com a conta `pending` ou `rejected`; `confirmation_email` diz se o aviso «recebemos o teu pedido» saiu."""
    mail = (await email_log.latest_for_user(db, [user.id], ("registration_received",))).get(user.id)
    return ApprovalStatusOut(
        confirmation_email=cast(DeliveryStatusOrNone, mail.status) if mail else "none",
        status=cast(ApprovalStatus, user.approval_status),
        email_verified=user.email_verified,
        rejected_reason=user.rejected_reason if user.approval_status == "rejected" else None,
        decided_at=user.approved_at,
    )


@router.post("/resend-registration-email", status_code=204, dependencies=[NotImpersonating])
async def resend_registration_email(user: SessionUser, db: Db, sender: Sender) -> None:
    """Para quem aguarda aprovação: reenvia «recebemos o teu pedido» (2 por hora). 503 se não sair."""
    if user.approval_status != "pending":
        raise ConflictError("Only accounts waiting for approval can request this email")
    registration_resend_limiter.check(f"registration-resend:{user.id}")
    await service.send_registration_received(db, sender, user, strict=True)


@router.post("/impersonation/stop", response_model=UserOut)
async def stop_impersonation(response: Response, user: CurrentUser, db: Db, meta: Meta) -> UserOut:
    """Termina a impersonação e devolve a sessão ao administrador real (o cookie de acesso passa a ser o dele)."""
    admin = await impersonation.stop(db, user, meta)
    cookies.set_access(response, create_access_token(admin.id, admin.role), get_settings().access_token_minutes * 60)
    return to_out(admin)


@router.post("/invitations/preview", response_model=InvitationPreview, dependencies=[Depends(invite_preview_limiter)])
async def preview_invitation(body: InvitationTokenRequest, db: Db) -> InvitationPreview:
    """Mostra a quem foi o convite (email, papel, quem convidou) para a página de aceitar. Só com um token válido."""
    return await invitations.preview(db, body.token)


@router.post(
    "/invitations/accept",
    response_model=SignedIn,
    dependencies=[Depends(invite_accept_limiter)],
)
async def accept_invitation(body: AcceptInvitationRequest, response: Response, db: Db, meta: Meta) -> SignedIn:
    """Aceita o convite: cria a conta (email verificado, nome e password opcional) e inicia uma sessão de 30 dias.
    O token só funciona uma vez. Sem password a pessoa volta a entrar por link enviado por email.
    Sem captcha: o token de uso único já é o segredo; o limitador por IP trava tentativas."""
    user, access, refresh = await invitations.accept(db, body.token, body.name, body.password, meta)
    _set_session(response, access, refresh, True)
    return SignedIn(user=to_out(user), next="/")


@router.patch("/me", response_model=UserOut, dependencies=[NotImpersonating])
async def update_me(body: ProfileUpdate, user: CurrentUser, db: Db) -> UserOut:
    name_given = "name" in body.model_fields_set
    return to_out(await service.update_profile(db, user, body.name, body.locale, name_given=name_given))


@router.post("/logout-all", status_code=204, dependencies=[NotImpersonating])
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
    dependencies=[Depends(reset_limiter), NotImpersonating],
)
async def resend_verification(user: SessionUser, db: Db, sender: Sender) -> None:
    """Reenvia o email de verificação (uma vez por minuto). Sem captcha: exige sessão iniciada.
    503 `email_unavailable` se o email não puder sair."""
    verify_cooldown_limiter.check(f"verify-cooldown:{user.id}")
    await service.send_verification(db, sender, user, strict=True)


@router.post(
    "/forgot-password", status_code=204, dependencies=[Depends(reset_limiter), Depends(captcha("forgot_password"))]
)
async def forgot_password(body: ForgotPasswordRequest, request: Request, db: Db, sender: Sender, meta: Meta) -> None:
    """Responde 204 exista ou não a conta e envia SEMPRE um email (link de recuperação, aviso de conta inativa,
    o convite de novo ou o email neutro «não encontrámos uma conta»). 503 `email_unavailable` se não puder sair."""
    await entry.request_entry(
        db,
        sender,
        body.email,
        flow="password_reset",
        locale=body.locale,
        ip=client_ip(request),
        user_agent=_user_agent(request),
        meta=meta,
    )


@router.post("/reset-password", status_code=204, dependencies=[Depends(reset_limiter)])
async def reset_password(body: ResetPasswordRequest, response: Response, db: Db) -> None:
    """Define a nova password com o token do email (uso único). Sem captcha: o token já é o segredo."""
    await service.reset_password(db, body.token, body.password)
    _clear_session(response)


@router.post("/change-password", status_code=204, dependencies=[NotImpersonating])
async def change_password(body: ChangePasswordRequest, response: Response, user: CurrentUser, db: Db) -> None:
    await service.change_password(db, user, body.current_password, body.new_password)
    _clear_session(response)


@router.get(
    "/google/login",
    status_code=302,
    responses={302: {"description": "Redirects to Google"}},
    response_class=RedirectResponse,
    dependencies=[NotImpersonating],
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
    sender: Sender,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    s = get_settings()
    oauth_state = cookies.read_cookie(request, cookies.STATE_COOKIE)
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
        account, access, refresh_token = await service.login_with_google(
            db, profile, claims.get("locale", "pt-PT"), sender
        )
    except AppError as exc:
        return RedirectResponse(f"{base}/login?error={exc.code}", status_code=302)
    target = claims.get("next", "/") if account.approval_status == "approved" else "/pending-approval"
    redirect = RedirectResponse(f"{base}{target}", status_code=302)
    _set_session(redirect, access, refresh_token)
    cookies.delete_cookie(redirect, STATE_COOKIE, REFRESH_PATH)
    return redirect
