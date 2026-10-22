import math

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
    fleet_cost,
    plan_routes,
    solve,
)

DEPOT = (41.4425, -8.2918)  # ponto de referência dos testes (o estaleiro real está em Polvoreira)


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
        "vehicle_capacity_t": 4.0,
        "depot": DEPOT,
    }
    return Params(**{**base, **overrides})  # type: ignore[arg-type]


URBAN = Zone("urb", "Urbana", 10_000, 41.4425, -8.2918, service_days=7, area_km2=4.0)  # no estaleiro: 0 km
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


def test_on_demand_is_a_round_of_the_dedicated_vehicle_every_n_weeks() -> None:
    p = params()  # uma ronda a cada 2 semanas: 26 rondas por ano
    urban = build_option(URBAN, (Mode.ON_DEMAND,), p).parts[0]
    # urbana: 84 · 0,09 · 0,6 = 4,536 t -> 181,44 sacos/ano, 6,97846 por ronda; 174,46 kg por ronda: 1 viagem
    # volta na freguesia = 0,7124 · √(6,97846 · 4 km²) · 1,3 = 4,89307 km; ida e volta 0 (no estaleiro)
    assert (urban.rounds_year, urban.trips_per_round) == (26.0, 1)
    assert urban.km_year == pytest.approx(26 * 0.7124 * (181.44 / 26 * 4.0) ** 0.5 * 1.3)
    assert urban.km_year == pytest.approx(127.22, abs=0.01)
    # custo = 181,44 sacos · 6 € + 127,22 km · 1,1 € = 1 088,64 + 139,94 = 1 228,58 €
    assert urban.annual_cost_eur == pytest.approx(1088.64 + urban.km_year * 1.1)
    # horas = 127,22 km ÷ 30 km/h + 181,44 sacos · 2 min ÷ 60 = 4,2407 + 6,048 = 10,289 h
    assert urban.hours_year == pytest.approx(urban.km_year / 30 + 6.048)
    # rural, sem área: só a ida e volta (2 · 6,6717 km · 1,3 = 17,346 km) em cada uma das 26 rondas
    rural = build_option(RURAL, (Mode.ON_DEMAND,), p).parts[0]
    assert rural.km_year == pytest.approx(26 * 2 * 6.6717 * 1.3, rel=1e-3)
    assert rural.capex_eur == 0 and urban.capex_eur == 0


def test_on_demand_round_above_capacity_goes_back_to_the_depot() -> None:
    # rural: 0,4536 t / 26 rondas = 17,45 kg por ronda; com 10 kg de capacidade são 2 viagens por ronda
    one = build_option(RURAL, (Mode.ON_DEMAND,), params()).parts[0]
    two = build_option(RURAL, (Mode.ON_DEMAND,), params(vehicle_capacity_t=0.01)).parts[0]
    assert (one.trips_per_round, two.trips_per_round) == (1, 2)
    assert two.km_year == pytest.approx(2 * one.km_year)


def test_rounds_every_four_weeks_halve_the_km() -> None:
    # 13 rondas em vez de 26: a ida e volta conta metade das vezes (a volta na freguesia cresce com √2 por ronda)
    two = build_option(RURAL, (Mode.ON_DEMAND,), params()).parts[0]
    four = build_option(RURAL, (Mode.ON_DEMAND,), params(on_demand_every_weeks=4.0)).parts[0]
    assert four.rounds_year == 13.0 and four.km_year == pytest.approx(two.km_year / 2)
    assert four.collections_year == two.collections_year  # os mesmos sacos


def test_site_hours_use_the_site_stop_minutes() -> None:
    # local existente na urbana: ceil(10 000 / 4 000) = 3 pontos · 26 = 78 paragens · 10 min = 13 h; 0 km
    existing = build_option(URBAN, (Mode.EXISTING,), params()).parts[0]
    assert existing.hours_year == pytest.approx(13.0)


def test_the_dedicated_vehicle_is_paid_once_the_network_collects_anything() -> None:
    p = params(vehicle_capex_eur=8000.0, vehicle_lifetime_years=8.0)  # 1 000 €/ano por viatura
    options = build_options([URBAN, RURAL], p)
    fleet = fleet_cost(p)
    assert (fleet.annual_eur_per_vehicle, fleet.hours_per_vehicle_year) == (1000.0, 7 * 5 * 52)
    # 900 € não chegam para a viatura: não se recolhe nada
    assert solve(options, "max_tonnes", budget_eur_year=900.0, vehicles=fleet).chosen == []
    # sem limite: uma viatura chega (as horas ficam muito abaixo de 1 820 h)
    unlimited = solve(options, "max_tonnes", budget_eur_year=1e9, vehicles=fleet)
    assert unlimited.vehicles == 1 and sum(o.hours_year for o in unlimited.chosen) < 1820
    # com turnos de 6 minutos (26 h/ano por viatura) as horas pedem mais viaturas: ⌈horas ÷ 26⌉
    short = fleet_cost(params(vehicle_capex_eur=8000.0, shift_hours=0.1))
    many = solve(options, "max_tonnes", budget_eur_year=1e9, vehicles=short)
    hours = sum(o.hours_year for o in many.chosen)
    assert many.vehicles == math.ceil(hours / 26)


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
