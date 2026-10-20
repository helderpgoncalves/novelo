"""Benchmarks e recomendador de piloto com valores calculados à mão (fixture de test_sensitivity: q = 1 kg/hab/mês)."""

import math

import pytest

from novelo.domain.benchmarks import (
    implied_capture_of_demand,
    max_capturable_t,
    target_tonnes,
)
from novelo.domain.network import Mode, Zone
from novelo.domain.pilot import (
    PilotCandidate,
    PilotWeights,
    forecast_pilot,
    recommend_pilot,
    reject_rate_floor,
    score_candidates,
    startup_cost_eur,
    tipau_diversity,
)
from novelo.domain.vocab import Tipau
from tests.unit.test_sensitivity import params


def test_target_tonnes_is_kg_per_inhab_times_population() -> None:
    assert target_tonnes(4.27, 156_830) == pytest.approx(669.6641)  # 156 830 · 4,27 / 1000
    assert target_tonnes(0, 1000) == 0
    with pytest.raises(ValueError, match="negativas"):
        target_tonnes(-1, 10)


def test_implied_capture_of_demand() -> None:
    assert implied_capture_of_demand(4.27, 0.7) == pytest.approx(4.27 / 8.4)  # 50,83% do potencial
    assert implied_capture_of_demand(8.4, 0.7) == pytest.approx(1.0)


def test_max_capturable_uses_all_modes_independently() -> None:
    # 1 − (1 − 0,05)(1 − 0,5)(1 − 0,5) = 0,7625 de 12 t = 9,15 t por freguesia
    zones = [Zone("a", "A", 1000, 41.0, -8.0, 0), Zone("b", "B", 1000, 41.0, -8.0, 7)]
    assert max_capturable_t(zones, params()) == pytest.approx(18.3)


# Quatro candidatos no depósito (0 km), só contentores de rua, piloto de 3 meses:
#   Z1 1 000 hab, APU, 1 km², circuito 7 dias: 2 pontos -> 2 000 + 100 · 3/12 = 2 025 €
#   Z2   500 hab, APR, 5 km², circuito 2 dias: 1 ponto  -> 1 000 +  50 · 3/12 = 1 012,5 €
#   Z3 2 000 hab, APU, 1 km², sem circuito:    4 pontos -> 4 000 + 200 · 3/12 = 4 050 €
#   Z4   500 hab, APR, 10 km², circuito 1 dia: 1 ponto  -> 1 012,5 €
def candidates() -> list[PilotCandidate]:
    def zone(code: str, pop: int, days: int) -> Zone:
        return Zone(code, code, pop, 41.0, -8.0, days)

    return [
        PilotCandidate(zone("z1", 1000, 7), Tipau.APU, 1.0),
        PilotCandidate(zone("z2", 500, 2), Tipau.APR, 5.0),
        PilotCandidate(zone("z3", 2000, 0), Tipau.APU, 1.0),
        PilotCandidate(zone("z4", 500, 1), Tipau.APR, 10.0),
    ]


STREET = (Mode.STREET,)


def test_startup_cost_is_capex_plus_months_of_operation() -> None:
    z = candidates()[0].zone
    assert startup_cost_eur(z, params(), 3, STREET) == pytest.approx(2025.0)
    assert startup_cost_eur(z, params(), 12, STREET) == pytest.approx(2100.0)


def test_candidate_scores() -> None:
    s = {x.candidate.zone.id: x for x in score_candidates(candidates(), params(), 3, STREET)}
    assert [s[c].startup_cost_eur for c in ("z1", "z2", "z3", "z4")] == pytest.approx([2025, 1012.5, 4050, 1012.5])
    # custo normalizado entre 1 012,5 (melhor) e 4 050 (pior): z1 = 1 − 1 012,5/3 037,5 = 2/3
    assert [s[c].cost_score for c in ("z1", "z2", "z3", "z4")] == pytest.approx([2 / 3, 1.0, 0.0, 1.0])
    # cobertura: dias de circuito / mínimo para aproveitar a rota (2), com teto em 1
    assert [s[c].coverage for c in ("z1", "z2", "z3", "z4")] == [1.0, 1.0, 0.0, 0.5]


def test_pilot_picks_the_urban_rural_pair_with_circuits_and_cheap_start() -> None:
    sel = recommend_pilot(candidates(), params(), k=2, modes=STREET)
    assert [s.candidate.zone.id for s in sel.chosen] == ["z1", "z2"]
    # tipau 1 (APU+APR); densidade ln(1 000/100)/ln(2 000/50); cobertura 1; custo (2/3+1)/2
    contrast = math.log(10) / math.log(40)
    assert sel.tipau_diversity == 1.0 and sel.density_contrast == pytest.approx(contrast)
    assert sel.coverage == 1.0 and sel.cost == pytest.approx(5 / 6)
    assert sel.score == pytest.approx(0.25 + 0.15 * contrast + 0.30 + 0.30 * 5 / 6)  # 0,8936


def test_same_territory_type_is_penalised() -> None:
    # (z2, z4) são ambas rurais e baratas, mas sem contraste: perdem para o par misto
    sel = recommend_pilot(candidates(), params(), k=2, modes=STREET, weights=PilotWeights(0.0, 0.0, 0.0, 1.0))
    assert {s.candidate.zone.id for s in sel.chosen} == {"z2", "z4"}  # só o custo conta: as duas mais baratas
    assert sel.score == pytest.approx(1.0)


def test_weights_must_sum_to_one_and_k_is_bounded() -> None:
    with pytest.raises(ValueError, match="somar 1"):
        PilotWeights(0.5, 0.5, 0.5, 0.5)
    with pytest.raises(ValueError, match="k tem de estar"):
        recommend_pilot(candidates(), params(), k=1)
    with pytest.raises(ValueError, match="menos candidatos"):
        recommend_pilot(candidates()[:2], params(), k=3)


def test_pilot_is_deterministic_regardless_of_input_order() -> None:
    a = recommend_pilot(candidates(), params(), k=3, modes=STREET)
    b = recommend_pilot(list(reversed(candidates())), params(), k=3, modes=STREET)
    assert [s.candidate.zone.id for s in a.chosen] == [s.candidate.zone.id for s in b.chosen]


def test_forecast_without_uncertainty_matches_hand_values() -> None:
    # z1 6 t (300 €/ano) + z2 3 t (100 + 50 = 150 €/ano): 9 t/ano = 2,25 t em 3 meses; 450/9 = 50 €/t
    sel = recommend_pilot(candidates(), params(), k=2, modes=STREET)
    f = forecast_pilot(sel, params(), months=3, modes=STREET, reject_share=0.141, n=10, swing=0.0)
    by = {k.key: k for k in f.kpis}
    assert by["tonnes"].value == pytest.approx(2.25) and by["tonnes"].p10 == pytest.approx(2.25)
    assert by["eur_per_tonne"].value == pytest.approx(50.0) and by["eur_per_tonne"].p90 == pytest.approx(50.0)
    assert by["reject_rate_pct"].value == pytest.approx(14.1) and by["reject_rate_pct"].p10 == pytest.approx(14.1)
    assert f.startup_cost_eur == pytest.approx(2025 + 1012.5)


def test_forecast_interval_brackets_the_value_and_is_reproducible() -> None:
    sel = recommend_pilot(candidates(), params(), k=2, modes=STREET)
    f = forecast_pilot(sel, params(), months=3, modes=STREET, reject_share=0.141, n=200, seed=9)
    assert f == forecast_pilot(sel, params(), months=3, modes=STREET, reject_share=0.141, n=200, seed=9)
    for k in f.kpis:
        assert k.p10 < k.value < k.p90
    assert next(k for k in f.kpis if k.key == "reject_rate_pct").p10 >= 0.141 * 70 - 1e-9


def test_tipau_diversity_is_the_urban_rural_span() -> None:
    by_id = {s.candidate.zone.id: s for s in score_candidates(candidates(), params(), 3, STREET)}
    assert tipau_diversity([by_id["z1"], by_id["z2"]]) == 1.0  # APU + APR
    assert tipau_diversity([by_id["z1"], by_id["z3"]]) == 0.0  # APU + APU
    amu = PilotCandidate(Zone("z5", "z5", 800, 41.0, -8.0, 0), Tipau.AMU, 2.0)
    mixed = score_candidates([candidates()[1], amu], params(), 3, STREET)
    assert tipau_diversity(mixed) == 0.5  # APR + AMU


def test_reject_rate_floor_shows_the_calculation() -> None:
    # peças por célula = ceil(1,96² · 0,141 · 0,859 / 0,03² · 2) = ceil(1 033,98) = 1 034
    # toneladas por célula = 1 034 · 0,415 kg = 429,11 kg; 4 células (2 freguesias × 2 modos) = 1,71644 t
    f = reject_rate_floor(0.141, cells=4)
    assert f.pieces_per_cell == 1034
    assert f.tonnes_per_cell == pytest.approx(0.42911)
    assert f.tonnes == pytest.approx(1.71644)
    # sem efeito de desenho, metade das peças: ceil(516,99) = 517
    assert reject_rate_floor(0.141, cells=1, design_effect=1.0).pieces_per_cell == 517
    with pytest.raises(ValueError, match="inválidos"):
        reject_rate_floor(0.0, cells=1)


def test_signal_floor_discards_small_combinations_and_counts_them() -> None:
    # toneladas do piloto (3 meses, rua): z1 1,5; z2 0,75; z3 3,0; z4 0,75 -> pares: 2,25 / 3,75... ver abaixo
    free = recommend_pilot(candidates(), params(), k=2, modes=STREET)
    assert [s.candidate.zone.id for s in free.chosen] == ["z1", "z2"]
    assert free.tonnes == pytest.approx(2.25) and free.combos_below_floor == 0 and free.combos_total == 6
    # piso 2,5 t: descartam (z1,z2) 2,25; (z1,z4) 2,25; (z2,z4) 1,5 -> 3 de 6; o melhor que resta é (z2,z3) = 0,6718
    sel = recommend_pilot(candidates(), params(), k=2, modes=STREET, min_tonnes=2.5)
    assert [s.candidate.zone.id for s in sel.chosen] == ["z2", "z3"]
    assert (sel.combos_total, sel.combos_below_floor, sel.floor_met) == (6, 3, True)
    assert sel.tonnes == pytest.approx(3.75) and sel.score == pytest.approx(0.6718, abs=1e-3)


def test_unreachable_floor_returns_the_richest_combination_flagged() -> None:
    sel = recommend_pilot(candidates(), params(), k=2, modes=STREET, min_tonnes=99)
    assert sel.floor_met is False and sel.combos_below_floor == 6
    assert [s.candidate.zone.id for s in sel.chosen] == ["z1", "z3"]  # 1,5 + 3,0 = 4,5 t, o máximo
