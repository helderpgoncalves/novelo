"""Regras dos pontos: crédito idempotente por saco, teto mensal, saldo FIFO e anulação em abuso.

Sem FastAPI nos caminhos de domínio; os routers chamam daqui. O crédito entra SEMPRE pela via
append-only (`PointEntry`, índices únicos parciais por saco) — um saco nunca ganha duas vezes, nem
com duas pesagens em corrida: a base recusa o duplicado. O teto mensal RECUSA o ganho que não cabe
(não o adia — ADR «economia dos pontos»: o teto existe para o sistema não ser jogado).

Pontos de disparo (documentados no bilhete #64):
- **flat**: na PESAGEM da unidade na paragem (`lots.service.set_unit_weight`) — é o momento em que o
  scan liga o código do saco a um peso medido; partir daí é recolhido e pesado.
- **bónus de conformidade**: na CRIAÇÃO da peça triada (`lots.service.add_item`) — a triagem compara a
  declaração do doador com o destino dominante das peças do lote (aproximação do MVP: as peças não
  estão ligadas à unidade; o lote nasce numa paragem, na regra geral de um saco por doador).
"""

import uuid
from datetime import UTC, datetime

import sqlalchemy as sa
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.config import get_settings
from novelo.core.errors import NotFoundError
from novelo.core.request_meta import RequestMeta
from novelo.domain.points import (
    LedgerEntry,
    PointEntryKind,
    apply_monthly_cap,
    declaration_confirmed,
    fifo_balance,
    gain_expiry,
)
from novelo.domain.vocab import LotUnitSource
from novelo.features.audit import service as audit
from novelo.features.citizen.models import BagActivation
from novelo.features.lots.models import Lot
from novelo.features.points.models import PointEntry
from novelo.features.points.schemas import AnnulmentCreate, PointEntryOut, PointsBalanceOut, PointsHistoryOut


def _month_start(now: datetime) -> datetime:
    """Início do mês corrente (UTC): a janela do teto mensal é o mês de calendário."""
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def _gain_credited_this_month(db: AsyncSession, user_id: uuid.UUID, now: datetime) -> int:
    """Soma dos ganhos (flat + bónus) já creditados à conta no mês corrente."""
    total = await db.scalar(
        select(func.coalesce(func.sum(PointEntry.amount), 0)).where(
            PointEntry.user_id == user_id,
            PointEntry.amount > 0,
            PointEntry.created_at >= _month_start(now),
        )
    )
    return int(total or 0)


async def _credit_gain(
    db: AsyncSession,
    *,
    kind: PointEntryKind,
    points: int,
    user_id: uuid.UUID,
    bag_code: str,
    lot_code: str | None,
    now: datetime,
) -> bool:
    """Um ganho por saco: teto mensal primeiro, depois INSERT ... ON CONFLICT DO NOTHING no índice
    parcial (flat ou bónus por saco) — idempotente ATÉ em corrida. `True` só quando entra linha nova."""
    if points <= 0:
        return False
    credited = await _gain_credited_this_month(db, user_id, now)
    fits = apply_monthly_cap(credited_this_month=credited, candidate=points, cap=get_settings().points_monthly_cap)
    if fits <= 0:
        return False  # recusado pelo teto: sem linha (o saco já teve a sua chance neste mês)
    stmt = (
        insert(PointEntry)
        .values(
            user_id=user_id,
            kind=kind,
            amount=fits,
            bag_code=bag_code,
            lot_code=lot_code,
            expires_at=gain_expiry(now),
        )
        .on_conflict_do_nothing(
            index_elements=["bag_code"],
            index_where=sa.text(f"kind = '{kind.value}' AND bag_code IS NOT NULL"),
        )
    )
    result = await db.execute(stmt)
    return bool(int(getattr(result, "rowcount", 0) or 0))


async def credit_flat_for_bag(db: AsyncSession, bag_code: str, *, lot_code: str | None = None) -> bool:
    """Ganho flat (+100, estimativa) ao saco ATIVADO recolhido e pesado. Idempotente: uma linha por saco
    no mundo. Sacos sem dono (conta apagada: `user_id` nulo) e etiquetas impressas nunca creditam."""
    now = datetime.now(UTC)
    activation = (
        await db.execute(
            select(BagActivation).where(BagActivation.code == bag_code, BagActivation.user_id.is_not(None))
        )
    ).scalar_one_or_none()
    if activation is None or activation.user_id is None:
        return False
    return await _credit_gain(
        db,
        kind=PointEntryKind.GAIN_FLAT,
        points=get_settings().points_gain_flat,
        user_id=activation.user_id,
        bag_code=bag_code,
        lot_code=lot_code,
        now=now,
    )


async def credit_confirmed_declarations(db: AsyncSession, lot: Lot) -> int:
    """Bónus (+50, estimativa) por saco do lote cuja declaração a triagem acabou de CONFIRMAR.

    Chama-se a cada peça triada que entra (`add_item`): o destino dominante das peças do lote é a
    aproximação da triagem do saco. Idempotente por saco (índice parcial): quantas peças entrem, o
    bónus entra uma só vez. Devolve quantos bónus novos entraram.
    """
    codes = [u.code for u in lot.units if u.source == LotUnitSource.BAG]
    if not codes or not lot.items:
        return 0
    activations = (
        (
            await db.execute(
                select(BagActivation).where(
                    BagActivation.code.in_(codes),
                    BagActivation.declaration.is_not(None),
                    BagActivation.user_id.is_not(None),
                )
            )
        )
        .scalars()
        .all()
    )
    destinations = [item.condition for item in lot.items]
    credited = 0
    for activation in activations:
        if activation.declaration is None or activation.user_id is None:
            continue
        if not declaration_confirmed(activation.declaration, destinations):
            continue  # contradita ou dúvida: nada (sem penalização no MVP)
        if await _credit_gain(
            db,
            kind=PointEntryKind.GAIN_BONUS,
            points=get_settings().points_bonus_conformity,
            user_id=activation.user_id,
            bag_code=activation.code,
            lot_code=lot.code,
            now=datetime.now(UTC),
        ):
            credited += 1
    return credited


# --- leitura: saldo e histórico derivam SEMPRE do livro-razão ---------------------------------------


def _to_ledger(row: PointEntry) -> LedgerEntry:
    return LedgerEntry(kind=row.kind, amount=row.amount, created_at=row.created_at, expires_at=row.expires_at)


async def balance(db: AsyncSession, user_id: uuid.UUID) -> PointsBalanceOut:
    """O saldo do doador, calculado de fresco das linhas (nunca em cache): FIFO, teto e expira breve."""
    now = datetime.now(UTC)
    rows = (
        (
            await db.execute(
                # Ordem de escrita (seq) a desempatar: dentro da transação o `created_at` é igual.
                select(PointEntry).where(PointEntry.user_id == user_id).order_by(PointEntry.created_at, PointEntry.seq)
            )
        )
        .scalars()
        .all()
    )
    balance = fifo_balance([_to_ledger(row) for row in rows], now=now)
    return PointsBalanceOut(
        balance=balance.balance,
        flat=balance.flat,
        bonus=balance.bonus,
        expiring_soon=balance.expiring_soon,
        expired=balance.expired,
        monthly_cap=get_settings().points_monthly_cap,
        credited_this_month=await _gain_credited_this_month(db, user_id, now),
    )


async def history(db: AsyncSession, user_id: uuid.UUID, *, limit: int = 20, offset: int = 0) -> PointsHistoryOut:
    """O livro-razão do próprio, o mais recente primeiro, paginado (auditável, mas só o que é dele)."""
    total = int(await db.scalar(select(func.count()).select_from(PointEntry).where(PointEntry.user_id == user_id)) or 0)
    rows = (
        (
            await db.execute(
                select(PointEntry)
                .where(PointEntry.user_id == user_id)
                .order_by(PointEntry.created_at.desc(), PointEntry.seq.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return PointsHistoryOut(
        items=[PointEntryOut.model_validate(row) for row in rows],
        total=total,
    )


# --- anulação em abuso (interesse legítimo declarado) -----------------------------------------------


async def annul(db: AsyncSession, admin_id: uuid.UUID, body: AnnulmentCreate, meta: RequestMeta) -> PointEntryOut:
    """Anular pontos em abuso: entrada NEGATIVA com motivo obrigatório e autor — nunca se apaga nem
    se edita linha. O consumo é FIFO no saldo (e nunca fica negativo: `domain.points.fifo_balance`)."""
    from novelo.features.users.models import User  # noqa: PLC0415  (evita ciclo no arranque)

    if await db.get(User, body.user_id) is None:
        raise NotFoundError("User not found")
    entry = PointEntry(
        user_id=body.user_id,
        kind=PointEntryKind.ANNULMENT,
        amount=-body.amount,
        reason=body.reason,
        actor_id=admin_id,
    )
    db.add(entry)
    await audit.record(
        db,
        "points.annul",
        actor_id=admin_id,
        target_type="user",
        target_id=body.user_id,
        meta=meta,
        details={"amount": -body.amount, "reason": body.reason},
    )
    await db.commit()
    await db.refresh(entry)
    return PointEntryOut.model_validate(entry)


__all__ = [
    "annul",
    "balance",
    "credit_confirmed_declarations",
    "credit_flat_for_bag",
    "history",
]
