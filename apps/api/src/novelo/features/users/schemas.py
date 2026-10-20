import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from novelo.features.users.models import ApprovalStatus, JoinedVia, Role

Locale = Literal["pt-PT", "en"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    avatar_url: str | None
    role: Role
    joined_via: JoinedVia
    has_password: bool
    google_linked: bool
    email_verified: bool
    locale: Locale
    approval_status: ApprovalStatus = Field(
        description="`pending`/`rejected`: a conta autentica-se mas todas as rotas protegidas devolvem 403"
    )


class UserAdminOut(BaseModel):
    """Visão de administração: inclui estado da conta e último acesso."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    role: Role
    joined_via: JoinedVia
    is_active: bool
    email_verified: bool
    google_linked: bool
    last_login_at: datetime | None
    created_at: datetime
    approval_status: ApprovalStatus
    approved_at: datetime | None
    rejected_reason: str | None


class ImpersonationOut(BaseModel):
    """Estado de impersonação da sessão atual. `active=false` (e o resto nulo) numa sessão normal."""

    active: bool = False
    admin_id: uuid.UUID | None = Field(default=None, description="Administrador real que está a impersonar")
    admin_name: str | None = Field(default=None, description="Nome (ou email) do administrador real")
    expires_at: datetime | None = Field(default=None, description="Fim fixo da sessão; não é renovável")


ChecklistItem = Literal["scenario", "copilot", "map"]


class OnboardingOut(BaseModel):
    """Estado da introdução guiada da conta (vale em todos os dispositivos)."""

    tour_seen_at: datetime | None = Field(default=None, description="Quando a introdução foi vista ou saltada")
    checklist_done: list[ChecklistItem] = Field(
        default_factory=list, description="Primeiros passos já feitos (cenário e copiloto deduzem-se dos dados)"
    )
    checklist_dismissed: bool = Field(default=False, description="A pessoa dispensou o checklist")


class OnboardingUpdate(BaseModel):
    tour: Literal["seen", "reset"] | None = Field(
        default=None, description="`seen` marca a introdução como vista; `reset` volta a oferecê-la"
    )
    mark: ChecklistItem | None = Field(default=None, description="Marca um primeiro passo como feito")
    checklist_dismissed: bool | None = Field(default=None, description="Dispensa (ou repõe) o checklist")


class MeOut(UserOut):
    """`/auth/me`: o utilizador da sessão (o impersonado, se houver impersonação) e o estado de impersonação."""

    impersonation: ImpersonationOut = Field(default_factory=ImpersonationOut)
    onboarding: OnboardingOut = Field(default_factory=OnboardingOut)
    pending_approvals: int | None = Field(
        default=None, description="Só para administradores: contas à espera de aprovação (badge do menu)"
    )


class ApprovalStatusOut(BaseModel):
    """Estado de aprovação da conta da sessão (leve, para o ecrã de espera fazer polling)."""

    status: ApprovalStatus
    email_verified: bool
    rejected_reason: str | None
    decided_at: datetime | None = Field(description="Quando foi aprovada")


class UsersSummary(BaseModel):
    pending_approvals: int
    total: int


class ApproveRequest(BaseModel):
    role: Role = "operator"
    confirm_admin: bool = Field(default=False, description="Obrigatório (true) quando `role` é `admin`")
    notify: bool = Field(default=True, description="Enviar o email «A tua conta foi aprovada»")


class RejectRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=300, description="Motivo, mostrado à pessoa se existir")
    notify: bool = Field(default=False, description="Enviar um email neutro a avisar que não foi aprovada")

    @field_validator("reason")
    @classmethod
    def _reason(cls, value: str | None) -> str | None:
        return " ".join(value.split()) or None if value else None


class UserAdminUpdate(BaseModel):
    role: Role | None = None
    is_active: bool | None = None
    confirm_admin: bool = Field(
        default=False, description="Obrigatório (true) para dar o papel `admin`; ignorado nos restantes casos"
    )


class DeleteUserRequest(BaseModel):
    confirm_email: str = Field(
        min_length=3, max_length=255, description="Email do utilizador a eliminar, escrito de novo (anti-engano)"
    )


class ImpersonateRequest(BaseModel):
    reason: str = Field(max_length=300, description="Motivo (mínimo 10 caracteres); fica na auditoria")

    @field_validator("reason")
    @classmethod
    def _reason(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 10:
            raise ValueError("Reason must have at least 10 characters")
        return value


class ImpersonationStarted(BaseModel):
    user: UserOut = Field(description="O utilizador impersonado (a sessão passa a ser dele)")
    impersonation: ImpersonationOut


InvitationStatus = Literal["pending", "accepted", "expired", "revoked"]


class InvitationCreate(BaseModel):
    email: EmailStr
    name: str | None = Field(default=None, max_length=120)
    role: Role = "operator"
    locale: Locale = "pt-PT"
    message: str | None = Field(default=None, max_length=500, description="Texto livre que aparece no email")
    confirm_admin: bool = Field(default=False, description="Obrigatório (true) quando `role` é `admin`")

    @field_validator("name", "message")
    @classmethod
    def _clean(cls, value: str | None) -> str | None:
        cleaned = " ".join(value.split()) if value else ""
        return cleaned or None


class InvitationOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None
    role: Role
    locale: Locale
    message: str | None
    status: InvitationStatus
    invited_by_id: uuid.UUID | None
    invited_by_name: str | None
    created_at: datetime
    expires_at: datetime
    accepted_at: datetime | None
    revoked_at: datetime | None
    last_sent_at: datetime | None
    send_count: int
    email_delivered: bool = Field(description="O fornecedor de email aceitou o último envio; false = reenviar")


class InvitationPage(BaseModel):
    items: list[InvitationOut]
    total: int
    offset: int
    limit: int


class InvitationPreview(BaseModel):
    """O que a página de aceitar convite mostra antes de pedir o nome (só com um token válido)."""

    email: str
    name: str | None
    role: Role
    locale: Locale
    invited_by_name: str | None
    message: str | None
    expires_at: datetime


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    locale: Locale | None = None
