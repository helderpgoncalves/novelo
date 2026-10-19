from datetime import date

import pytest

from novelo.domain.overview import days_until, pareto_ids, parish_potential_t, share_pct
from novelo.features.textile.references import EXTERNAL_REFERENCES, MILESTONES


def test_pareto_keeps_non_dominated_points() -> None:
    # (id, €/t, t): B domina C (mais barato e mais toneladas); A e B e D formam a fronteira
    points = [("A", 100.0, 50.0), ("B", 200.0, 120.0), ("C", 250.0, 100.0), ("D", 400.0, 300.0)]
    assert pareto_ids(points) == ["A", "B", "D"]


def test_pareto_ties_do_not_dominate_each_other() -> None:
    points = [("A", 100.0, 50.0), ("B", 100.0, 50.0), ("C", 100.0, 40.0)]
    assert pareto_ids(points) == ["A", "B"]  # C tem as mesmas €/t e menos toneladas


def test_pareto_empty() -> None:
    assert pareto_ids([]) == []


def test_days_until() -> None:
    assert days_until(date(2027, 6, 17), date(2027, 6, 10)) == 7
    assert days_until(date(2027, 6, 17), date(2027, 6, 17)) is None
    assert days_until(date(2025, 1, 1), date(2026, 10, 19)) is None


def test_parish_potential_is_population_times_plan_rate() -> None:
    # 9 708 hab × 0,7 kg/mês × 12 / 1000 = 81,5472 t/ano
    assert parish_potential_t(9708, 0.7) == pytest.approx(81.5472)
    assert parish_potential_t(0, 0.7) == 0


def test_share_pct() -> None:
    assert share_pct(39618, 156830) == pytest.approx(25.26, abs=0.01)
    assert share_pct(5, 0) == 0


def test_references_only_registered_values() -> None:
    by_key = {r.key: r for r in EXTERNAL_REFERENCES}
    assert by_key["france_2024"].kg_per_inhab_year == 4.27 and by_key["france_2024"].verified
    assert by_key["eu27_2020"].kg_per_inhab_year == 4.4 and by_key["eu27_2020"].evidence == "primary"
    assert by_key["catalonia_2024"].kg_per_inhab_year == 2.7
    assert not by_key["germany_2022"].verified  # "Por verificar" no registo
    assert len(by_key) == len(EXTERNAL_REFERENCES)


def test_milestones_dates_and_payer() -> None:
    dates = {m.key: (m.date, m.who_pays) for m in MILESTONES}
    assert dates == {
        "municipal_obligation": (date(2025, 1, 1), "municipality"),
        "transposition_deadline": (date(2027, 6, 17), "municipality"),
        "epr_regimes": (date(2028, 4, 17), "producers"),
    }
    assert all(m.verified for m in MILESTONES)
