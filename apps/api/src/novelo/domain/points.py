"""Pontos: a matemática pura do livro-razão — expiração FIFO de 12 meses, teto mensal e saldo.

Sem I/O, sem SQLAlchemy, sem FastAPI: as funções recebem entradas simples (`LedgerEntry`) e devolvem
valores calculados à mão nos testes (`tests/unit/test_points.py`). É o contrato que #65 (catálogo e
resgate) consome — o saldo é SEMPRE derivado do livro-razão, nunca uma coluna em cache.

Economia (ADR «economia dos pontos»): crédito por saco ativado, nunca por kg; os valores de lançamento
são pressuposto (estimativa, configuráveis por ambiente em `core/config.py`), nunca números de fonte.
"""

from __future__ import annotations

import calendar
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from novelo.domain.vocab import BagDeclaration, TextileDestination

# --- pressupostos de lançamento (estimativa): a feature layer pode sobrepor por ambiente ------------

# Ganho flat por saco ativado recolhido E pesado (nunca por kg — ADR #35).
GAIN_FLAT_POINTS = 100
# Bónus de conformidade: a triagem confirmou a declaração «Vai no saco?» do doador.
BONUS_CONFORMITY_POINTS = 50
# Teto mensal de ganhos por conta (0 = sem teto); além dele o ganho é RECUSADO (não adiado) —
# o teto existe para o sistema não ser jogado, e adiar crédito exigiria estado pendente.
MONTHLY_CAP_POINTS = 500
# Um ganho vale 12 meses; a seguir expira (FIFO: os mais antigos saem primeiro).
EXPIRY_MONTHS = 12
# Janela de «expira brevemente» do saldo (estimativa de UX para o aviso do ecrã).
EXPIRING_SOON_DAYS = 30


def gain_expiry(earned_at: datetime, months: int = EXPIRY_MONTHS) -> datetime:
    """O momento em que um ganho expira: `months` meses depois de ganho (o dia fica, o mês cresce).

    1 jun + 12 meses = 1 jun do ano seguinte; 30 nov + 12 = 30 nov (meses curtos clampam ao fim do mês).
    """
    month_index = earned_at.month - 1 + months
    year = earned_at.year + month_index // 12
    month = month_index % 12 + 1
    day = min(earned_at.day, calendar.monthrange(year, month)[1])
    return earned_at.replace(year=year, month=month, day=day)


def apply_monthly_cap(credited_this_month: int, candidate: int, cap: int) -> int:
    """O ganho do mês entra por inteiro se o teto ainda o acolhe; se transbordar, é RECUSADO (não adiado).

    Sem crédito parcial: mais simples de explicar ao doador e de auditar no livro-razão — ou entra,
    ou não entra. `cap = 0` desliga o teto. O teto é por conta e conta flat e bónus juntos.
    """
    if cap <= 0:
        return candidate
    return candidate if credited_this_month + candidate <= cap else 0


def declaration_confirmed(declaration: BagDeclaration, destinations: Sequence[TextileDestination]) -> bool:
    """A triagem confirma a declaração «Vai no saco?» do doador?

    O destino DOMINANTE das peças triadas tem de ser ESTRITAMENTE o da declaração: «reuse» exige
    maioria reutilizável (os 4 graus A–D), «recycle» exige maioria recicável. Empate, zero peças
    triadas ou dominância de «reject» NÃO confirmam — a dúvida nunca credita (e nunca penaliza no MVP).
    """
    counts = Counter(destinations)
    wanted = TextileDestination(declaration.value)
    others = max((n for dest, n in counts.items() if dest is not wanted), default=0)
    return counts[wanted] > others


@dataclass(frozen=True)
class Balance:
    """O saldo derivado do livro-razão a um dado momento (nunca guardado: calculado sempre que se lê).

    `balance` é o que se pode resgatar; `flat`/`bonus` repartem-no pela origem; `expiring_soon` é a parte
    que cai nos próximos `EXPIRING_SOON_DAYS` dias (aviso do ecrã); `expired` é o que já caiu.
    """

    balance: int
    flat: int
    bonus: int
    expiring_soon: int
    expired: int


def fifo_balance(entries: list[LedgerEntry], now: datetime) -> Balance:
    """Saldo não expirado, consumido FIFO: os negativos comem os ganhos MAIS ANTIGOS primeiro.

    Processa por ordem cronológica: um negativo (anulação, resgate) consome até ao que existe de ganho
    ainda não expirado naquele momento; nunca fica saldo negativo nem um expirado volta. Ganho expira
    em `expires_at` (inclusive: no próprio dia já não conta).
    """

    @dataclass
    class _Slot:
        remaining: int
        expires_at: datetime
        kind: PointEntryKind

    queue: list[_Slot] = []
    expired = 0

    def _expire(deadline: datetime) -> None:
        """Ganhos que morreram até `deadline` saem da fila e contam como expirados (não se comem mais)."""
        nonlocal expired
        alive = []
        for slot in queue:
            if slot.expires_at <= deadline:
                expired += slot.remaining
            else:
                alive.append(slot)
        queue[:] = alive

    for entry in sorted(entries, key=lambda e: e.created_at):
        _expire(entry.created_at)  # o que já expirou não pode ser consumido por este lançamento
        if entry.amount >= 0:
            if entry.expires_at is not None:
                queue.append(_Slot(remaining=entry.amount, expires_at=entry.expires_at, kind=entry.kind))
            continue
        to_consume = -entry.amount
        for slot in queue:
            if to_consume <= 0:
                break
            take = min(to_consume, slot.remaining)
            slot.remaining -= take
            to_consume -= take

    _expire(now)  # o resto até `now`: caiu, conta como expirado
    balance = flat = bonus = expiring_soon = 0
    for slot in queue:
        if slot.remaining <= 0:
            continue
        balance += slot.remaining
        if slot.kind is PointEntryKind.GAIN_FLAT:
            flat += slot.remaining
        else:
            bonus += slot.remaining
        if (slot.expires_at - now).days < EXPIRING_SOON_DAYS:
            expiring_soon += slot.remaining
    return Balance(balance=balance, flat=flat, bonus=bonus, expiring_soon=expiring_soon, expired=expired)


class PointEntryKind(StrEnum):
    """Tipos de lançamento do livro-razão (imutável: nunca se atualiza nem se apaga uma linha).

    `redemption` fica reservado ao #65 (catálogo e resgate): o valor e o CHECK da tabela já o aceitam,
    mas nenhum caminho de código o escreve até lá.
    """

    GAIN_FLAT = "gain_flat"  # +flat por saco recolhido e pesado
    GAIN_BONUS = "gain_bonus"  # +bónus de conformidade confirmado pela triagem
    ANNULMENT = "annulment"  # anulação em abuso (interesse legítimo): negativa, com motivo obrigatório
    REDEMPTION = "redemption"  # reservado ao #65 — resgate por código pseudónimo


@dataclass(frozen=True)
class LedgerEntry:
    """Uma linha do livro-razão, já materializada: tipo, valor assinado e momentos.

    `expires_at` só existe em ganhos (flat e bónus); anulações e resgates não expiram — consomem.
    """

    kind: PointEntryKind
    amount: int  # assinado: ganhos positivos, anulação/resgate negativos
    created_at: datetime
    expires_at: datetime | None = None
