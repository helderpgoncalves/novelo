"""Contratos Pydantic do RGPD do doador: consentimentos, exportação, pré-aviso e confirmação."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from novelo.domain.privacy import ConsentPurpose
from novelo.domain.vocab import BagDeclaration, CollectionRequestState, RequestSubject
from novelo.features.points.schemas import PointsBalanceOut

# De onde veio a decisão de consentimento (o toggle da carteira é a via normal; `api` fica para o histórico).
ConsentSource = Literal["account", "api"]

__all__ = ["ConsentSource"]


# --- política pública ------------------------------------------------------------------------------


# `PolicyOut` e filhas já são os schemas do endpoint público (uma só fonte: policy.py).


# --- consentimentos (duas camadas, registo auditável) -----------------------------------------------


class ConsentStateOut(BaseModel):
    """O estado corrente de uma finalidade: a última linha vence; sem linhas é desligado e nunca pedido."""

    purpose: ConsentPurpose
    granted: bool
    policy_version: str | None = None
    updated_at: datetime | None = None


class ConsentsOut(BaseModel):
    """As DUAS camadas (marketing e parcerias), sempre ambas, com o estado corrente de cada uma."""

    items: list[ConsentStateOut]


class ConsentUpdate(BaseModel):
    """Uma decisão: finalidade + dado ou retirado (o histórico fica append-only lá atrás)."""

    purpose: ConsentPurpose
    granted: bool
    source: ConsentSource = "account"


# --- exportação (portabilidade, art. 20.º) ----------------------------------------------------------


class ExportProfile(BaseModel):
    """O perfil fornecido pelo titular: identificador, nome opcional, pseudónimo, idade declarada."""

    email: str
    name: str | None
    donor_code: str | None
    declared_age: int | None
    locale: str
    joined_via: str
    created_at: datetime


class ExportConsent(BaseModel):
    purpose: str
    granted: bool
    policy_version: str
    source: str
    created_at: datetime


class ExportBag(BaseModel):
    code: str
    nickname: str | None
    declaration: BagDeclaration | None
    active: bool
    created_at: datetime
    deactivated_at: datetime | None


class ExportRequest(BaseModel):
    subject_kind: RequestSubject
    address: str | None
    parish_code: str | None
    bag_count: int
    requested_date: str
    urgent: bool
    state: CollectionRequestState
    created_at: datetime


class ExportPointEntry(BaseModel):
    kind: str
    amount: int
    bag_code: str | None
    lot_code: str | None
    reason: str | None
    created_at: datetime
    expires_at: datetime | None


class AccountExportOut(BaseModel):
    """A conta inteira, legível por máquina (JSON). Só dados FORNECIDOS ou OBSERVADOS — nunca
    derivados (sem calibração, sem pontuações de conformidade: WP29 242 rev.01, p. 10)."""

    exported_at: datetime
    policy_version: str
    profile: ExportProfile
    consents: list[ExportConsent]
    bags: list[ExportBag]
    collection_requests: list[ExportRequest]
    points: list[ExportPointEntry]


# --- apagar a conta (três proteções do ADR) ---------------------------------------------------------


class TimelineItem(BaseModel):
    """Uma data de expiração FIFO e quantos pontos caem nela (o calendário do saldo)."""

    expires_at: datetime
    amount: int


class DeletionPreviewOut(BaseModel):
    """O pré-aviso OBRIGATÓRIO antes de apagar: saldo atual, prazos FIFO e o que se perde.

    `points_are_not_money` é o texto decidido no ADR («pontos não são dinheiro nem conversíveis») —
    o web escreve-o sempre neste ecrã; a API assinala que a regra se aplica.
    """

    balance: PointsBalanceOut
    timeline: list[TimelineItem]
    active_bags: int
    bags: int
    requests: int
    points_entries: int
    points_are_not_money: bool = True
    # Onde gastar antes (a segunda proteção: resgatar é possível até confirmar o apagamento).
    redeem_hint_path: str = "/cidadao?tab=saldo"


class DeletionRequest(BaseModel):
    """A confirmação: o email da conta, escrito à mão (a 3.ª proteção é o texto no ecrã; esta é a trava)."""

    confirm_email: str = Field(min_length=3, max_length=255)
