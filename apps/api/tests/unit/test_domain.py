import pytest

from novelo.domain.costs import annual_cost_eur, avoided_treatment_eur, eur_per_tonne
from novelo.domain.demand import Baseline, kg_per_inhab_month, share_of_tonnes_t, yearly_demand_t
from novelo.features.textile import references


def test_yearly_demand_is_population_times_kg_times_twelve() -> None:
    # 156 277 hab × 0,7 kg × 12 meses = 1 312 726,8 kg = 1 312,7 t (calculado à mão)
    assert yearly_demand_t(156_277, 0.7) == pytest.approx(1312.7, abs=0.1)


def test_textile_in_rsu_is_the_apa_share_of_vitrus_waste() -> None:
    # 43 051 t × 0,054 = 2 324,754 t (calculado à mão)
    assert share_of_tonnes_t(43_051, 0.054) == pytest.approx(2324.754)
    with pytest.raises(ValueError):
        share_of_tonnes_t(43_051, 1.5)


def test_kg_per_inhab_month_is_derived_from_vitrus_and_apa() -> None:
    # 2 324 754 kg ÷ 156 830 hab = 14,8234 kg/hab/ano; ÷ 12 = 1,23528 kg/hab/mês (calculado à mão)
    assert kg_per_inhab_month(2324.754, 156_830) == pytest.approx(1.23528, abs=1e-5)
    assert pytest.approx(43_051_000 * 0.054 / 156_830 / 12) == references.KG_PER_INHAB_MONTH
    assert pytest.approx(2324.754) == references.TEXTILE_IN_RSU_T
    with pytest.raises(ValueError):
        kg_per_inhab_month(1, 0)


def test_baseline_observed_capture_uses_real_vitrus_data() -> None:
    base = Baseline(collected_t=301.265, population=156_830, kg_per_inhab_month=references.KG_PER_INHAB_MONTH)
    # por desviar: 156 830 × 1,23528 × 12 / 1000 = 2 324,754 t; gerado: 2 324,754 + 301,265 = 2 626,019 t
    assert base.demand_t == pytest.approx(2324.754, abs=0.001)
    assert base.generated_t == pytest.approx(2626.019, abs=0.001)
    # captura: 301,265 ÷ 2 626,019 = 11,47%; recolhido: 301 265 kg ÷ 156 830 ÷ 12 = 0,160 kg/hab/mês
    assert base.observed_capture_rate == pytest.approx(0.1147, abs=0.0001)
    assert base.observed_kg_per_inhab_month == pytest.approx(0.160, abs=0.001)


def test_annual_cost_and_eur_per_tonne() -> None:
    cost = annual_cost_eur(1000, 5, 100, 10, 200, 0.5)  # 200 + 1000 + 100
    assert cost == pytest.approx(1300)
    assert eur_per_tonne(cost, 10) == pytest.approx(130)
    assert eur_per_tonne(cost, 0) is None


def test_avoided_treatment_waits_for_the_vitrus_cost() -> None:
    assert avoided_treatment_eur(396.3, None) is None  # «por validar»: nunca um valor inventado
    assert avoided_treatment_eur(400.0, 50.0) == pytest.approx(20_000.0)  # 400 t × 50 €/t
    with pytest.raises(ValueError):
        avoided_treatment_eur(-1.0, 50.0)
