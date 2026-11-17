"""Contratos Pydantic do pedido de recolha: criação, despacho, resultado da visita e leitura.

O sujeito (cidadão ou local) deduz-se da conta de quem pede, nunca do corpo — o `address` e o
`parish_code` só valem para cidadão, e a validação cruzada fica no serviço (o esquema não sabe quem
chama). Erros sempre `{code, message, details}`.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from novelo.domain.collection_requests import CITIZEN_BAG_MAX, CITIZEN_BAG_MIN, LOCAL_BAG_HARD_MAX
from novelo.domain.vocab import (
    CollectionRequestState,
    DispatchAction,
    RequestExceptionReason,
    RequestOutcome,
    RequestSubject,
)


class CollectionRequestCreate(BaseModel):
    """O que quem pede envia: sacos, dia, e — só para cidadão — morada e freguesia.

    O teto de validação (500 no local) é o travão de sanidade do campo; acima do teto de 20 o pedido
    segue para a fila de exceções como **recolha especial** (não é erro). O teto de 5 do cidadão é
    validado no serviço, que já sabe o sujeito.
    """

    bag_count: int = Field(ge=1, le=LOCAL_BAG_HARD_MAX, description="Sacos a recolher (cidadão 1–5; local até 20)")
    requested_date: date = Field(description="Dia pretendido para a recolha (corte de 48 h: hoje + 2 dias no mínimo)")
    address: str | None = Field(
        default=None,
        max_length=280,
        description="Morada manual, só para cidadão — alternativa igual ao GPS (que fica fora do MVP)",
    )
    parish_code: str | None = Field(
        default=None,
        max_length=6,
        description="Código DICOFRE da freguesia declarada, só para cidadão: liga o pedido à ronda",
    )
    urgent: bool = Field(
        default=False,
        description="Urgência: nunca é auto-aceite — cai na fila do gestor para despacho",
    )
    note: str | None = Field(default=None, max_length=240, description="Recado para a equipa (ex.: «portão azul»)")


class DispatchRequest(BaseModel):
    """A decisão do gestor na fila de exceções: agendar (com data, que pode ser outra) ou recusar (com motivo)."""

    action: DispatchAction
    requested_date: date | None = Field(
        default=None, description="Nova data ao agendar (a fila de exceções pode sair da ronda pedida)"
    )
    reason: str | None = Field(
        default=None,
        max_length=280,
        description="Motivo da recusa (obrigatório ao recusar) ou nota do agendamento",
    )


class RequestOutcomeCreate(BaseModel):
    """O resultado da visita ao pedido agendado: recolhido, ou ausência (a 3.ª expira o pedido)."""

    outcome: RequestOutcome


class CollectionRequestOut(BaseModel):
    """Um pedido de recolha, visto por quem pediu ou pela equipa (com o pedido e o despacho)."""

    id: uuid.UUID
    subject_kind: RequestSubject = Field(description="`citizen` (com conta) ou `local` (assistido/B2B)")
    requester_id: uuid.UUID | None
    requester_email: str | None = Field(
        default=None, description="Só a equipa vê quem pediu; a leitura do próprio traz `null`"
    )
    locality_id: uuid.UUID | None = Field(default=None, description="Local institucional (só local/B2B)")
    locality_name: str | None = None
    parish_code: str | None = Field(default=None, description="DICOFRE da freguesia declarada (cidadão)")
    parish_name: str | None = None
    address: str | None = Field(
        default=None, description="Morada escrita (cidadão); `null` depois da purga de 12 meses"
    )
    bag_count: int = Field(description="Sacos pedidos (cidadão 1–5; local até 20 — teto estimativa)")
    requested_date: date
    urgent: bool
    note: str | None = None
    state: CollectionRequestState
    exception_reason: RequestExceptionReason | None = Field(
        default=None,
        description="`out_of_round`, `cutoff`, `special_volume` (recolha especial) ou `urgency`",
    )
    missed_count: int = Field(description="Ausências acumuladas; à 3.ª o pedido expira")
    dispatch_reason: str | None = Field(default=None, description="Motivo da recusa ou nota do agendamento")
    dispatched_at: datetime | None = None
    collected_at: datetime | None = None
    cancelled_at: datetime | None = None
    expired_at: datetime | None = None
    address_retained_until: datetime | None = Field(
        default=None, description="Até quando a morada fica retida (12 meses; RGPD)"
    )
    created_at: datetime


class CollectionRequestListFilters(BaseModel):
    """Filtros da leitura da equipa (`GET /collection-requests` com papel admin/operator).

    A fila de despacho é `state=exception`; tudo o resto são cortes simples sobre a lista.
    """

    state: CollectionRequestState | None = None
    subject_kind: RequestSubject | None = None
    parish_code: str | None = None
    limit: int = Field(default=200, ge=1, le=1000)


__all__ = [
    "CITIZEN_BAG_MAX",
    "CITIZEN_BAG_MIN",
    "CollectionRequestCreate",
    "CollectionRequestListFilters",
    "CollectionRequestOut",
    "DispatchRequest",
    "RequestOutcomeCreate",
]
