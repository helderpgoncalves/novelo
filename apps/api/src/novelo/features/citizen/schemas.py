"""Contrato do cidadão: conta de doador, sacos ativados, histórico e agenda pública.

Os números com regra vão aqui como limites (teto de sacos, idade mínima como erro dedicado); as
traduções vivem no web. Nada de dados do doador sai para endpoints públicos — os sacos e o QR de
conta só se leem autenticado.
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from novelo.domain.bags import MAX_ACTIVE_BAGS
from novelo.domain.vocab import BagDeclaration
from novelo.features.planning.schemas import PublicAgendaEntry

DonorLocale = Literal["pt-PT", "en"]


class DonorSignUpRequest(BaseModel):
    """Conta de doador por email, sem password: idade DECLARADA (13+; abaixo é recusa explícita) e
    consentimento RGPD (conta e crédito = contrato, ADR #49)."""

    email: EmailStr
    declared_age: int = Field(
        ge=0, le=120, description="Idade declarada; tudo abaixo de 13 é recusa explícita (`age_below_minimum`)"
    )
    consent: Literal[True] = Field(description="Aceitação do tratamento de dados; tem de ser true")
    locale: DonorLocale = "pt-PT"
    website: str | None = Field(
        default=None,
        max_length=200,
        description="Honeypot: campo invisível que o web deixa vazio; qualquer valor é tratado como bot",
    )


class DonorAccountOut(BaseModel):
    """A conta de doador vista por quem nela entra: pseudónimo do QR de conta e a idade declarada."""

    id: uuid.UUID
    email: str
    name: str | None
    donor_code: str | None = Field(description="Pseudónimo do QR de conta (`NVA-…`); nulo em contas antigas")
    declared_age: int | None
    created_at: datetime


class DonorQrOut(BaseModel):
    """QR em SVG (fundo branco, como o passaporte) e o código que ele codifica."""

    code: str = Field(description="`NVA-XXXXXX` (conta) ou `NVL-XXXXXX` (saco): é o payload inteiro do QR")
    svg: str = Field(description="QR em SVG; o código é o payload — o ecrã da viatura lê-o offline")


class BagActivationCreate(BaseModel):
    """Ativar um saco da plataforma: apelido privado opcional e a declaração «Vai no saco?» opcional."""

    nickname: str | None = Field(default=None, max_length=80, description="Apelido PRIVADO (nunca é público)")
    declaration: BagDeclaration | None = Field(
        default=None,
        description="«Vai no saco?»: `reuse` (vestir de novo) ou `recycle` (dar a vida); base do bónus de conformidade",
    )

    @field_validator("nickname")
    @classmethod
    def _clean_nickname(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = " ".join(value.split())
        return value or None


class BagActivationUpdate(BaseModel):
    """Corrigir o apelido ou a declaração enquanto o saco está ativo (desativado congela)."""

    nickname: str | None = Field(default=None, max_length=80)
    declaration: BagDeclaration | None = None

    @field_validator("nickname")
    @classmethod
    def _clean_nickname(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = " ".join(value.split())
        return value or None


class BagActivationOut(BaseModel):
    """Um saco ativado, visto pelo dono. `active` é `deactivated_at is null`."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    code: str
    nickname: str | None
    declaration: BagDeclaration | None
    declared_at: datetime | None
    active: bool
    created_at: datetime


class CollectionHistoryOut(BaseModel):
    """Uma linha do histórico do doador: o saco e o lote que o levou (link só para o passaporte público).

    O lote chega por `lot_units.code == bag code` — é o scan da viatura que faz a ligação; sem scan o
    saco ainda está em casa (`lot_code` nulo). O passaporte nunca mostra o doador.
    """

    bag_id: uuid.UUID
    bag_code: str
    nickname: str | None
    declaration: BagDeclaration | None
    activated_at: datetime
    lot_code: str | None = Field(default=None, description="Código do lote: abre `/passport/{code}`")
    lot_state: str | None = None
    weight_kg: float | None = Field(default=None, description="Peso medido na paragem (ou estimado, legado)")
    collected_at: datetime | None = Field(default=None, description="Quando a paragem deu origem ao lote")


class CollectionAgendaOut(BaseModel):
    """A agenda pública «onde e quando entrego»: as rondas publicadas do cenário mais recente.

    `agenda` nulo = nenhum cenário publicado tem agenda (política fixa antiga): a página diz que ainda
    não há promessa publicada — nunca inventa dias.
    """

    agenda: list[PublicAgendaEntry] | None
    scenario_label: str | None = Field(default=None, description="De que cenário vem a agenda")
    updated_at: datetime | None = Field(default=None, description="Quando o cenário foi calculado")


__all__ = [
    "MAX_ACTIVE_BAGS",
    "BagActivationCreate",
    "BagActivationOut",
    "BagActivationUpdate",
    "CollectionAgendaOut",
    "CollectionHistoryOut",
    "DonorAccountOut",
    "DonorLocale",
    "DonorQrOut",
    "DonorSignUpRequest",
]
