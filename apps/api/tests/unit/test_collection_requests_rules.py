"""Regras do pedido de recolha, calculadas à mão: morada, limites, corte de 48 h, ausências, retenção.

Tudo em `domain/collection_requests.py` é puro — sem FastAPI, sem base de dados. Os valores esperados
saem da aritmética escrita nos comentários, como no resto de `domain/`.
"""

import pytest

from novelo.domain.collection_requests import (
    CITIZEN_BAG_MAX,
    LOCAL_BAG_MAX,
    MAX_ABSENCES,
    address_retained_until,
    apply_outcome,
    bag_limits,
    bags_out_of_range,
    decide,
    is_special_volume,
    locality_address_key,
    normalize_address,
    passes_cutoff,
)
from novelo.domain.vocab import CollectionRequestState, RequestExceptionReason, RequestOutcome, RequestSubject


# --- morada normalizada: a chave de «1 ativo por morada» ---------------------------------------


def test_normalization_folds_case_accents_punctuation_and_spacing() -> None:
    # Duas escritas da mesma morada têm de dar a mesma chave
    a = normalize_address("Rua de Santa Maria, N.º 42, 2.º Esq.")
    b = normalize_address("  rua   DE santa MARIA nº42 — 2º esq ")
    assert a == "rua de santa maria n 42 2 esq"
    assert b == a


def test_normalization_folds_accents_and_ordinals() -> None:
    assert normalize_address("Rua de Guimarães, 7") == "rua de guimaraes 7"
    assert normalize_address("Rua de Guimarães 7") == "rua de guimaraes 7"
    # 3ºDto e 3.º Dto. são o mesmo sítio
    assert normalize_address("Casa do Gato, 3ºDto") == "casa do gato 3 dto"
    assert normalize_address("Casa do Gato, 3.º Dto.") == normalize_address("Casa do Gato, 3ºDto")
    assert normalize_address("Tv.ª do Areeiro, n° 5") == "tv do areeiro n 5"


def test_normalization_is_lexical_not_semantic() -> None:
    # Decisão: não expandimos abreviações (Av. ≠ Avenida) — a chave é lexical, nunca geocodificação.
    assert normalize_address("Av. 5 de Outubro, 12") != normalize_address("Avenida 5 de Outubro, 12")
    assert normalize_address("Av. 5 de Outubro, 12") == "av 5 de outubro 12"


def test_normalization_handles_blank_input() -> None:
    assert normalize_address("") == ""
    assert normalize_address("   \n\t ") == ""
    # a API valida morada não vazia; o domínio devolve a chave vazia sem rebentar
    assert normalize_address("A") == "a"


def test_locality_address_key_is_namespaced_and_stable() -> None:
    # O local não escreve morada: a chave institucional vem do sítio e nunca colide com uma morada
    # escrita (a normalização de moradas nunca produz «:» — o prefixo garante o espaço de nomes).
    key = locality_address_key("01234567-89ab-cdef-0123-456789abcdef")
    assert key == "localidade:01234567-89ab-cdef-0123-456789abcdef"
    assert ":" not in normalize_address("Rua do Dois Pontos: 1")


# --- limites de sacos: cidadão 1–5, local 1–20 (teto B2B, estimativa) --------------------------


def test_citizen_bag_limits_are_one_to_five() -> None:
    assert (CITIZEN_BAG_MAX, LOCAL_BAG_MAX) == (5, 20)
    assert bag_limits(RequestSubject.CITIZEN) == (1, 5)
    assert bag_limits(RequestSubject.LOCAL) == (1, 20)
    assert bags_out_of_range(RequestSubject.CITIZEN, 1) is False
    assert bags_out_of_range(RequestSubject.CITIZEN, 5) is False
    assert bags_out_of_range(RequestSubject.CITIZEN, 0) is True
    assert bags_out_of_range(RequestSubject.CITIZEN, 6) is True
    assert bags_out_of_range(RequestSubject.LOCAL, 20) is False
    assert bags_out_of_range(RequestSubject.LOCAL, 21) is False  # 21+ é recolha especial, não erro


def test_special_volume_is_above_the_local_ceiling() -> None:
    # «B2B: teto de 20 sacos — estimativa; acima = recolha especial» (decisão da spec #54)
    assert is_special_volume(20) is False
    assert is_special_volume(21) is True
    assert is_special_volume(100) is True


# --- corte de 48 h: dois dias completos de margem ----------------------------------------------


def test_cutoff_requires_two_full_days_ahead() -> None:
    import datetime as dt

    # O corte de 48 h aplica-se à data: hoje é 17 nov; quarta 18 não, quinta 19 sim (17+2=19).
    today = dt.date(2026, 11, 17)
    assert passes_cutoff(dt.date(2026, 11, 19), today) is True
    assert passes_cutoff(dt.date(2026, 11, 18), today) is False
    assert passes_cutoff(dt.date(2026, 11, 17), today) is False  # o próprio dia
    assert passes_cutoff(dt.date(2026, 11, 20), today) is True


# --- a decisão de auto-aceite: verdadeiro agendamento ou exceção para o gestor ------------------


def test_decision_auto_accepts_when_everything_passes() -> None:
    from datetime import date

    d = decide(
        subject=RequestSubject.CITIZEN,
        bag_count=3,
        requested_date=date(2026, 11, 19),
        today=date(2026, 11, 17),
        urgent=False,
        in_round=True,
    )
    assert d.state is CollectionRequestState.SCHEDULED
    assert d.exception_reason is None


def test_decision_sends_each_failure_to_the_exception_queue_with_its_reason() -> None:
    from datetime import date

    today = date(2026, 11, 17)
    # fora do prazo (48 h)
    d = decide(
        subject=RequestSubject.CITIZEN,
        bag_count=2,
        requested_date=date(2026, 11, 18),
        today=today,
        urgent=False,
        in_round=True,
    )
    assert (d.state, d.exception_reason) == (
        CollectionRequestState.EXCEPTION,
        RequestExceptionReason.CUTOFF,
    )
    # fora de ronda: a data não tem ronda na freguesia
    d = decide(
        subject=RequestSubject.CITIZEN,
        bag_count=2,
        requested_date=date(2026, 11, 25),
        today=today,
        urgent=False,
        in_round=False,
    )
    assert (d.state, d.exception_reason) == (
        CollectionRequestState.EXCEPTION,
        RequestExceptionReason.OUT_OF_ROUND,
    )
    # acima do teto de 20: recolha especial
    d = decide(
        subject=RequestSubject.LOCAL,
        bag_count=25,
        requested_date=date(2026, 11, 25),
        today=today,
        urgent=False,
        in_round=True,
    )
    assert (d.state, d.exception_reason) == (
        CollectionRequestState.EXCEPTION,
        RequestExceptionReason.SPECIAL_VOLUME,
    )
    # urgência: nunca é auto-aceite — o gestor despacha
    d = decide(
        subject=RequestSubject.CITIZEN,
        bag_count=2,
        requested_date=date(2026, 11, 25),
        today=today,
        urgent=True,
        in_round=True,
    )
    assert (d.state, d.exception_reason) == (CollectionRequestState.EXCEPTION, RequestExceptionReason.URGENCY)


def test_decision_reason_precedence_is_urgency_special_cutoff_round() -> None:
    from datetime import date

    today = date(2026, 11, 17)
    # urgência domina tudo: o gestor tem de a ver como urgência, mesmo fora de ronda e fora do prazo
    d = decide(
        subject=RequestSubject.LOCAL, bag_count=30, requested_date=today, today=today, urgent=True, in_round=False
    )
    assert d.exception_reason is RequestExceptionReason.URGENCY
    # sem urgência, o volume especial domina o corte e a ronda
    d = decide(
        subject=RequestSubject.LOCAL, bag_count=30, requested_date=today, today=today, urgent=False, in_round=False
    )
    assert d.exception_reason is RequestExceptionReason.SPECIAL_VOLUME
    # sem urgência nem volume, o corte domina a ronda
    d = decide(
        subject=RequestSubject.CITIZEN, bag_count=2, requested_date=today, today=today, urgent=False, in_round=False
    )
    assert d.exception_reason is RequestExceptionReason.CUTOFF


def test_decision_rejects_invalid_bag_counts() -> None:
    from datetime import date

    with pytest.raises(ValueError):
        decide(
            subject=RequestSubject.CITIZEN,
            bag_count=6,
            requested_date=date(2026, 11, 25),
            today=date(2026, 11, 17),
            urgent=False,
            in_round=True,
        )
    with pytest.raises(ValueError):
        decide(
            subject=RequestSubject.CITIZEN,
            bag_count=0,
            requested_date=date(2026, 11, 25),
            today=date(2026, 11, 17),
            urgent=False,
            in_round=True,
        )


# --- ausências: o pedido expira à 3.ª ausência --------------------------------------------------


def test_third_missed_visit_expires_the_request() -> None:
    # 1.ª ausência e 2.ª mantêm agendado; a 3.ª expira (MAX_ABSENCES == 3, «expira à 3.ª ausência»)
    assert MAX_ABSENCES == 3
    r1 = apply_outcome(CollectionRequestState.SCHEDULED, 0, RequestOutcome.MISSED)
    assert (r1.state, r1.missed_count) == (CollectionRequestState.SCHEDULED, 1)
    r2 = apply_outcome(r1.state, r1.missed_count, RequestOutcome.MISSED)
    assert (r2.state, r2.missed_count) == (CollectionRequestState.SCHEDULED, 2)
    r3 = apply_outcome(r2.state, r2.missed_count, RequestOutcome.MISSED)
    assert (r3.state, r3.missed_count) == (CollectionRequestState.EXPIRED, 3)


def test_collected_outcome_closes_the_request_and_keeps_the_count() -> None:
    r = apply_outcome(CollectionRequestState.SCHEDULED, 1, RequestOutcome.COLLECTED)
    assert r.state is CollectionRequestState.COLLECTED
    assert r.missed_count == 1  # as ausências anteriores ficam no histórico do pedido


def test_outcomes_only_apply_to_scheduled_requests() -> None:
    for state in (
        CollectionRequestState.EXCEPTION,
        CollectionRequestState.REJECTED,
        CollectionRequestState.COLLECTED,
        CollectionRequestState.EXPIRED,
        CollectionRequestState.CANCELLED,
    ):
        with pytest.raises(ValueError):
            apply_outcome(state, 0, RequestOutcome.COLLECTED)


# --- retenção da morada: 12 meses, por meses de calendário --------------------------------------


def test_address_retention_is_twelve_calendar_months() -> None:
    from datetime import UTC, datetime

    assert address_retained_until(datetime(2026, 3, 15, 10, 30, tzinfo=UTC)) == datetime(
        2027, 3, 15, 10, 30, tzinfo=UTC
    )
    # 29 de fevereiro (bissexto) → 28 de fevereiro do ano seguinte (aperta para o fim do mês)
    assert address_retained_until(datetime(2024, 2, 29, tzinfo=UTC)) == datetime(2025, 2, 28, tzinfo=UTC)
    assert address_retained_until(datetime(2026, 1, 31, tzinfo=UTC)) == datetime(2027, 1, 31, tzinfo=UTC)
