"""Rede por locais reais: valores calculados à mão sobre uma geometria de 3 pontos em linha."""

import pytest

from novelo.domain import siting
from novelo.domain.network import Mode, ModeParams, Params
from novelo.domain.siting import (
    Candidate,
    DemandPoint,
    OnDemandZone,
    SiteCosts,
    SitePlan,
    capacity_weights,
    median_capacity_by_kind,
    neighbours,
    plan_site_network,
    point_tonnes,
    solve_coverage,
)

# 0,002° de latitude ≈ 222 m: A e B (e B e C) ficam a 222 m; A e C a 445 m.
LAT = 41.0
STEP = 0.002
LON = -8.0


def line(prefix: str, n: int = 3, zone: str = "z") -> list[tuple[str, str, float, float]]:
    return [(f"{prefix}{k}", zone, LAT + k * STEP, LON) for k in range(n)]


DEMAND = [DemandPoint(i, z, la, lo, 1.0) for i, z, la, lo in line("d")]
CANDS = [Candidate(i, z, la, lo) for i, z, la, lo in line("c")]


def params() -> Params:
    mp = ModeParams(0.18, 0.7, 250.0, 4000, 1, 5, 26)
    return Params(
        kg_per_inhab_month=0.7,
        modes={Mode.EXISTING: mp, Mode.STREET: mp, Mode.ON_DEMAND: mp},
        cost_per_collection_eur=6.0,
        cost_per_km_eur=0.0,  # sem km: o custo é só o fixo, fácil de verificar à mão
        detour_factor=1.3,
        on_demand_kg_per_pickup=25.0,
        vehicle_capacity_t=4.0,
        depot=(LAT, LON),
    )


def test_neighbours_use_the_radius() -> None:
    near = neighbours(DEMAND, CANDS, 250)
    # d0 vê c0 (0 m) e c1 (222 m); d1 vê os três; d2 vê c1 e c2
    assert near == [[0, 1], [0, 1, 2], [1, 2]]
    assert neighbours(DEMAND, CANDS, 100) == [[0], [1], [2]]


def test_point_tonnes_split_by_weight_inside_the_zone() -> None:
    demand = [
        DemandPoint("a", "z1", LAT, LON, 3.0),
        DemandPoint("b", "z1", LAT + STEP, LON, 1.0),
        DemandPoint("c", "z2", LAT + 2 * STEP, LON, 5.0),
    ]
    # z1 gera 8 t, z2 gera 2 t; captura 50%: a = 8·3/4·0,5 = 3; b = 1; c = 2·0,5 = 1
    assert point_tonnes(demand, {"z1": 8.0, "z2": 2.0}, 0.5) == pytest.approx([3.0, 1.0, 1.0])


def test_one_site_in_the_middle_covers_everything() -> None:
    near = neighbours(DEMAND, CANDS, 250)
    sol = solve_coverage([1.0, 1.0, 1.0], near, [100.0] * 3, "max_tonnes", budget_eur=100)
    assert sol.status == "optimal" and sol.chosen == (1,)


def test_budget_for_two_sites_covers_all_and_prefers_the_cheaper_set() -> None:
    near = neighbours(DEMAND, CANDS, 100)  # cada local só cobre o seu ponto
    sol = solve_coverage([1.0, 2.0, 3.0], near, [100.0] * 3, "max_tonnes", budget_eur=200)
    assert set(sol.chosen) == {1, 2}  # os dois pontos com mais têxtil


def test_min_cost_for_a_target() -> None:
    near = neighbours(DEMAND, CANDS, 250)
    sol = solve_coverage([1.0, 1.0, 1.0], near, [100.0] * 3, "min_cost", target_tonnes=3.0)
    assert sol.chosen == (1,)  # um só local chega para as 3 t
    impossible = solve_coverage([1.0, 1.0, 1.0], near, [100.0] * 3, "min_cost", target_tonnes=3.5)
    assert impossible.status == "infeasible"


def test_plan_reports_tonnes_population_and_cost_by_hand() -> None:
    # procura da zona 6 t/ano, captura 50% -> 1 t por ponto; um local a 100 € fixos (capex 250/5 + 26·6 = 206 €)
    costs = SiteCosts(capex_eur=250.0, annual_fixed_eur=250.0 / 5 + 26 * 6.0, collections_year=26)
    plan = plan_site_network(
        DEMAND, CANDS, {"z": 6.0}, {"z": 3000}, costs, params(),
        capture_rate=0.5, radius_m=250, collections_per_year=26,
        objective="max_tonnes", budget_eur_year=206.0,
    )  # fmt: skip
    assert plan.status in {"optimal", "feasible"}
    assert [s.candidate.id for s in plan.sites] == ["c1"]
    assert plan.tonnes == pytest.approx(3.0)  # 3 pontos × 1 t
    assert plan.population_covered == pytest.approx(3000)
    assert plan.fixed_cost_eur == pytest.approx(206.0)
    assert plan.annual_cost_eur <= 206.0 + 1e-6
    assert plan.served_points == plan.total_points == 3


def test_budget_below_one_site_opens_nothing() -> None:
    costs = SiteCosts(250.0, 206.0, 26)
    plan = plan_site_network(
        DEMAND, CANDS, {"z": 6.0}, {"z": 3000}, costs, params(),
        capture_rate=0.5, radius_m=250, collections_per_year=26,
        objective="max_tonnes", budget_eur_year=100.0,
    )  # fmt: skip
    assert plan.sites == [] and plan.status == "infeasible"


def test_solver_without_a_solution_in_time_falls_back_to_the_greedy_plan(monkeypatch: pytest.MonkeyPatch) -> None:
    # O CP-SAT sem solução no limite de tempo (UNKNOWN) chega como "infeasible"; um orçamento maior nunca pode
    # dar menos do que nada: usa-se a dica gulosa (o local do meio cobre os 3 pontos: 6 t × 0,5 = 3 t, 206 €).
    monkeypatch.setattr(siting, "_solve_model", lambda model, limit, seed: (None, "infeasible"))
    costs = SiteCosts(250.0, 206.0, 26)
    plan = plan_site_network(
        DEMAND, CANDS, {"z": 6.0}, {"z": 3000}, costs, params(),
        capture_rate=0.5, radius_m=250, collections_per_year=26,
        objective="max_tonnes", budget_eur_year=500.0,
    )  # fmt: skip
    assert plan.status == "feasible"
    assert [s.candidate.id for s in plan.sites] == ["c1"]
    assert plan.tonnes == pytest.approx(3.0)
    assert plan.annual_cost_eur == pytest.approx(206.0)


def test_km_cost_is_charged_inside_the_budget() -> None:
    # Depósito a ~1,1 km (ida e volta ~3 km em estrada) com km a 1 €/km e 26 rondas: os km entram no custo.
    p = params()
    p = Params(**{**p.__dict__, "cost_per_km_eur": 1.0, "depot": (LAT - 0.01, LON)})
    costs = SiteCosts(250.0, 206.0, 26)
    plan = plan_site_network(
        DEMAND, CANDS, {"z": 6.0}, {"z": 3000}, costs, p,
        capture_rate=0.5, radius_m=250, collections_per_year=26,
        objective="max_tonnes", budget_eur_year=500.0,
    )  # fmt: skip
    assert plan.km_year > 0
    assert plan.annual_cost_eur <= 500.0 + 1e-6
    assert plan.annual_cost_eur == pytest.approx(plan.fixed_cost_eur + plan.km_year * 1.0)


def test_a_budget_that_only_covers_the_fixed_cost_fails_once_km_are_counted() -> None:
    p = params()
    p = Params(**{**p.__dict__, "cost_per_km_eur": 1.0, "depot": (LAT - 0.01, LON)})
    costs = SiteCosts(250.0, 206.0, 26)
    plan = plan_site_network(
        DEMAND, CANDS, {"z": 6.0}, {"z": 3000}, costs, p,
        capture_rate=0.5, radius_m=250, collections_per_year=26,
        objective="max_tonnes", budget_eur_year=210.0,
    )  # fmt: skip
    # 206 € de custo fixo cabem, mas com os ~75 km por ano de rotas já não: não há plano que caiba
    assert plan.sites == []


OD = {"z": OnDemandZone("z", capture=0.25, coverage=0.6, cost_eur=50.0, km_year=0.0)}


def hybrid(budget: float) -> SitePlan:
    costs = SiteCosts(250.0, 206.0, 26)
    return plan_site_network(
        DEMAND, CANDS, {"z": 6.0}, {"z": 3000}, costs, params(),
        capture_rate=0.5, radius_m=250, collections_per_year=26,
        objective="max_tonnes", budget_eur_year=budget, on_demand=OD,
    )  # fmt: skip


def test_hybrid_combines_a_site_and_on_demand_as_independent_channels() -> None:
    # D = 2 t por ponto; local capta 50%, a pedido 25%: união por ponto = 2·(1 − 0,5·0,75) = 1,25 t; 3 pontos = 3,75 t
    plan = hybrid(300.0)
    assert [s.candidate.id for s in plan.sites] == ["c1"]
    assert plan.tonnes == pytest.approx(3.75)
    # a pedido leva o que capta sozinha (3 · 2 · 0,25 = 1,5 t); os locais levam o resto (3 · 2 · 0,5 · 0,75 = 2,25 t)
    assert plan.zone_tonnes_on_demand["z"] == pytest.approx(1.5)
    assert plan.sites[0].tonnes == pytest.approx(2.25)
    assert plan.annual_cost_eur == pytest.approx(206.0 + 50.0)
    assert plan.population_covered == pytest.approx(3000)


def test_hybrid_with_only_the_on_demand_budget() -> None:
    plan = hybrid(60.0)
    assert plan.sites == [] and set(plan.on_demand) == {"z"}
    assert plan.tonnes == pytest.approx(1.5)
    assert plan.population_covered == pytest.approx(3000 * 0.6)


def test_capacity_weights_impute_unknown_litres_with_the_median_of_the_type() -> None:
    containers = [
        ("s1", "surface", 1100),
        ("s1", "underground", 5000),
        ("s2", "surface", None),  # mediana de surface (800, 1100, 1100) = 1 100
        ("s2", "surface", 800),
        ("s3", "surface", 1100),
        ("s3", "platform", None),  # tipo sem nenhum valor: mediana de todos (800, 1100, 1100, 5000) = 1 100
    ]
    assert median_capacity_by_kind([(k, c) for _, k, c in containers]) == {"surface": 1100.0, "underground": 5000.0}
    assert capacity_weights(containers) == {"s1": 6100.0, "s2": 1900.0, "s3": 2200.0}
    assert capacity_weights([("s", "surface", None)]) == {"s": 0.0}
