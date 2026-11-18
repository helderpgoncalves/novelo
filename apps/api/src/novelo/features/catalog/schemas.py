"""Contrato do catálogo e resgate (#65): três prateleiras, códigos pseudónimos e campanhas.

A âncora € (`donation_value_cents`) é APRESENTAÇÃO do valor do donativo IPSS — nunca o valor dos
pontos («pontos não são dinheiro»). Os erros de forma do item (âncora € só em donativo, parceiro só
em prémio) saem como 422 `validation_error` com os campos; os CHECKs da base voltam a fechar a porta.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from novelo.domain.catalog import CatalogItemKind, PartnerState, RedemptionState

# --- catálogo --------------------------------------------------------------------------------------


class CatalogItemCreate(BaseModel):
    """Criar um item: a forma é fechada — âncora € SÓ em donativo IPSS, parceiro OBRIGATÓRIO em prémio."""

    name: str = Field(min_length=3, max_length=120)
    kind: CatalogItemKind
    points_cost: int = Field(gt=0, description="Pontos que o resgate debita (FIFO, saldo nunca negativo)")
    donation_value_cents: int | None = Field(
        default=None, gt=0, description="APENAS donativo IPSS: valor do donativo em cêntimos (1 000 pts ≈ 5 €)"
    )
    active: bool = True
    partner_id: uuid.UUID | None = Field(default=None, description="Obrigatório no prémio de parceiro")
    description: str | None = Field(default=None, max_length=2000)
    stock: int | None = Field(default=None, ge=0, description="Nulo = sem limite; 0 = esgotado")

    @model_validator(mode="after")
    def _shape(self) -> "CatalogItemCreate":
        fields: list[str] = []
        if (self.kind is CatalogItemKind.IPSS_DONATION) != (self.donation_value_cents is not None):
            fields.append("donation_value_cents")  # só o donativo IPSS tem âncora €
        if (self.kind is CatalogItemKind.PARTNER_PRIZE) != (self.partner_id is not None):
            fields.append("partner_id")  # o prémio é cedido por um parceiro; as outras prateleiras não
        if fields:
            raise ValueError(f"Item shape invalid for kind '{self.kind.value}': {', '.join(fields)}")
        return self


class CatalogItemUpdate(BaseModel):
    """Editar um item: campos parciais; a forma é revalidada sobre o estado resultante no serviço."""

    name: str | None = Field(default=None, min_length=3, max_length=120)
    points_cost: int | None = Field(default=None, gt=0)
    donation_value_cents: int | None = Field(default=None, gt=0)
    active: bool | None = None
    partner_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=2000)
    stock: int | None = Field(default=None, ge=0)


class CatalogItemOut(BaseModel):
    """Um item do catálogo visto pela EQUIPA: inclui inativos e o parceiro (pseudónimo zero-dados fica)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    kind: CatalogItemKind
    points_cost: int
    donation_value_cents: int | None = Field(description="Só no donativo IPSS: valor APRESENTADO do donativo")
    active: bool
    partner_id: uuid.UUID | None
    partner_name: str | None = None
    description: str | None
    stock: int | None
    created_at: datetime


class CatalogItemPublic(BaseModel):
    """Um item visto pelo DOADOR: só o que ele precisa para escolher — nunca dados internos do parceiro."""

    id: uuid.UUID
    name: str
    kind: CatalogItemKind
    points_cost: int
    donation_value_cents: int | None = Field(
        description="Só no donativo IPSS: «este resgate vale um donativo de X €» — nunca é o valor dos pontos"
    )
    partner_name: str | None = None
    description: str | None
    stock: int | None = Field(description="Nulo = sem limite; 0 = esgotado (não se pode resgatar)")


# --- parceiros -------------------------------------------------------------------------------------


class PartnerCreate(BaseModel):
    """Propor um parceiro: a freguesia propõe (nasce `proposed`), a Vitrus aprova depois.

    `parish_code` é o dicofre do zoneamento (o mesmo que o simulador e o pedido de recolha usam);
    a API resolve-o para a freguesia (404 se não existir) — o web nunca precisa de UUIDs.
    """

    name: str = Field(min_length=3, max_length=120)
    parish_code: str | None = Field(
        default=None, min_length=6, max_length=6, description="Dicofre da freguesia proponente"
    )
    description: str | None = Field(default=None, max_length=2000)
    contact: str | None = Field(default=None, max_length=200, description="Contato da equipa; nunca sai para o doador")


class PartnerUpdate(BaseModel):
    """Editar parceiro: dados descritivos; o estado vai pelos portões `approve`/`deactivate`."""

    name: str | None = Field(default=None, min_length=3, max_length=120)
    parish_code: str | None = Field(default=None, min_length=6, max_length=6)
    description: str | None = Field(default=None, max_length=2000)
    contact: str | None = Field(default=None, max_length=200)


class PartnerOut(BaseModel):
    """Um parceiro: estado de vida (proposto/aprovado/em pausa) e quem propôs."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    state: PartnerState
    parish_id: uuid.UUID | None
    parish_code: str | None = Field(
        default=None, description="Dicofre da freguesia proponente (vazio se a proposta veio da equipa)"
    )
    parish_name: str | None = Field(default=None, description="Nome da freguesia proponente, para a mesa da equipa")
    description: str | None
    contact: str | None
    proposed_by_id: uuid.UUID | None
    created_at: datetime


# --- campanhas -------------------------------------------------------------------------------------


class CampaignCreate(BaseModel):
    """Campanha sazonal de pontos: janela, descrição e multiplicador opcional do ganho flat (US40)."""

    name: str = Field(min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    starts_at: datetime
    ends_at: datetime = Field(description="Tem de ser DEPOIS de `starts_at` (422 caso contrário)")
    gain_multiplier: float = Field(
        default=1.0,
        gt=0,
        le=10,
        description="Multiplica o ganho flat por saco creditado na janela (estimativa, configurável; 1 = informativa)",
    )


class CampaignUpdate(BaseModel):
    """Editar campanha: nome, descrição, janela e multiplicador; a ordem da janela revalida-se no serviço."""

    name: str | None = Field(default=None, min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    gain_multiplier: float | None = Field(default=None, gt=0, le=10)


class CampaignOut(BaseModel):
    """Uma campanha: o web mostra-a ao doador enquanto `starts_at ≤ agora < ends_at`."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    starts_at: datetime
    ends_at: datetime
    gain_multiplier: float = Field(description="Multiplicador do ganho flat na janela (estimativa; 1 = informativa)")
    created_at: datetime


# --- resgates --------------------------------------------------------------------------------------


class RedemptionCreate(BaseModel):
    """Resgatar um item do catálogo: o saldo FIFO é debitado e nasce um código pseudónimo."""

    item_id: uuid.UUID


class RedemptionValidate(BaseModel):
    """Validar um código apresentado (equipa, no MVP; portal do parceiro fica para depois)."""

    code: str = Field(min_length=3, max_length=16, description="O código `RDM-…` tal como o parceiro o leu")


class RedemptionOut(BaseModel):
    """Um resgate visto pelo doador OU pela equipa na validação: o código e o seu estado de vida."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str = Field(description="`RDM-XXXXXX`: a ÚNICA coisa que o parceiro vê — zero dados do doador")
    state: RedemptionState
    item_name: str
    item_kind: CatalogItemKind
    partner_name: str | None
    points_spent: int
    donation_value_cents: int | None
    validated_at: datetime | None
    created_at: datetime
