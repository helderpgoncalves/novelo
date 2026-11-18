"""RGPD da conta de doador: a matemática pura — corte de retenção e prazos FIFO do saldo.

Sem I/O, sem SQLAlchemy, sem FastAPI: valores calculados à mão nos testes (`tests/unit/test_privacy.py`).
As decisões vivem no ADR «RGPD da conta de doador» (docs/engenharia/adr/): logs de autenticação 12 meses,
consentimento em duas camadas, apagamento perde o saldo com aviso prévio (saldo + prazos).
"""

from __future__ import annotations

import calendar
from collections.abc import Sequence
from datetime import datetime
from enum import StrEnum

from novelo.domain.points import LedgerEntry, fifo_balance

# Logs de OTP/magic link conservados 12 meses (categoria própria na política de privacidade; ADR #49).
LOGIN_LOG_RETENTION_MONTHS = 12


def retention_cutoff(now: datetime, months: int = LOGIN_LOG_RETENTION_MONTHS) -> datetime:
    """O corte de retenção: `months` meses antes de `now` (o dia fica, o mês recua; clamp a meses curtos).

    17 nov 2026 − 12 = 17 nov 2025; 29 fev 2024 − 12 = 28 fev 2023 (2023 não é bissexto). É o mesmo
    calendário de `domain.points.gain_expiry`, a correr para trás.
    """
    month_index = now.month - 1 - months
    year = now.year + month_index // 12
    month = month_index % 12 + 1
    day = min(now.day, calendar.monthrange(year, month)[1])
    return now.replace(year=year, month=month, day=day)


class ConsentPurpose(StrEnum):
    """As finalidades que EXIGEM consentimento (prévio e expresso, em duas camadas; nunca soft opt-in).

    O essencial da conta (crédito, recolhas, triagem) é contrato — não anda aqui. Marketing e parcerias
    têm caixas próprias, desligadas por defeito, retiráveis a qualquer momento (art. 7.º/3 RGPD).
    """

    MARKETING = "marketing"  # comunicações de marketing da Vitrus
    PARTNERSHIPS = "partnerships"  # ofertas de parceiros: ZERO partilha por defeito (só o código de resgate)


def expiry_timeline(entries: Sequence[LedgerEntry], *, now: datetime) -> list[tuple[datetime, int]]:
    """O calendário FIFO do saldo: quantos pontos caem em cada data de expiração futura.

    Derivado SEMPRE de `fifo_balance` (a única fonte da verdade do saldo): para cada data de expiração
    futura distinta, o saldo naquela altura menos o saldo na data anterior é o que cai ali. A anulação e
    o resgate já aconteceram (estão no passado), por isso o saldo só decresce por expiração — a diferença
    é exata. Entradas expiradas no `now` não entram (já caíram; o `Balance.expired` do saldo conta-as).
    """
    deadlines = sorted({e.expires_at for e in entries if e.expires_at is not None and e.expires_at > now})
    timeline: list[tuple[datetime, int]] = []
    previous_balance = fifo_balance(list(entries), now=now).balance
    for deadline in deadlines:
        balance_at = fifo_balance(list(entries), now=deadline).balance
        drop = previous_balance - balance_at
        if drop > 0:
            timeline.append((deadline, drop))
        previous_balance = balance_at
    return timeline


__all__ = [
    "LOGIN_LOG_RETENTION_MONTHS",
    "ConsentPurpose",
    "expiry_timeline",
    "retention_cutoff",
]
