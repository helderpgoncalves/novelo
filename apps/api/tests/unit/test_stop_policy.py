"""Escada de frequências e agenda pública (política de paragem, #61): funções puras com valores calculados à mão.

Degraus (pressuposto): semanal 1 semana, quinzenal 2, mensal 4, trimestral 13. A captura do prior vale ao
degrau quinzenal (26 visitas por ano) e escala linearmente com o degrau (taxa × degrau), limitada a 1.
"""

import pytest

from novelo.domain.stop_policy import (
    ANCHOR_VISITS_PER_YEAR,
    LADDER,
    PublishedVisit,
    public_agenda,
    rung_capture,
    rung_of_weeks,
    visits_per_year,
    weeks_of,
)
from novelo.domain.vocab import CollectionFrequency as F


def test_ladder_rungs_in_weeks() -> None:
    assert LADDER == (F.WEEKLY, F.BIWEEKLY, F.MONTHLY, F.QUARTERLY)  # do mais frequente ao mais raro
    assert (weeks_of(F.WEEKLY), weeks_of(F.BIWEEKLY), weeks_of(F.MONTHLY), weeks_of(F.QUARTERLY)) == (1, 2, 4, 13)


def test_visits_per_year_of_each_rung() -> None:
    # 52 ÷ semanas: semanal 52, quinzenal 26, mensal 13, trimestral 4
    assert (visits_per_year(F.WEEKLY), visits_per_year(F.BIWEEKLY), visits_per_year(F.MONTHLY)) == (52.0, 26.0, 13.0)
    assert visits_per_year(F.QUARTERLY) == pytest.approx(4.0)
    assert ANCHOR_VISITS_PER_YEAR == 26.0  # o prior de captura vale ao degrau quinzenal


def test_rung_of_weeks_maps_only_ladder_steps() -> None:
    assert rung_of_weeks(1) is F.WEEKLY and rung_of_weeks(2) is F.BIWEEKLY
    assert rung_of_weeks(4) is F.MONTHLY and rung_of_weeks(13) is F.QUARTERLY
    assert rung_of_weeks(3) is None and rung_of_weeks(8) is None  # fora da escada (a política fixa pode ter N=8)


def test_capture_scales_with_the_rung_from_the_biweekly_anchor() -> None:
    # c = 0,2 ao quinzenal: mensal (13/ano) metade -> 0,1; trimestral (4/ano) -> 0,2 · 4/26 = 0,0307692…
    assert rung_capture(0.2, 26) == pytest.approx(0.2)
    assert rung_capture(0.2, 13) == pytest.approx(0.1)
    assert rung_capture(0.2, 4) == pytest.approx(0.2 * 4 / 26)
    # semanal dobra (limitada a 1): 0,9 · 52/26 = 1,8 -> 1,0
    assert rung_capture(0.2, 52) == pytest.approx(0.4)
    assert rung_capture(0.9, 52) == 1.0


def test_capture_scaling_rejects_nonsense() -> None:
    with pytest.raises(ValueError):
        rung_capture(-0.1, 26)
    with pytest.raises(ValueError):
        rung_capture(0.2, 0)


def _visit(code: str, channel: str, weekday: int | None, every_weeks: float) -> PublishedVisit:
    return PublishedVisit(
        code, f"Paróquia {code}", channel, weekday, every_weeks, 52 / every_weeks if every_weeks else 0
    )


def test_public_agenda_keeps_only_published_rounds_in_day_order() -> None:
    visits = [
        _visit("p3", "on_demand", None, 2.0),  # sem dia: não publica (sem slot atribuído)
        _visit("p2", "on_demand", 1, 4.0),  # segunda, mensal
        _visit("p1", "existing", 3, 2.0),  # quarta, quinzenal
        _visit("p4", "on_demand", 1, 1.0),  # segunda, semanal (empate no dia: freguesia ordena)
    ]
    agenda = public_agenda(visits)
    assert [(v.parish_code, v.weekday, v.every_weeks) for v in agenda] == [
        ("p2", 1, 4.0),
        ("p4", 1, 1.0),
        ("p1", 3, 2.0),
    ]


def test_public_agenda_of_nothing_is_empty() -> None:
    assert public_agenda([]) == []
    assert public_agenda([_visit("p1", "on_demand", 2, 0.0)]) == []  # cadência zero não é uma promessa
