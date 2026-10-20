import pytest

from novelo.domain.costs import annual_cost_eur, eur_per_tonne
from novelo.domain.demand import Baseline, yearly_demand_t


def test_yearly_demand_matches_municipal_plan() -> None:
    # 156 277 hab × 0,7 kg × 12 meses = 1 312,7 t (calculado à mão)
    assert yearly_demand_t(156_277, 0.7) == pytest.approx(1312.7, abs=0.1)


def test_baseline_observed_capture_uses_real_vitrus_data() -> None:
    base = Baseline(collected_t=301.265, population=156_277, kg_per_inhab_month=0.7)
    assert base.observed_capture_rate == pytest.approx(0.229, abs=0.001)
    assert base.observed_kg_per_inhab_month == pytest.approx(0.161, abs=0.001)


def test_annual_cost_and_eur_per_tonne() -> None:
    cost = annual_cost_eur(1000, 5, 100, 10, 200, 0.5)  # 200 + 1000 + 100
    assert cost == pytest.approx(1300)
    assert eur_per_tonne(cost, 10) == pytest.approx(130)
    assert eur_per_tonne(cost, 0) is None
