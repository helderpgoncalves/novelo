"""Tornado, Monte Carlo e robustez com valores calculados à mão.

Fixture: duas freguesias de 1 000 habitantes no estaleiro (0 km radiais), q = 1 kg/hab/mês -> procura 12 t cada.
  A: contentor de rua (capta 0,5 · 1,0 = 50%): 6 t; 2 pontos (1 000/500); capex 2 000 -> 200 €/ano;
     20 recolhas · 5 € = 100 €; km = 0  -> 300 €/ano.
  B: a pedido, ronda da viatura dedicada a cada 2 semanas (26/ano): 6 t; 240 sacos (6 000 kg / 25); volta na
     freguesia de 3,9 km² = 0,7124 · √(240/26 · 3,9) · 1,3 = 5,55672 km por ronda -> 144,47 km/ano;
     240 · 5 + 144,47 · 1 = 1 344,47 €/ano.
  Plano: 12 t, 1 644,47 €/ano, 137,04 €/t. Sem preço de viatura (0 €) por omissão.
"""

import pytest

from novelo.domain.network import Mode, ModeParams, Params, Zone
from novelo.domain.sensitivity import (
    PlanItem,
    apply_factors,
    calibrate_km_scale,
    evaluate_plan,
    monte_carlo,
    percentile,
    robustness,
    sample_factors,
    sensitive_keys,
    tornado,
    with_value,
)

DEPOT = (41.0, -8.0)


def params(**overrides: float) -> Params:
    return Params(
        kg_per_inhab_month=1.0,
        modes={
            Mode.EXISTING: ModeParams(0.1, 0.5, 100.0, 1000, 1, 5, 10),
            Mode.STREET: ModeParams(0.5, 1.0, 1000.0, 500, 1, 10, 10),
            Mode.ON_DEMAND: ModeParams(0.5, 1.0, 0.0, 1, 0, 1, 0),
        },
        cost_per_collection_eur=5.0,
        cost_per_km_eur=1.0,
        detour_factor=1.3,
        on_demand_kg_per_pickup=25.0,
        vehicle_capacity_t=4.0,
        depot=DEPOT,
        **overrides,  # type: ignore[arg-type]
    )


A = PlanItem(Zone("a", "A", 1000, 41.0, -8.0, service_days=0), (Mode.STREET,), (1.0,))
# B no estaleiro, com 3,9 km²: 240 sacos/ano em 26 rondas = 9,2308 por ronda; √(9,2308 · 3,9) = √36 = 6
# volta = 0,7124 · 6 · 1,3 = 5,55672 km por ronda; 26 rondas = 144,47472 km/ano
B = PlanItem(Zone("b", "B", 1000, 41.0, -8.0, service_days=7, area_km2=3.9), (Mode.ON_DEMAND,), (1.0,))
B_KM = 26 * 0.7124 * 6 * 1.3  # 144,47472
TOTAL = 1500.0 + B_KM  # 1 644,47472 €/ano
EPT = TOTAL / 12  # 137,04 €/t
PLAN = [A, B]


def test_percentile_linear_interpolation() -> None:
    values = [5.0, 1.0, 3.0, 2.0, 4.0]
    assert percentile(values, 50) == 3.0
    assert percentile(values, 10) == pytest.approx(1.4)  # posição 0,4 entre 1 e 2
    assert percentile(values, 90) == pytest.approx(4.6)
    assert percentile([7.0], 90) == 7.0
    with pytest.raises(ValueError, match="percentil"):
        percentile(values, 101)


def test_evaluate_plan_matches_hand_calculation() -> None:
    # A (rua, no estaleiro): 2 pontos · 1 000 € / 10 anos = 200 € + 20 recolhas · 5 € = 300 €; 6 t
    # B (a pedido): 240 sacos · 5 € = 1 200 € + 144,47472 km · 1 € = 1 344,47 €; 6 t
    m = evaluate_plan(PLAN, params())
    assert m.tonnes == pytest.approx(12.0)
    assert m.annual_cost_eur == pytest.approx(1500.0 + B_KM)
    assert m.eur_per_tonne == pytest.approx((1500.0 + B_KM) / 12)


def test_evaluate_plan_pays_the_dedicated_vehicles_the_hours_need() -> None:
    # horas: A 20 paragens · 10 min = 3,333 h; B 144,47 km ÷ 30 + 240 · 2 min = 4,816 + 8 = 12,816 h; total 16,149 h
    # 1 viatura de 8 000 € em 8 anos = 1 000 €/ano; com turnos de 0,01 h (2,6 h/ano) são ⌈16,149 ÷ 2,6⌉ = 7 viaturas
    one = evaluate_plan(PLAN, params(vehicle_capex_eur=8000.0))
    assert one.annual_cost_eur == pytest.approx(1500.0 + B_KM + 1000.0)
    seven = evaluate_plan(PLAN, params(vehicle_capex_eur=8000.0, shift_hours=0.01))
    assert seven.annual_cost_eur == pytest.approx(1500.0 + B_KM + 7000.0)
    keys = sensitive_keys(PLAN, params(vehicle_capex_eur=8000.0))
    assert {"vehicle_capex_eur", "vehicle_lifetime_years", "on_demand_every_weeks"} <= set(keys)
    assert "vehicle_capex_eur" not in sensitive_keys(PLAN, params())  # sem preço não varia


def test_km_scale_replaces_the_radial_estimate() -> None:
    # B com rotas reais 50% acima do estimado: + 0,5 · 144,47 km · 1 €
    scaled = PlanItem(B.zone, B.modes, (1.5,))
    assert evaluate_plan([A, scaled], params()).annual_cost_eur == pytest.approx(1500.0 + 1.5 * B_KM)


def test_calibrate_km_scale_is_stored_over_model_km() -> None:
    assert calibrate_km_scale(B.zone, B.modes, params(), [1.5 * B_KM]) == pytest.approx((1.5,))
    assert calibrate_km_scale(A.zone, A.modes, params(), [0.0]) == (1.0,)  # 0 km radiais: sem razão


def test_with_value_clamps_to_the_valid_domain() -> None:
    p = with_value(params(), "modes.street.capture_rate", 1.4)
    assert p.modes[Mode.STREET].capture_rate == 1.0
    assert with_value(params(), "detour_factor", 0.5).detour_factor == 1.0
    assert with_value(params(), "modes.street.people_per_point", 649.6).modes[Mode.STREET].people_per_point == 650


def test_sensitive_keys_only_cover_used_modes_and_nonzero_values() -> None:
    keys = sensitive_keys(PLAN, params())
    assert "modes.street.capture_rate" in keys and "modes.on_demand.capture_rate" in keys
    assert not any(k.startswith("modes.existing") for k in keys)  # modo não usado
    assert "modes.on_demand.capex_per_point_eur" not in keys  # a pedido não tem pontos
    assert len(keys) == len(set(keys))


def test_tornado_orders_by_impact_and_matches_hand_values() -> None:
    bars = tornado(PLAN, params(), swing=0.3)
    assert [b.swing_eur_per_tonne for b in bars] == sorted((b.swing_eur_per_tonne for b in bars), reverse=True)
    by_key = {b.key: b for b in bars}

    # custo por recolha 3,5 / 6,5: A 70/130 + B 840/1 560 + 200 + km de B -> 1 110 / 1 890 + 144,47; toneladas iguais
    c = by_key["cost_per_collection_eur"]
    assert (c.low.annual_cost_eur, c.high.annual_cost_eur) == (
        pytest.approx(1110.0 + B_KM),
        pytest.approx(1890.0 + B_KM),
    )
    assert c.swing_eur_per_tonne == pytest.approx((1890 - 1110) / 12)  # 65 €/t
    assert c.swing_tonnes == pytest.approx(0.0)

    # kg por saco 17,5 / 32,5: sacos de B 6 000/17,5 = 342,857 / 6 000/32,5 = 184,615, a 5 € cada; a volta de cada
    # ronda cresce com √(sacos por ronda): km = 26 · 0,7124 · √(sacos/26 · 3,9) · 1,3
    def cost(bags: float) -> float:
        return 300 + bags * 5 + 26 * 0.7124 * (bags / 26 * 3.9) ** 0.5 * 1.3

    kg = by_key["on_demand_kg_per_pickup"]
    assert (kg.low.eur_per_tonne, kg.high.eur_per_tonne) == (
        pytest.approx(cost(6000 / 17.5) / 12),
        pytest.approx(cost(6000 / 32.5) / 12),
    )
    assert [b.key for b in bars[:2]] == ["on_demand_kg_per_pickup", "cost_per_collection_eur"]

    # €/km 0,7 / 1,3: só os km de B (144,47 km) -> 1 500 + 101,13 / 1 500 + 187,82 €
    km = by_key["cost_per_km_eur"]
    assert (km.low.annual_cost_eur, km.high.annual_cost_eur) == (
        pytest.approx(1500.0 + 0.7 * B_KM),
        pytest.approx(1500.0 + 1.3 * B_KM),
    )

    # captura da rua 0,35 / 0,65: A 4,2 / 7,8 t, custo igual (1 644,47 €): 10,2 t / 13,8 t
    cap = by_key["modes.street.capture_rate"]
    assert (cap.low.tonnes, cap.high.tonnes) == (pytest.approx(10.2), pytest.approx(13.8))
    assert cap.low.eur_per_tonne == pytest.approx(TOTAL / 10.2)
    assert cap.high.eur_per_tonne == pytest.approx(TOTAL / 13.8)
    assert cap.swing_cost_eur == pytest.approx(0.0)

    # captura a pedido 0,35 / 0,65: B 4,2 / 7,8 t; sacos 168 / 312 (com a volta de cada ronda)
    od = by_key["modes.on_demand.capture_rate"]
    assert (od.low.annual_cost_eur, od.high.annual_cost_eur) == (pytest.approx(cost(168)), pytest.approx(cost(312)))
    assert (od.low.tonnes, od.high.tonnes) == (pytest.approx(10.2), pytest.approx(13.8))

    # kg/hab/mês escala a procura f: toneladas 12·f; sacos 240·f; a volta cresce com √f
    # custo = 300 + 1 200·f + 144,47·√f
    q = by_key["kg_per_inhab_month"]
    assert q.low.eur_per_tonne == pytest.approx((300 + 1200 * 0.7 + B_KM * 0.7**0.5) / (12 * 0.7))
    assert q.high.eur_per_tonne == pytest.approx((300 + 1200 * 1.3 + B_KM * 1.3**0.5) / (12 * 1.3))

    # o desvio da estrada só mexe na volta de B (0 km radiais): 1,3 -> 1,0 (cortado) / 1,69
    d = by_key["detour_factor"]
    assert (d.low.annual_cost_eur, d.high.annual_cost_eur) == (
        pytest.approx(1500.0 + B_KM / 1.3),
        pytest.approx(1500.0 + B_KM * 1.3),
    )


def test_tornado_swing_is_configurable_and_validated() -> None:
    bars = tornado(PLAN, params(), swing=0.1, keys=["cost_per_collection_eur"])
    (bar,) = bars
    # ±10%: 4,5 / 5,5 -> custo 1 644,47 ∓ 0,5·(20 + 240) = 1 644,47 ∓ 130
    assert (bar.low.annual_cost_eur, bar.high.annual_cost_eur) == (
        pytest.approx(TOTAL - 130),
        pytest.approx(TOTAL + 130),
    )
    with pytest.raises(ValueError, match="variação"):
        tornado(PLAN, params(), swing=1.0)


def test_factors_are_triangular_bounded_and_reproducible() -> None:
    keys = ["cost_per_km_eur", "cost_per_collection_eur"]
    first = sample_factors(keys, 200, seed=11, swing=0.3)
    assert first == sample_factors(keys, 200, seed=11, swing=0.3)  # mesma semente, mesmas amostras
    assert first != sample_factors(keys, 200, seed=12, swing=0.3)
    values = [v for f in first for v in f.values()]
    assert all(0.7 <= v <= 1.3 for v in values)
    assert sum(values) / len(values) == pytest.approx(1.0, abs=0.02)  # triangular simétrica: média 1
    assert all(v == 1.0 for f in sample_factors(keys, 5, seed=1, swing=0.0) for v in f.values())


def test_apply_factors_multiplies_the_assumption() -> None:
    p = apply_factors(params(), {"cost_per_km_eur": 1.2, "modes.street.capture_rate": 1.5})
    assert p.cost_per_km_eur == pytest.approx(1.2)
    assert p.modes[Mode.STREET].capture_rate == pytest.approx(0.75)


def test_monte_carlo_without_uncertainty_collapses_to_the_base_case() -> None:
    mc = monte_carlo(PLAN, params(), n=20, swing=0.0, threshold_eur_per_tonne=140.0)
    assert (mc.eur_per_tonne.p10, mc.eur_per_tonne.p50, mc.eur_per_tonne.p90) == pytest.approx((EPT, EPT, EPT))
    assert mc.annual_cost_eur.p50 == pytest.approx(TOTAL) and mc.tonnes.p50 == pytest.approx(12.0)
    assert mc.prob_below_threshold == 1.0
    assert monte_carlo(PLAN, params(), n=20, swing=0.0, threshold_eur_per_tonne=130.0).prob_below_threshold == 0.0


def test_monte_carlo_is_deterministic_and_brackets_the_base() -> None:
    a = monte_carlo(PLAN, params(), n=300, seed=3, threshold_eur_per_tonne=EPT)
    assert a == monte_carlo(PLAN, params(), n=300, seed=3, threshold_eur_per_tonne=EPT)
    assert a.eur_per_tonne.p10 < a.eur_per_tonne.p50 < a.eur_per_tonne.p90
    assert a.eur_per_tonne.p10 < EPT < a.eur_per_tonne.p90
    assert a.base.eur_per_tonne == pytest.approx(EPT)
    assert a.prob_below_threshold is not None and 0.2 < a.prob_below_threshold < 0.8
    assert monte_carlo(PLAN, params(), n=300, seed=4).prob_below_threshold is None


def test_monte_carlo_rejects_an_empty_plan() -> None:
    with pytest.raises(ValueError, match="vazio"):
        monte_carlo([], params(), n=5)


def test_robustness_clear_winner_and_loser() -> None:
    # A custa 50 €/t (300/6) e B 224,08 €/t (1 344,47/6): com ±30% nunca se cruzam.
    win = robustness([A], params(), [B], params(), n=200)
    assert win.share_recommended_better == 1.0 and win.holds
    assert win.base_recommended.eur_per_tonne == pytest.approx(50.0)
    assert win.base_alternative.eur_per_tonne == pytest.approx((1200 + B_KM) / 6)
    assert win.median_advantage > 100
    lose = robustness([B], params(), [A], params(), n=200)
    assert lose.share_recommended_better == 0.0 and not lose.holds


def test_robustness_of_identical_plans_is_never_strictly_better() -> None:
    same = robustness(PLAN, params(), PLAN, params(), n=50)
    assert same.share_recommended_better == 0.0 and same.median_advantage == pytest.approx(0.0)


def test_robustness_by_tonnes_criterion() -> None:
    # A capta 6 t e A+B 12 t: o plano maior capta sempre mais com ±30%? Sim (cada parte tem pelo menos 0,7 · 6 t).
    r = robustness(PLAN, params(), [A], params(), n=100, criterion="tonnes")
    assert r.share_recommended_better == 1.0


def test_robustness_pairs_the_samples_and_is_reproducible() -> None:
    first = robustness(PLAN, params(), [A, B], params(), n=100, seed=5, swing=0.5)
    assert first == robustness(PLAN, params(), [A, B], params(), n=100, seed=5, swing=0.5)
