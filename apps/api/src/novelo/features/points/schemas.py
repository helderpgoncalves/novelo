"""Contrato dos pontos: saldo derivado do livro-razão, histórico paginado e anulação com motivo.

O saldo é SEMPRE calculado (`domain.points.fifo_balance`) — nunca há coluna de saldo. Os valores
configuráveis (flat, bónus, teto) vão no payload para o web os marcar «estimativa» (regra zero);
a tradução vive no web.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from novelo.domain.points import PointEntryKind


class PointsBalanceOut(BaseModel):
    """O saldo do doador e a sua decomposição, mais o estado do teto do mês (configurável, estimativa).

    `balance` é o que se pode resgatar (#65); `expiring_soon` antecipa o que cai nos próximos 30 dias
    (estimativa de UX); `expired` é o que já caiu — o doador vê a verdade, nunca um saldo eterno.
    """

    balance: int = Field(description="Pontos não expirados disponíveis (ganhos − anulações; FIFO)")
    flat: int = Field(description="Parte do saldo que veio de ganhos flat por saco recolhido e pesado")
    bonus: int = Field(description="Parte do saldo que veio de bónus de conformidade confirmados pela triagem")
    expiring_soon: int = Field(description="Parte do saldo que expira nos próximos 30 dias (estimativa de aviso)")
    expired: int = Field(description="Pontos já expirados (12 meses por ganho, FIFO)")
    monthly_cap: int = Field(description="Teto de ganhos por mês (estimativa, configurável; 0 = sem teto)")
    credited_this_month: int = Field(description="Ganhos já creditados no mês corrente (flat + bónus)")
    gain_flat_points: int = Field(
        description="Ganho flat por saco configurado (estimativa; o web desenha «+N» daqui)"
    )
    bonus_conformity_points: int = Field(
        description="Bónus de conformidade configurado (estimativa; o web desenha «+N» daqui)"
    )


class PointEntryOut(BaseModel):
    """Uma linha do livro-razão vista pelo doador: valor assinado, fontes e, nos ganhos, a expiração."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: PointEntryKind
    amount: int = Field(description="Assinado: ganhos positivos, anulação negativa")
    reason: str | None = Field(description="Motivo obrigatório na anulação em abuso; nulo nos ganhos")
    bag_code: str | None = Field(description="Saco ativado que originou o lançamento (`NVL-…`)")
    lot_code: str | None = Field(description="Lote onde o saco foi pesado ou triado (`NOV-…`)")
    expires_at: datetime | None = Field(description="Fim do ganho (12 meses); nulo em anulações")
    created_at: datetime


class PointsHistoryOut(BaseModel):
    """Página do histórico de pontos (o mais recente primeiro)."""

    items: list[PointEntryOut]
    total: int = Field(description="Total de linhas do livro-razão da conta (para paginar sem surpresas)")


class AnnulmentCreate(BaseModel):
    """Anulação em abuso (interesse legítimo declarado): valor positivo, motivo OBRIGATÓRIO — fica no
    livro-razão como entrada negativa com autor; nunca se apaga nem se edita uma linha."""

    user_id: uuid.UUID = Field(description="Conta doadora cujos pontos se anulam")
    amount: int = Field(gt=0, description="Pontos a anular (positivo; fica −no livro-razão)")
    reason: str = Field(min_length=3, max_length=2000, description="Motivo obrigatório (auditoria, RGPD art. 6.º-1-f)")
