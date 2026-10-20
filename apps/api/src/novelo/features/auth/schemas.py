import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from novelo.features.users.schemas import Locale, UserOut

PASSWORD_MIN = 10


def password_problem(value: str) -> str | None:
    """Motivo pelo qual a password não serve, ou `None`. Fonte única (registo, reset, convite e `seed_admin`)."""
    if value.strip() != value or len(value) < PASSWORD_MIN or len(value) > 128:
        return f"Password must be at least {PASSWORD_MIN} characters with no surrounding spaces"
    return None


def _check_password(value: str) -> str:
    problem = password_problem(value)
    if problem:
        raise ValueError(problem)
    return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    remember_me: bool = True


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)
    name: str | None = Field(default=None, max_length=120)
    remember_me: bool = True
    locale: Locale = "pt-PT"
    website: str | None = Field(
        default=None,
        max_length=200,
        description="Honeypot: campo invisível que o web deixa vazio; qualquer valor é tratado como bot",
    )

    _pw = field_validator("password")(_check_password)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    locale: Locale = "pt-PT"  # idioma do email se a conta ainda não tiver preferência


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(max_length=128)

    _pw = field_validator("password")(_check_password)


class ChangePasswordRequest(BaseModel):
    current_password: str | None = Field(default=None, max_length=128)
    new_password: str = Field(max_length=128)

    _pw = field_validator("new_password")(_check_password)


class AuthConfig(BaseModel):
    google_enabled: bool
    registration_open: bool
    magic_link_enabled: bool = Field(
        description="Há transporte de email utilizável: o link por email é a entrada principal"
    )
    quick_join_enabled: bool = Field(description="A entrada por QR do evento está ligada")
    turnstile_enabled: bool = Field(
        description="As rotas públicas exigem o cabeçalho `X-Turnstile-Token` (Cloudflare Turnstile)"
    )
    turnstile_site_key: str | None = Field(description="Chave pública do widget; null se o Turnstile não estiver ativo")
    password_min_length: int = PASSWORD_MIN
    approval_required: bool = Field(
        default=True, description="Contas novas (password ou Google) ficam à espera de aprovação de um administrador"
    )


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class MagicLinkRequest(BaseModel):
    email: EmailStr
    next: str | None = Field(
        default=None,
        max_length=255,
        description="Caminho relativo para onde voltar depois de entrar; outra coisa é ignorada (vai para `/`)",
    )
    locale: Locale = "pt-PT"  # idioma do email se a conta ainda não tiver preferência


class MagicLinkVerifyRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class SignedIn(BaseModel):
    """Sessão iniciada (cookies definidos). `next` é o caminho relativo guardado quando o link foi pedido."""

    user: UserOut
    next: str = Field(description="Caminho relativo seguro para onde navegar a seguir")


class QuickJoinRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    code: str = Field(min_length=1, max_length=128, description="Código do evento (vem no QR)")
    consent: Literal[True] = Field(description="Aceitação do tratamento de dados; tem de ser true")
    locale: Locale = "pt-PT"
    website: str | None = Field(
        default=None,
        max_length=200,
        description="Honeypot: campo invisível que o web deixa vazio; qualquer valor é tratado como bot",
    )

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Name must not be blank")
        return value


class QuickJoinResult(BaseModel):
    """`signed_in`: conta nova, sessão iniciada. `check_email`: o email já tem conta e recebeu um link de entrada."""

    status: Literal["signed_in", "check_email"]
    user: UserOut | None = Field(default=None, description="Só quando `status` é `signed_in`")


class QuickJoinPoster(BaseModel):
    url: str = Field(description="URL de entrada do evento: `${APP_URL}/join?c=<código>`")
    code: str = Field(description="Código do evento")
    svg: str = Field(description="QR em SVG para o URL")


class QuickJoinInfo(BaseModel):
    enabled: bool
    consent_version: str = Field(description="Versão do texto de consentimento que fica registada")


class GuestOut(BaseModel):
    id: uuid.UUID
    name: str | None
    email: str
    email_verified: bool
    is_active: bool
    joined_at: datetime
    last_login_at: datetime | None
    actions_count: int = Field(description="Mensagens ao copiloto mais ações propostas")
    consent_at: datetime | None
    consent_version: str | None


class GuestPage(BaseModel):
    items: list[GuestOut]
    total: int
    offset: int
    limit: int


class InvitationTokenRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class AcceptInvitationRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    name: str = Field(min_length=1, max_length=120)
    password: str | None = Field(
        default=None,
        max_length=128,
        description="Opcional: sem password a pessoa entra por link enviado por email",
    )

    @field_validator("password")
    @classmethod
    def _pw(cls, value: str | None) -> str | None:
        return None if value is None else _check_password(value)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Name must not be blank")
        return value
