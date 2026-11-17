"""Pontos: expiração FIFO, teto mensal e saldo — tudo calculado à mão (o domínio é puro, sem I/O).

Os valores são os pressupostos de lançamento (estimativa, configurável): +100 flat por saco recolhido
e pesado, +50 de bónus de conformidade, teto mensal de 500, expiração 12 meses por ganho. Cada teste
diz a aritmética — é a especificação que #65 (catálogo/resgate) consome pela função `fifo_balance`.
"""

from datetime import UTC, datetime

from novelo.domain.points import (
    EXPIRY_MONTHS,
    GAIN_FLAT_POINTS,
    LedgerEntry,
    PointEntryKind,
    apply_monthly_cap,
    declaration_confirmed,
    fifo_balance,
    gain_expiry,
)
from novelo.domain.vocab import BagDeclaration, TextileDestination

NOW = datetime(2026, 11, 17, 12, 0, tzinfo=UTC)


# --- expiração: 12 meses por ganho ----------------------------------------------------------------


def test_gain_expires_after_exactly_12_months() -> None:
    # 1 jun 2025 + 12 meses = 1 jun 2026: no próprio dia já não conta (expirou).
    earned = datetime(2025, 6, 1, 10, 0, tzinfo=UTC)
    assert gain_expiry(earned) == datetime(2026, 6, 1, 10, 0, tzinfo=UTC)
    assert EXPIRY_MONTHS == 12


def test_gain_expiry_clamps_short_months() -> None:
    # 31 mar + 12 meses = 31 mar; 30 nov 2024 + 12 meses cai em 30 nov 2025 (sem dia 31, fica no fim do mês).
    assert gain_expiry(datetime(2024, 11, 30, 0, 0, tzinfo=UTC)) == datetime(2025, 11, 30, 0, 0, tzinfo=UTC)


# --- teto mensal: o ganho que não cabe é RECUSADO, nunca adiado -----------------------------------


def test_cap_accepts_gains_that_fit_exactly() -> None:
    # Teto 500: 4 sacos já creditaram 400; o 5.º (100) cabe ao exactly (400 + 100 = 500).
    assert apply_monthly_cap(credited_this_month=400, candidate=GAIN_FLAT_POINTS, cap=500) == 100


def test_cap_refuses_the_gain_that_overflows() -> None:
    # 450 creditados + candidato 100 = 550 > 500: recusado a inteiro (não há crédito parcial).
    assert apply_monthly_cap(credited_this_month=450, candidate=100, cap=500) == 0


def test_cap_refuses_when_already_full() -> None:
    assert apply_monthly_cap(credited_this_month=500, candidate=100, cap=500) == 0


def test_cap_zero_means_no_cap() -> None:
    # 0 = sem teto (configurável): o ganho entra sempre.
    assert apply_monthly_cap(credited_this_month=10_000, candidate=100, cap=0) == 100


def test_cap_counts_flat_and_bonus_together() -> None:
    # O teto é por conta e por mês sobre TODOS os ganhos: 480 (flat+bónus) + bónus 50 = 530 > 500 → recusado.
    assert apply_monthly_cap(credited_this_month=480, candidate=50, cap=500) == 0


# --- saldo FIFO: o livro-razão deriva sempre o saldo (nunca há coluna em cache) --------------------


def _gain(amount: int, earned_at: datetime, kind: PointEntryKind = PointEntryKind.GAIN_FLAT) -> LedgerEntry:
    return LedgerEntry(kind=kind, amount=amount, created_at=earned_at, expires_at=gain_expiry(earned_at))


def test_balance_of_two_open_gains() -> None:
    entries = [
        _gain(100, datetime(2026, 1, 10, tzinfo=UTC)),  # flat: expira 2027-01-10
        _gain(50, datetime(2026, 3, 1, tzinfo=UTC), kind=PointEntryKind.GAIN_BONUS),  # expira 2027-03-01
    ]
    saldo = fifo_balance(entries, now=NOW)
    assert (saldo.balance, saldo.flat, saldo.bonus) == (150, 100, 50)
    assert saldo.expiring_soon == 0 and saldo.expired == 0


def test_gain_12_months_and_1_day_old_is_expired() -> None:
    entries = [_gain(100, datetime(2025, 6, 1, tzinfo=UTC))]  # expira 2026-06-01
    before = fifo_balance(entries, now=datetime(2026, 5, 31, 23, 59, tzinfo=UTC))
    after = fifo_balance(entries, now=datetime(2026, 6, 2, 0, 0, 1, tzinfo=UTC))
    assert before.balance == 100
    assert (after.balance, after.expired) == (0, 100)  # caiu do saldo e conta como expirado


def test_expiring_soon_counts_gains_within_30_days_of_now() -> None:
    # Ganho de 2025-12-01 expira 2026-12-01: a 17 nov faltam 14 dias ≤ 30 → «expira brevemente».
    entries = [
        _gain(100, datetime(2025, 12, 1, tzinfo=UTC)),
        _gain(50, datetime(2026, 6, 1, tzinfo=UTC)),  # expira 2027-06-01: longe
    ]
    saldo = fifo_balance(entries, now=NOW)
    assert saldo.expiring_soon == 100
    assert saldo.balance == 150


def test_fifo_consumes_oldest_gain_first() -> None:
    # Flat 100 (jan) + flat 100 (fev); anulação de 150 em mar consome o de janeiro inteiro e 50 do de fevereiro.
    entries = [
        _gain(100, datetime(2026, 1, 10, tzinfo=UTC)),
        _gain(100, datetime(2026, 2, 10, tzinfo=UTC)),
        LedgerEntry(kind=PointEntryKind.ANNULMENT, amount=-150, created_at=datetime(2026, 3, 1, tzinfo=UTC)),
    ]
    saldo = fifo_balance(entries, now=NOW)
    assert saldo.balance == 50
    assert saldo.expired == 0


def test_annulment_consumes_flat_before_bonus_when_older() -> None:
    # Flat 100 (jan) e bónus 50 (mar): anular 100 consome o flat (o mais antigo); resta o bónus.
    entries = [
        _gain(100, datetime(2026, 1, 10, tzinfo=UTC)),
        _gain(50, datetime(2026, 3, 1, tzinfo=UTC), kind=PointEntryKind.GAIN_BONUS),
        LedgerEntry(kind=PointEntryKind.ANNULMENT, amount=-100, created_at=datetime(2026, 4, 1, tzinfo=UTC)),
    ]
    saldo = fifo_balance(entries, now=NOW)
    assert (saldo.balance, saldo.flat, saldo.bonus) == (50, 0, 50)


def test_consumption_cannot_resurrect_or_go_negative() -> None:
    # Ganho que já expirou não volta: uma anulação posterior consome o que há de não expirado (nada) → 0.
    entries = [
        _gain(100, datetime(2025, 6, 1, tzinfo=UTC)),  # expira 2026-06-01
        LedgerEntry(kind=PointEntryKind.ANNULMENT, amount=-100, created_at=datetime(2026, 7, 1, tzinfo=UTC)),
    ]
    saldo = fifo_balance(entries, now=datetime(2026, 7, 2, tzinfo=UTC))
    assert (saldo.balance, saldo.expired) == (0, 100)


def test_consumption_before_a_gain_does_not_touch_it() -> None:
    # Anulação de 100 em jan; o ganho é de fev: a anulação não o toca (ordem cronológica).
    entries = [
        _gain(100, datetime(2026, 2, 1, tzinfo=UTC)),
        LedgerEntry(kind=PointEntryKind.ANNULMENT, amount=-100, created_at=datetime(2026, 1, 15, tzinfo=UTC)),
    ]
    saldo = fifo_balance(entries, now=NOW)
    assert saldo.balance == 100


def test_fifo_order_is_independent_of_input_order() -> None:
    # O livro-razão chega ordenado por quem o lê; a função ordena por dentro (mesmo resultado nas duas ordens).
    a = _gain(100, datetime(2026, 1, 10, tzinfo=UTC))
    b = _gain(100, datetime(2026, 2, 10, tzinfo=UTC))
    nul = LedgerEntry(kind=PointEntryKind.ANNULMENT, amount=-150, created_at=datetime(2026, 3, 1, tzinfo=UTC))
    assert fifo_balance([b, nul, a], now=NOW) == fifo_balance([a, b, nul], now=NOW)


def test_redemption_kind_consumes_like_annulment() -> None:
    # `redemption` é do #65, mas o saldo já sabe consumi-lo FIFO — o contrato fica provado agora.
    entries = [
        _gain(100, datetime(2026, 1, 10, tzinfo=UTC)),
        LedgerEntry(kind=PointEntryKind.REDEMPTION, amount=-40, created_at=datetime(2026, 5, 1, tzinfo=UTC)),
    ]
    saldo = fifo_balance(entries, now=NOW)
    assert saldo.balance == 60


# --- resgate (#65): o gasto FIFO com exemplos trabalhados ------------------------------------------


def test_redemption_spends_oldest_first_across_two_gains() -> None:
    # Dois ganhos 800 (1 jan, flat) + 700 (1 fev, bónus); resgate de 1 200 em 1 mar come o de janeiro
    # INTEIRO e 400 do de fevereiro: restam 300 — todos do bónus (flat = 0, bonus = 300).
    entries = [
        _gain(800, datetime(2026, 1, 1, tzinfo=UTC)),
        _gain(700, datetime(2026, 2, 1, tzinfo=UTC), kind=PointEntryKind.GAIN_BONUS),
        LedgerEntry(kind=PointEntryKind.REDEMPTION, amount=-1200, created_at=datetime(2026, 3, 1, tzinfo=UTC)),
    ]
    saldo = fifo_balance(entries, now=NOW)
    assert (saldo.balance, saldo.flat, saldo.bonus, saldo.expired) == (300, 0, 300, 0)


def test_redemption_after_expiry_spends_only_what_survived() -> None:
    # Ganho de 800 a 1 jan 2025 expira 1 jan 2026. Resgate de 500 a 1 fev 2026: os 800 já caíram
    # (expired), o resgate não os toca — saldo 0, sem milagre.
    entries = [
        _gain(800, datetime(2025, 1, 1, tzinfo=UTC)),
        LedgerEntry(kind=PointEntryKind.REDEMPTION, amount=-500, created_at=datetime(2026, 2, 1, tzinfo=UTC)),
    ]
    saldo = fifo_balance(entries, now=datetime(2026, 2, 2, tzinfo=UTC))
    assert (saldo.balance, saldo.expired) == (0, 800)


def test_redemption_between_expiries_consumes_the_dying_gain_first() -> None:
    # 800 (1 jan 2025, expira 1 jan 2026) + 700 (1 jun 2025, expira 1 jun 2026). Resgate 500 em
    # dez 2025 come o de janeiro (fica 300). A 2 jan 2026 esses 300 CAEM (expired = 300): sobram 700.
    # Novo resgate de 500 a 2 fev 2026: saldo fica 200 — o gasto nunca ressuscita o expirado.
    # (O livro-razão é dado como existe em cada momento: os lançamentos futuros ainda não existem.)
    ganhos = [
        _gain(800, datetime(2025, 1, 1, tzinfo=UTC)),
        _gain(700, datetime(2025, 6, 1, tzinfo=UTC), kind=PointEntryKind.GAIN_BONUS),
    ]
    um_resgate = [
        *ganhos,
        LedgerEntry(kind=PointEntryKind.REDEMPTION, amount=-500, created_at=datetime(2025, 12, 1, tzinfo=UTC)),
    ]
    dois_resgates = [
        *um_resgate,
        LedgerEntry(kind=PointEntryKind.REDEMPTION, amount=-500, created_at=datetime(2026, 2, 1, tzinfo=UTC)),
    ]
    before = fifo_balance(um_resgate, now=datetime(2025, 12, 2, tzinfo=UTC))
    assert (before.balance, before.flat, before.bonus) == (1000, 300, 700)
    after_first_expiry = fifo_balance(um_resgate, now=datetime(2026, 1, 2, tzinfo=UTC))
    assert (after_first_expiry.balance, after_first_expiry.expired) == (700, 300)
    after_second_redemption = fifo_balance(dois_resgates, now=datetime(2026, 2, 2, tzinfo=UTC))
    assert (after_second_redemption.balance, after_second_redemption.expired) == (200, 300)
    assert fifo_balance(ganhos, now=datetime(2025, 11, 1, tzinfo=UTC)).balance == 1500  # antes de tudo


def test_redemption_bigger_than_balance_leaves_zero_never_negative() -> None:
    # Saldo 300 (700 − 400 gastos); um resgate de 1 200 (serviço recusa, mas se entrasse na base)
    # comeria o que há: saldo 0, nunca negativo. O shortfall é decisão do SERVIÇO (409), não do domínio.
    entries = [
        _gain(700, datetime(2026, 1, 1, tzinfo=UTC)),
        LedgerEntry(kind=PointEntryKind.REDEMPTION, amount=-400, created_at=datetime(2026, 2, 1, tzinfo=UTC)),
        LedgerEntry(kind=PointEntryKind.REDEMPTION, amount=-1200, created_at=datetime(2026, 3, 1, tzinfo=UTC)),
    ]
    saldo = fifo_balance(entries, now=NOW)
    assert saldo.balance == 0


def test_empty_ledger_has_zero_balance() -> None:
    saldo = fifo_balance([], now=NOW)
    assert (saldo.balance, saldo.flat, saldo.bonus, saldo.expiring_soon, saldo.expired) == (0, 0, 0, 0, 0)


# --- bónus de conformidade: a triagem confirma (ou não) a declaração «Vai no saco?» ---------------


def test_declared_reuse_confirmed_when_reuse_dominates() -> None:
    # 3 peças reutilizáveis, 1 recicável: domina reuse → declaração «reuse» confirmada.
    reuse = [TextileDestination.REUSE] * 3 + [TextileDestination.RECYCLE]
    assert declaration_confirmed(BagDeclaration.REUSE, reuse) is True


def test_declared_recycle_confirmed_when_recycle_dominates() -> None:
    recycle_wins = [TextileDestination.RECYCLE, TextileDestination.RECYCLE, TextileDestination.REUSE]
    assert declaration_confirmed(BagDeclaration.RECYCLE, recycle_wins) is True


def test_contradicted_declaration_credits_nothing() -> None:
    # Declarou «reuse», a triagem diz recycle a dominar: nada (sem penalização no MVP).
    recycle_wins = [TextileDestination.RECYCLE, TextileDestination.RECYCLE, TextileDestination.REUSE]
    assert declaration_confirmed(BagDeclaration.REUSE, recycle_wins) is False


def test_tie_and_empty_never_confirm() -> None:
    # Empate (2/2) é dúvida: recusa conservadora, sem crédito. Sem peças triadas também.
    assert declaration_confirmed(BagDeclaration.REUSE, [TextileDestination.REUSE, TextileDestination.RECYCLE]) is False
    assert declaration_confirmed(BagDeclaration.RECYCLE, []) is False


def test_reject_does_not_confirm_either_declaration() -> None:
    # Dominar «reject» (sujo, molhado) não confirma «reuse» nem «recycle»: o que é rejeitado nem devia entrar.
    assert (
        declaration_confirmed(
            BagDeclaration.RECYCLE, [TextileDestination.REJECT, TextileDestination.REJECT, TextileDestination.RECYCLE]
        )
        is False
    )
