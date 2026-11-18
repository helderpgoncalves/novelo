"""A matemática pura do RGPD: corte de retenção e prazos FIFO do saldo na altura do apagamento.

Valores calculados À MÃO (convenção de `domain/`): cada teste mostra a aritmética. Sem I/O.
"""

from datetime import UTC, datetime

from novelo.domain.points import LedgerEntry, PointEntryKind, fifo_balance
from novelo.domain.privacy import ConsentPurpose, expiry_timeline, retention_cutoff

UTCNOW = datetime(2026, 6, 1, 12, 0, tzinfo=UTC)


# --- corte de retenção: 12 meses para trás, com clamp a meses curtos -------------------------------


def test_retention_cutoff_is_exactly_twelve_months_back() -> None:
    # 17 nov 2026 − 12 meses = 17 nov 2025 (mesmo instante do dia).
    assert retention_cutoff(datetime(2026, 11, 17, 9, 30, tzinfo=UTC)) == datetime(2025, 11, 17, 9, 30, tzinfo=UTC)


def test_retention_cutoff_clamps_short_months() -> None:
    # 31 mar 2025 − 12 meses: 31 mar existe em 2024 → igual.
    assert retention_cutoff(datetime(2025, 3, 31, tzinfo=UTC)) == datetime(2024, 3, 31, tzinfo=UTC)
    # 29 fev 2024 − 12 meses: 2023 não é bissexto → clamp ao fim do mês, 28 fev.
    assert retention_cutoff(datetime(2024, 2, 29, 8, 0, tzinfo=UTC)) == datetime(2023, 2, 28, 8, 0, tzinfo=UTC)


def test_retention_cutoff_accepts_other_windows() -> None:
    # A janela é parâmetro (a política fixa 12; o teste fixa a regra do mês crescente).
    assert retention_cutoff(datetime(2026, 6, 1, tzinfo=UTC), months=3) == datetime(2026, 3, 1, tzinfo=UTC)
    # 31 mai − 3 meses = 28 fev (2026 não é bissexto).
    assert retention_cutoff(datetime(2026, 5, 31, tzinfo=UTC), months=3) == datetime(2026, 2, 28, tzinfo=UTC)


# --- prazos FIFO do saldo (o aviso antes de apagar a conta) ----------------------------------------


def _gain(amount: int, gained_at: str, expires_at: str, kind: PointEntryKind = PointEntryKind.GAIN_FLAT) -> LedgerEntry:
    return LedgerEntry(
        kind=kind,
        amount=amount,
        created_at=datetime.fromisoformat(gained_at),
        expires_at=datetime.fromisoformat(expires_at),
    )


def test_timeline_splits_balance_by_expiry_date() -> None:
    entries = [
        _gain(100, "2025-09-10T10:00+00:00", "2026-09-10T10:00+00:00"),  # flat: 12 meses
        _gain(50, "2025-12-25T10:00+00:00", "2026-12-25T10:00+00:00", PointEntryKind.GAIN_BONUS),
    ]
    # Nada consumido, nada expirado a 1 jun 2026: 100 expiram a 10 set, 50 a 25 dez.
    assert expiry_timeline(entries, now=UTCNOW) == [
        (datetime(2026, 9, 10, 10, 0, tzinfo=UTC), 100),
        (datetime(2026, 12, 25, 10, 0, tzinfo=UTC), 50),
    ]


def test_timeline_accounts_for_fifo_consumption_and_expiry() -> None:
    entries = [
        _gain(100, "2025-06-01T10:00+00:00", "2026-06-01T10:00+00:00"),  # expira A 1 jun (inclusive): caiu
        _gain(100, "2025-09-10T10:00+00:00", "2026-09-10T10:00+00:00"),
        LedgerEntry(  # anulação de 30 pontos a 5 jan 2026: consome FIFO o ganho mais antigo VIVO então (o de jun)
            kind=PointEntryKind.ANNULMENT,
            amount=-30,
            created_at=datetime(2026, 1, 5, tzinfo=UTC),
        ),
        _gain(50, "2025-12-25T10:00+00:00", "2026-12-25T10:00+00:00", PointEntryKind.GAIN_BONUS),
    ]
    # 1 jun 2026: o ganho de jun (restava 70 após a anulação) expirou por inteiro; sobram 100 e 50.
    assert expiry_timeline(entries, now=UTCNOW) == [
        (datetime(2026, 9, 10, 10, 0, tzinfo=UTC), 100),
        (datetime(2026, 12, 25, 10, 0, tzinfo=UTC), 50),
    ]


def test_timeline_is_empty_when_there_is_no_balance() -> None:
    entries = [_gain(100, "2024-06-01T10:00+00:00", "2025-06-01T10:00+00:00")]  # expirou em 2025
    assert expiry_timeline(entries, now=UTCNOW) == []


def test_timeline_total_matches_the_balance() -> None:
    entries = [
        _gain(100, "2025-08-01T10:00+00:00", "2026-08-01T10:00+00:00"),
        _gain(70, "2025-11-20T10:00+00:00", "2026-11-20T10:00+00:00", PointEntryKind.GAIN_BONUS),
        LedgerEntry(kind=PointEntryKind.REDEMPTION, amount=-20, created_at=datetime(2026, 2, 1, tzinfo=UTC)),
    ]
    timeline = expiry_timeline(entries, now=UTCNOW)
    balance = fifo_balance(entries, now=UTCNOW)
    assert sum(amount for _, amount in timeline) == balance.balance == 150  # 100+70−20


def test_consent_purposes_are_the_two_layers_of_the_adr() -> None:
    # Duas camadas separadas (marketing da Vitrus ≠ ofertas de parceiros, nunca soft opt-in).
    assert ConsentPurpose.MARKETING == "marketing"
    assert ConsentPurpose.PARTNERSHIPS == "partnerships"
