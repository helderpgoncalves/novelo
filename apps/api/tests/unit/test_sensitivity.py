"""Tornado, Monte Carlo e robustez com valores calculados à mão.

Fixture: duas freguesias de 1 000 habitantes no depósito (0 km radiais), q = 1 kg/hab/mês -> procura 12 t cada.
  A: contentor de rua (capta 0,5 · 1,0 = 50%): 6 t; 2 pontos (1 000/500); capex 2 000 -> 200 €/ano;
     20 recolhas · 5 € = 100 €; km = 0  -> 300 €/ano.
  B: a pedido, com circuito (7 dias): 6 t; 240 pedidos (6 000 kg / 25); km = 240 · 1,5 = 360;
     240 · 5 + 360 · 1 = 1 560 €/ano.
  Plano: 12 t, 1 860 €/ano, 155 €/t.
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


def params() -> Params:
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
        piggyback_extra_km=1.5,
        piggyback_min_days=2,
        vehicle_capacity_t=4.0,
        depot=DEPOT,
    )


A = PlanItem(Zone("a", "A", 1000, 41.0, -8.0, service_days=0), (Mode.STREET,), (1.0,))
B = PlanItem(Zone("b", "B", 1000, 41.0, -8.0, service_days=7), (Mode.ON_DEMAND,), (1.0,))
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
    m = evaluate_plan(PLAN, params())
    assert m.tonnes == pytest.approx(12.0)
    assert m.annual_cost_eur == pytest.approx(1860.0)
    assert m.eur_per_tonne == pytest.approx(155.0)


def test_km_scale_replaces_the_radial_estimate() -> None:
    # B com rotas reais 50% acima do estimado: km 540 -> +180 €
    scaled = PlanItem(B.zone, B.modes, (1.5,))
    assert evaluate_plan([A, scaled], params()).annual_cost_eur == pytest.approx(2040.0)


def test_calibrate_km_scale_is_stored_over_model_km() -> None:
    assert calibrate_km_scale(B.zone, B.modes, params(), [540.0]) == pytest.approx((1.5,))
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

    # custo por recolha 3,5 / 6,5: A 70/130 + B 840/1 560 + 200 + 360 -> 1 470 / 2 250; toneladas iguais
    c = by_key["cost_per_collection_eur"]
    assert (c.low.annual_cost_eur, c.high.annual_cost_eur) == (pytest.approx(1470.0), pytest.approx(2250.0))
    assert c.swing_eur_per_tonne == pytest.approx((2250 - 1470) / 12)  # 65 €/t
    assert c.swing_tonnes == pytest.approx(0.0)

    # kg por pedido 17,5 / 32,5: pedidos de B 6 000/17,5 = 342,857 / 6 000/32,5 = 184,615, a 6,5 € cada
    # -> custo 300 + 2 228,571 = 2 528,571 / 300 + 1 200 = 1 500; €/t 210,714 / 125; impacto 85,714 €/t
    kg = by_key["on_demand_kg_per_pickup"]
    assert (kg.low.eur_per_tonne, kg.high.eur_per_tonne) == (pytest.approx(210.714, abs=1e-3), pytest.approx(125.0))
    assert [b.key for b in bars[:2]] == ["on_demand_kg_per_pickup", "cost_per_collection_eur"]

    # €/km 0,7 / 1,3: custo de km de B 252 / 468 -> 1 752 / 1 968 €
    km = by_key["cost_per_km_eur"]
    assert (km.low.annual_cost_eur, km.high.annual_cost_eur) == (pytest.approx(1752.0), pytest.approx(1968.0))

    # captura da rua 0,35 / 0,65: A 4,2 / 7,8 t, custo igual (1 860 €): 10,2 t / 13,8 t
    cap = by_key["modes.street.capture_rate"]
    assert (cap.low.tonnes, cap.high.tonnes) == (pytest.approx(10.2), pytest.approx(13.8))
    assert cap.low.eur_per_tonne == pytest.approx(1860 / 10.2)
    assert cap.high.eur_per_tonne == pytest.approx(1860 / 13.8)
    assert cap.swing_cost_eur == pytest.approx(0.0)

    # captura a pedido 0,35 / 0,65: B 4,2 / 7,8 t; pedidos 168 / 312: custo B 168·6,5 = 1 092 / 312·6,5 = 2 028
    od = by_key["modes.on_demand.capture_rate"]
    assert (od.low.annual_cost_eur, od.high.annual_cost_eur) == (pytest.approx(1392.0), pytest.approx(2328.0))
    assert (od.low.tonnes, od.high.tonnes) == (pytest.approx(10.2), pytest.approx(13.8))

    # kg/hab/mês escala a procura: custo = 300 + 1 560·f; toneladas = 12·f; €/t = 25/f + 130
    q = by_key["kg_per_inhab_month"]
    assert q.low.eur_per_tonne == pytest.approx(25 / 0.7 + 130)
    assert q.high.eur_per_tonne == pytest.approx(25 / 1.3 + 130)

    # sem km radiais, o desvio da estrada não mexe em nada
    assert by_key["detour_factor"].swing_eur_per_tonne == pytest.approx(0.0)


def test_tornado_swing_is_configurable_and_validated() -> None:
    bars = tornado(PLAN, params(), swing=0.1, keys=["cost_per_collection_eur"])
    (bar,) = bars
    # ±10%: 4,5 / 5,5 -> custo 1 860 ∓ 0,5·(20+240)... = 1 860 ∓ 130
    assert (bar.low.annual_cost_eur, bar.high.annual_cost_eur) == (pytest.approx(1730.0), pytest.approx(1990.0))
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
    mc = monte_carlo(PLAN, params(), n=20, swing=0.0, threshold_eur_per_tonne=160.0)
    assert (mc.eur_per_tonne.p10, mc.eur_per_tonne.p50, mc.eur_per_tonne.p90) == pytest.approx((155.0, 155.0, 155.0))
    assert mc.annual_cost_eur.p50 == pytest.approx(1860.0) and mc.tonnes.p50 == pytest.approx(12.0)
    assert mc.prob_below_threshold == 1.0
    assert monte_carlo(PLAN, params(), n=20, swing=0.0, threshold_eur_per_tonne=150.0).prob_below_threshold == 0.0


def test_monte_carlo_is_deterministic_and_brackets_the_base() -> None:
    a = monte_carlo(PLAN, params(), n=300, seed=3, threshold_eur_per_tonne=155.0)
    assert a == monte_carlo(PLAN, params(), n=300, seed=3, threshold_eur_per_tonne=155.0)
    assert a.eur_per_tonne.p10 < a.eur_per_tonne.p50 < a.eur_per_tonne.p90
    assert a.eur_per_tonne.p10 < 155.0 < a.eur_per_tonne.p90
    assert a.base.eur_per_tonne == pytest.approx(155.0)
    assert a.prob_below_threshold is not None and 0.2 < a.prob_below_threshold < 0.8
    assert monte_carlo(PLAN, params(), n=300, seed=4).prob_below_threshold is None


def test_monte_carlo_rejects_an_empty_plan() -> None:
    with pytest.raises(ValueError, match="vazio"):
        monte_carlo([], params(), n=5)


def test_robustness_clear_winner_and_loser() -> None:
    # A custa 50 €/t (300/6) e B 260 €/t (1 560/6): com ±30% nunca se cruzam.
    win = robustness([A], params(), [B], params(), n=200)
    assert win.share_recommended_better == 1.0 and win.holds
    assert win.base_recommended.eur_per_tonne == pytest.approx(50.0)
    assert win.base_alternative.eur_per_tonne == pytest.approx(260.0)
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
