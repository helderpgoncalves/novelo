import pytest

from novelo.domain.geo import haversine_km
from novelo.domain.network import (
    Mode,
    ModeParams,
    Params,
    Stop,
    Zone,
    build_option,
    build_options,
    plan_routes,
    solve,
)

DEPOT = (41.4425, -8.2918)  # Guimarães


def params(**overrides: object) -> Params:
    base = {
        "kg_per_inhab_month": 0.7,
        "modes": {
            Mode.EXISTING: ModeParams(0.12, 0.7, 250.0, 4000, 1, 5, 26),
            Mode.STREET: ModeParams(0.23, 0.8, 1200.0, 1500, 1, 10, 26),
            Mode.ON_DEMAND: ModeParams(0.09, 0.6, 0.0, 1, 0, 1, 0),
        },
        "cost_per_collection_eur": 6.0,
        "cost_per_km_eur": 1.1,
        "detour_factor": 1.3,
        "on_demand_kg_per_pickup": 25.0,
        "piggyback_extra_km": 1.5,
        "piggyback_min_days": 2,
        "vehicle_capacity_t": 4.0,
        "depot": DEPOT,
    }
    return Params(**{**base, **overrides})  # type: ignore[arg-type]


URBAN = Zone("urb", "Urbana", 10_000, 41.4425, -8.2918, service_days=7)  # no depósito: 0 km
RURAL = Zone("rur", "Rural", 1_000, 41.5025, -8.2918, service_days=1)  # ~6,67 km a norte


def test_haversine_one_degree_of_latitude() -> None:
    assert haversine_km(41.0, -8.0, 42.0, -8.0) == pytest.approx(111.195, abs=0.01)


def test_street_option_matches_hand_calculation() -> None:
    # procura = 10 000 · 0,7 · 12 / 1000 = 84 t; captado = 84 · 0,23 · 0,8 = 15,456 t
    # pontos = ceil(10 000 / 1500) = 7; capex = 8 400 €; recolhas = 7 · 26 = 182
    # km = 0 (no depósito); opex = 182 · 6 = 1 092; custo anual = 8 400/10 + 1 092 = 1 932
    o = build_option(URBAN, (Mode.STREET,), params())
    (street,) = o.parts
    assert o.tonnes == pytest.approx(15.456)
    assert (street.points, o.capex_eur, street.opex_eur_year) == (7, 8400.0, pytest.approx(1092.0))
    assert o.annual_cost_eur == pytest.approx(1932.0)


def test_combined_modes_capture_independently_and_costs_add_up() -> None:
    # rua capta 0,23·0,8 = 18,4%; a pedido capta 0,09·0,6 = 5,4% -> juntos 1 − (1−0,184)(1−0,054) = 22,8064%
    # toneladas = 84 · 0,228064 = 19,157376 (menos que a soma simples 15,456 + 4,536 = 19,992)
    p = params()
    combo = build_option(URBAN, (Mode.STREET, Mode.ON_DEMAND), p)
    assert combo.tonnes == pytest.approx(84 * (1 - (1 - 0.184) * (1 - 0.054)))
    assert (
        combo.tonnes < build_option(URBAN, (Mode.STREET,), p).tonnes + build_option(URBAN, (Mode.ON_DEMAND,), p).tonnes
    )
    assert combo.annual_cost_eur == pytest.approx(
        build_option(URBAN, (Mode.STREET,), p).annual_cost_eur
        + build_option(URBAN, (Mode.ON_DEMAND,), p).annual_cost_eur
    )
    assert combo.modes == (Mode.STREET, Mode.ON_DEMAND)


def test_on_demand_piggybacks_only_where_a_circuit_already_passes() -> None:
    p = params()
    urban = build_option(URBAN, (Mode.ON_DEMAND,), p).parts[0]
    rural = build_option(RURAL, (Mode.ON_DEMAND,), p).parts[0]
    # urbana: 84 · 0,09 · 0,6 = 4,536 t -> 181,44 pedidos, 1,5 km cada
    assert urban.km_year == pytest.approx(181.44 * 1.5)
    # rural (1 dia/semana < 2): viagem dedicada, ida e volta ~13,34 km x 1,3 de desvio
    assert rural.km_year / rural.collections_year == pytest.approx(2 * 6.6717 * 1.3, rel=0.01)
    assert rural.capex_eur == 0 and urban.capex_eur == 0


def test_max_tonnes_respects_the_budget_and_prefers_cheaper_tonnes() -> None:
    p = params()
    options = build_options([URBAN, RURAL], p)
    unlimited = solve(options, "max_tonnes", budget_eur_year=1e9)
    # sem limite de orçamento, cada zona usa todos os modos (mais canais, mais captura)
    assert {o.zone_id: set(o.modes) for o in unlimited.chosen} == {"urb": set(Mode), "rur": set(Mode)}
    tight = solve(options, "max_tonnes", budget_eur_year=500.0)
    assert sum(o.annual_cost_eur for o in tight.chosen) <= 500.0
    assert tight.status == "optimal"


def test_min_cost_meets_target_at_lowest_cost() -> None:
    options = build_options([URBAN, RURAL], params())
    result = solve(options, "min_cost", target_tonnes=5.0)
    assert sum(o.tonnes for o in result.chosen) >= 5.0
    # nenhuma combinação mais barata (numa só zona) cumpre a meta sozinha
    spent = sum(c.annual_cost_eur for c in result.chosen)
    assert all(o.tonnes < 5.0 for o in options if o.annual_cost_eur < spent)


def test_infeasible_target_is_reported() -> None:
    result = solve(build_options([RURAL], params()), "min_cost", target_tonnes=1_000.0)
    assert result.status == "infeasible" and result.chosen == []


def test_solver_is_deterministic() -> None:
    zones = [Zone(f"z{i}", f"Z{i}", 800 + i * 350, 41.40 + i * 0.01, -8.30 + i * 0.008, i % 5) for i in range(20)]
    options = build_options(zones, params())
    first = solve(options, "max_tonnes", budget_eur_year=9000.0, time_limit_s=5)
    second = solve(options, "max_tonnes", budget_eur_year=9000.0, time_limit_s=5)
    assert [o.zone_id for o in first.chosen] == [o.zone_id for o in second.chosen]


def test_allowed_modes_restrict_the_options() -> None:
    options = build_options([RURAL], params(), allowed={"rur": {Mode.ON_DEMAND}})
    assert [o.modes for o in options] == [(Mode.ON_DEMAND,)]


def test_default_modes_apply_where_there_is_no_restriction() -> None:
    # sem rua por omissão: 2 modos dão 3 combinações (existing, on_demand, os dois); a restrição explícita ganha
    default = (Mode.EXISTING, Mode.ON_DEMAND)
    options = build_options([URBAN, RURAL], params(), allowed={"rur": {Mode.STREET}}, default_modes=default)
    by_zone = {z: [o.modes for o in options if o.zone_id == z] for z in ("urb", "rur")}
    assert by_zone["urb"] == [(Mode.EXISTING,), (Mode.ON_DEMAND,), (Mode.EXISTING, Mode.ON_DEMAND)]
    assert by_zone["rur"] == [(Mode.STREET,)]
    assert len(build_options([URBAN], params(), default_modes=default)) == 3
    assert len(build_options([URBAN], params())) == 7  # omitido = todos os modos: 2³ − 1


def test_vrp_splits_by_capacity_and_visits_every_stop() -> None:
    p = params(vehicle_capacity_t=3.0)
    stops = [Stop("a", 41.46, -8.29, 2.0), Stop("b", 41.47, -8.30, 2.0), Stop("c", 41.40, -8.25, 1.0)]
    plan = plan_routes(stops, p, max_vehicles=3, time_limit_s=1)
    assert sorted(s for r in plan.routes for s in r.stops) == ["a", "b", "c"]
    assert all(r.load_t <= 3.0 for r in plan.routes)
    assert len(plan.routes) >= 2  # 5 t não cabem num camião de 3 t
    assert plan.km_per_round == pytest.approx(sum(r.km for r in plan.routes))
    assert all(r.path[0] == DEPOT == r.path[-1] for r in plan.routes)


def test_vrp_without_stops_is_empty() -> None:
    assert plan_routes([], params()).routes == []
