"""Reavaliação de um plano por locais reais: valores calculados à mão (sem solver)."""

import pytest

from novelo.domain import sensitivity as sens
from novelo.domain.network import Mode, Zone, mode_cost
from tests.unit.test_network import params

URBAN = Zone("urb", "Urbana", 10_000, 41.4425, -8.2918, service_days=7)  # no depósito: 0 km


def plan(on_demand: bool = False, km: float = 0.0) -> sens.SitePlan:
    return sens.SitePlan(
        Mode.STREET, (sens.SiteZone(URBAN, 0.5, on_demand),), sites=3, km_per_round=km, base_detour=1.3
    )


def test_sites_only_by_hand() -> None:
    # procura 84 t; rua capta 0,23 de metade da procura = 9,66 t; 3 locais · (1 200/10 + 26 · 6) = 3 · 276 = 828 €
    m = sens.evaluate_plan(plan(), params())
    assert m.tonnes == pytest.approx(9.66)
    assert m.annual_cost_eur == pytest.approx(828.0)


def test_on_demand_joins_as_an_independent_channel() -> None:
    # a pedido capta 0,09 · 0,6 = 0,054; união por freguesia = 84 · (0,115 + 0,054 − 0,23 · 0,054 · 0,5) = 13,6744 t
    p = params()
    m = sens.evaluate_plan(plan(on_demand=True), p)
    assert m.tonnes == pytest.approx(84 * (0.115 + 0.054 - 0.23 * 0.054 * 0.5))
    od = mode_cost(URBAN, Mode.ON_DEMAND, p)
    assert m.annual_cost_eur == pytest.approx(828.0 + od.annual_cost_eur)


def test_km_follow_the_detour_and_the_number_of_rounds() -> None:
    # 10 km por ronda com desvio 1,3; 26 rondas; 1,1 €/km -> 286 €; com desvio 1,95 (× 1,5) os km sobem 50%
    base = sens.evaluate_plan(plan(km=10.0), params())
    assert base.annual_cost_eur == pytest.approx(828.0 + 10 * 26 * 1.1)
    more = sens.evaluate_plan(plan(km=10.0), sens.with_value(params(), "detour_factor", 1.95))
    assert more.annual_cost_eur == pytest.approx(828.0 + 10 * 1.5 * 26 * 1.1)


def test_keys_are_only_the_ones_that_matter_for_sites() -> None:
    keys = sens.sensitive_keys(plan(), params())
    assert "modes.street.capture_rate" in keys and "modes.street.people_per_point" not in keys
    assert not any(k.startswith("modes.on_demand") for k in keys) and "on_demand_kg_per_pickup" not in keys
    with_od = sens.sensitive_keys(plan(on_demand=True), params())
    assert "modes.on_demand.capture_rate" in with_od and "on_demand_kg_per_pickup" in with_od


def test_tornado_and_monte_carlo_work_on_a_site_plan() -> None:
    p = params()
    bars = sens.tornado(plan(km=10.0), p, 0.3)
    swings = [b.swing_eur_per_tonne for b in bars]
    assert swings == sorted(swings, reverse=True)
    assert bars[0].key in {"modes.street.capture_rate", "kg_per_inhab_month"}  # os dois escalam o têxtil por igual
    mc = sens.monte_carlo(plan(km=10.0), p, n=200, seed=7)
    assert mc.eur_per_tonne.p10 < mc.eur_per_tonne.p50 < mc.eur_per_tonne.p90
    assert mc.eur_per_tonne.p10 < mc.base.eur_per_tonne < mc.eur_per_tonne.p90  # type: ignore[operator]
    assert sens.monte_carlo(plan(km=10.0), p, n=200, seed=7).eur_per_tonne == mc.eur_per_tonne
