import pytest

from novelo.domain.costs import annual_cost_eur, avoided_treatment_eur, eur_per_tonne, net_cost_eur
from novelo.domain.demand import Baseline, kg_per_inhab_month, potential_t, share_of_tonnes_t, yearly_demand_t
from novelo.features.textile import references


def test_yearly_demand_is_population_times_kg_times_twelve() -> None:
    # 156 277 hab × 0,7 kg × 12 meses = 1 312 726,8 kg = 1 312,7 t (calculado à mão)
    assert yearly_demand_t(156_277, 0.7) == pytest.approx(1312.7, abs=0.1)


def test_textile_in_rsu_is_the_apa_share_of_the_municipal_mixed_waste() -> None:
    # concelho: 43 050,5 t ÷ 0,840 = 51 250,595 t; têxtil: × 0,0586 = 3 003,285 t (calculado à mão)
    assert share_of_tonnes_t(51_250.595, 0.0586) == pytest.approx(3003.285, abs=1e-3)
    assert pytest.approx(51_250.595, abs=1e-3) == references.MUNICIPAL_RSU_2025_T
    with pytest.raises(ValueError):
        share_of_tonnes_t(51_250.595, 1.5)


def test_kg_per_inhab_month_is_derived_from_vitrus_and_apa() -> None:
    # 3 003 285 kg ÷ 156 830 hab = 19,1499 kg/hab/ano; ÷ 12 = 1,59583 kg/hab/mês (calculado à mão)
    assert kg_per_inhab_month(3003.285, 156_830) == pytest.approx(1.59583, abs=1e-5)
    assert pytest.approx(43_050_500 / 0.84 * 0.0586 / 156_830 / 12) == references.KG_PER_INHAB_MONTH
    assert pytest.approx(3003.285, abs=1e-3) == references.TEXTILE_IN_RSU_T
    with pytest.raises(ValueError):
        kg_per_inhab_month(1, 0)


def test_baseline_observed_capture_uses_real_vitrus_data() -> None:
    base = Baseline(collected_t=301.265, population=156_830, kg_per_inhab_month=references.KG_PER_INHAB_MONTH)
    # por desviar: 156 830 × 1,59583 × 12 / 1000 = 3 003,285 t; gerado: 3 003,285 + 301,265 = 3 304,550 t
    assert base.demand_t == pytest.approx(3003.285, abs=0.001)
    assert base.generated_t == pytest.approx(3304.550, abs=0.001)
    # captura: 301,265 ÷ 3 304,550 = 9,12%; recolhido: 301 265 kg ÷ 156 830 ÷ 12 = 0,160 kg/hab/mês
    assert base.observed_capture_rate == pytest.approx(0.0912, abs=0.0001)
    assert base.observed_kg_per_inhab_month == pytest.approx(0.160, abs=0.001)


def test_treatment_cost_is_tgr_plus_resinorte() -> None:
    # 40 €/t TGR + 65,64 €/t Resinorte = 105,64 €/t (Vitrus, 22 out 2026)
    assert pytest.approx(105.64) == references.RSU_TREATMENT_EUR_PER_T


def test_net_cost_subtracts_the_avoided_treatment() -> None:
    # 400 t × 105,64 €/t = 42 256 € evitados; 60 000 − 42 256 = 17 744 € líquidos
    avoided = avoided_treatment_eur(400, 105.64)
    assert avoided == pytest.approx(42_256)
    assert net_cost_eur(60_000, avoided) == pytest.approx(17_744)
    assert net_cost_eur(30_000, avoided) == pytest.approx(-12_256)  # o tratamento evitado paga mais do que a recolha
    assert net_cost_eur(60_000, None) is None


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


def test_potential_uses_total_population_not_rounded_zone_sums() -> None:
    # 43 051 t × 5,4% = 2 324,754 t em 156 830 hab: q = 2 324 754 kg / 156 830 / 12 = 1,23528... kg/hab/mês.
    kg = 2_324_754 / 156_830 / 12
    pops = [78_415, 78_415]
    assert potential_t(pops, kg) == pytest.approx(2324.754, abs=1e-6)
    assert round(potential_t(pops, kg), 1) == 2324.8
    assert potential_t([], kg) == 0
