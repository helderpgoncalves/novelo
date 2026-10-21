import httpx
import pytest

from novelo.features.users import service as users
from tests.conftest import PASSWORD

P = "/api/v1/planning"


def request_body(**overrides: object) -> dict[str, object]:
    return {"label": "Cenário A", "objective": "max_tonnes", "budget_eur_year": 60000, **overrides}


async def test_zones_carry_real_census_population(logged_in: httpx.AsyncClient) -> None:
    zones = (await logged_in.get(f"{P}/zones")).json()
    assert len(zones) == 48
    assert sum(z["population"] for z in zones) == 156_830  # Censos 2021, INE
    assert all(z["latitude"] and z["longitude"] for z in zones)
    ronfe = next(z for z in zones if z["name"] == "Ronfe")
    kg = 43_051_000 * 0.054 / 156_830 / 12  # têxtil no lixo por habitante e mês (Vitrus + APA): 1,2353
    assert ronfe["service_days"] >= 3 and ronfe["demand_t"] == pytest.approx(
        ronfe["population"] * kg * 12 / 1000, abs=0.01
    )
    # a procura total é o têxtil que ainda vai para o lixo: 43 051 t × 5,4% = 2 324,754 t
    assert sum(z["demand_t"] for z in zones) == pytest.approx(2324.75, abs=0.3)


async def test_parameters_are_labelled_by_source(logged_in: httpx.AsyncClient) -> None:
    body = (await logged_in.get(f"{P}/parameters")).json()
    sources = {m["key"]: m["source"] for m in body["meta"]}
    assert sources["kg_per_inhab_month"] == "vitrus_data"  # 43 051 t de RSU (Vitrus) × 5,4% (APA)
    assert sources["modes.street.capture_rate"] == "assumption"  # sem calibração: as 301 t são de terceiros
    assert sources["cost_per_km_eur"] == "assumption"
    assert set(sources.values()) <= {"vitrus_data", "assumption"}  # o plano municipal já não é fonte
    # derivado, não escrito à mão: 43 051 000 kg × 0,054 ÷ 156 830 hab ÷ 12 = 1,23528 kg/hab/mês, a 4 casas no ecrã
    assert body["values"]["kg_per_inhab_month"] == round(43_051_000 * 0.054 / 156_830 / 12, 4) == 1.2353


async def test_only_admins_update_parameters(logged_in: httpx.AsyncClient, client: httpx.AsyncClient) -> None:
    values = (await logged_in.get(f"{P}/parameters")).json()["values"]
    assert (await logged_in.put(f"{P}/parameters", json=values)).status_code == 403


async def test_admin_updates_parameters_and_versions_them(client: httpx.AsyncClient, session) -> None:  # type: ignore[no-untyped-def]
    await users.create_user(session, email="admin@x.pt", password=PASSWORD, role="admin", email_verified=True)
    await client.post("/api/v1/auth/login", json={"email": "admin@x.pt", "password": PASSWORD})
    current = (await client.get(f"{P}/parameters")).json()
    values = current["values"]
    values["cost_per_km_eur"] = 1.5
    saved = (await client.put(f"{P}/parameters", json=values)).json()
    assert saved["version"] == current["version"] + 1 and saved["values"]["cost_per_km_eur"] == 1.5
    bad = {**values, "detour_factor": 0.5}
    assert (await client.put(f"{P}/parameters", json=bad)).status_code == 422


async def test_scenario_max_tonnes_respects_budget(logged_in: httpx.AsyncClient) -> None:
    resp = await logged_in.post(f"{P}/scenarios", json=request_body(budget_eur_year=30000))
    assert resp.status_code == 201
    s = resp.json()
    k = s["result"]["kpis"]
    assert s["status"] == "computed" and s["solver_status"] in {"optimal", "feasible"}
    assert k["annual_cost_eur"] <= 30000 * 1.02  # km das rotas reais podem afastar-se da estimativa radial
    assert k["tonnes_year"] > 0 and k["eur_per_tonne"] == pytest.approx(
        k["annual_cost_eur"] / k["tonnes_year"], rel=0.01
    )
    assert k["baseline_observed_t"] == pytest.approx(301.3, abs=0.1)
    assert sum(a["tonnes"] for a in s["result"]["allocations"]) == pytest.approx(k["tonnes_year"], abs=0.01)


async def test_bigger_budget_never_captures_less(logged_in: httpx.AsyncClient) -> None:
    small = (await logged_in.post(f"{P}/scenarios", json=request_body(budget_eur_year=15000))).json()
    large = (await logged_in.post(f"{P}/scenarios", json=request_body(budget_eur_year=90000))).json()
    assert large["tonnes_year"] >= small["tonnes_year"]


async def test_constraints_force_the_mode(logged_in: httpx.AsyncClient) -> None:
    zones = (await logged_in.get(f"{P}/zones")).json()
    serzedelo = next(z for z in zones if z["name"] == "Serzedelo")["code"]
    resp = await logged_in.post(
        f"{P}/scenarios", json=request_body(budget_eur_year=500000, constraints={serzedelo: ["on_demand"]})
    )
    alloc = next(a for a in resp.json()["result"]["allocations"] if a["parish_code"] == serzedelo)
    assert alloc["modes"] == ["on_demand"] and alloc["capex_eur"] == 0


async def test_min_cost_and_infeasible_target(logged_in: httpx.AsyncClient) -> None:
    ok = await logged_in.post(f"{P}/scenarios", json={"label": "Meta", "objective": "min_cost", "target_tonnes": 120})
    assert ok.json()["result"]["kpis"]["tonnes_year"] >= 120
    impossible = await logged_in.post(
        f"{P}/scenarios", json={"label": "Impossível", "objective": "min_cost", "target_tonnes": 99999}
    )
    assert impossible.json()["status"] == "infeasible"


async def test_request_validation(logged_in: httpx.AsyncClient) -> None:
    missing_budget = await logged_in.post(f"{P}/scenarios", json={"label": "x", "objective": "max_tonnes"})
    assert missing_budget.status_code == 422 and missing_budget.json()["code"] == "validation_error"


async def test_scenario_crud_and_flows(logged_in: httpx.AsyncClient) -> None:
    created = (await logged_in.post(f"{P}/scenarios", json=request_body())).json()
    sid = created["id"]
    assert any(s["id"] == sid for s in (await logged_in.get(f"{P}/scenarios")).json())
    assert (await logged_in.get(f"{P}/scenarios/{sid}")).json()["params"]["modes"]["street"][
        "capture_rate"
    ] == pytest.approx(0.286)

    renamed = await logged_in.patch(f"{P}/scenarios/{sid}", json={"label": "Plano base"})
    assert renamed.json()["label"] == "Plano base"

    flows = (await logged_in.get(f"{P}/scenarios/{sid}/flows")).json()
    to_destination = sum(link["tonnes"] for link in flows["links"] if link["target"] in {"reuse", "recycle", "reject"})
    assert to_destination == pytest.approx(created["tonnes_year"], abs=0.05)  # o fluxo conserva a massa

    assert (await logged_in.delete(f"{P}/scenarios/{sid}")).status_code == 204
    assert (await logged_in.get(f"{P}/scenarios/{sid}")).json()["code"] == "not_found"


async def test_a_network_can_beat_what_vitrus_collects_today(logged_in: httpx.AsyncClient) -> None:
    """Com orçamento folgado, a rede por omissão (sem contentores de têxtil) capta mais do que as 301 t de 2025."""
    mixed = (await logged_in.post(f"{P}/scenarios", json=request_body(budget_eur_year=10_000_000))).json()
    assert mixed["tonnes_year"] > 301.3
    assert mixed["result"]["kpis"]["potential_t"] == pytest.approx(2324.8, abs=0.3)
    combined = [a for a in mixed["result"]["allocations"] if len(a["modes"]) > 1]
    assert combined and all(
        sum(p["tonnes"] for p in a["parts"]) == pytest.approx(a["tonnes"], abs=0.01) for a in combined
    )


async def test_default_modes_exclude_street(logged_in: httpx.AsyncClient) -> None:
    """A Vitrus não tem contentores de têxtil: por omissão só local existente e recolha a pedido."""
    s = (await logged_in.post(f"{P}/scenarios", json=request_body(budget_eur_year=10_000_000))).json()
    assert s["result"]["default_modes"] == ["existing", "on_demand"]
    used = {m for a in s["result"]["allocations"] for m in a["modes"]}
    assert used and "street" not in used and {r["mode"] for r in s["result"]["routes"]} <= {"existing"}


async def test_street_only_as_an_explicit_reference(logged_in: httpx.AsyncClient) -> None:
    body = request_body(budget_eur_year=10_000_000, default_modes=["street"])
    s = (await logged_in.post(f"{P}/scenarios", json=body)).json()
    assert {m for a in s["result"]["allocations"] for m in a["modes"]} == {"street"}
    # ao duplicar/alterar, o cenário repete os modos com que foi feito
    assert s["result"]["default_modes"] == ["street"]
    assert (await logged_in.post(f"{P}/scenarios", json={**body, "default_modes": []})).status_code == 422


# --- Recolha no circuito porta a porta (PAP) e poupança no tratamento ----------------------------------------------


async def test_zones_carry_the_door_to_door_passes_with_a_vehicle(logged_in: httpx.AsyncClient) -> None:
    zones = {z["name"]: z for z in (await logged_in.get(f"{P}/zones")).json()}
    # Ronfe: C18, terça, quinta e sábado, viatura 49-GC-79 com 3 pessoas (planeamento de turnos da Vitrus)
    assert [(p["circuit"], p["weekday"], p["vehicle"], p["crew"]) for p in zones["Ronfe"]["door_to_door"]] == [
        ("C18", 2, "49-GC-79", 3),
        ("C18", 4, "49-GC-79", 3),
        ("C18", 6, "49-GC-79", 3),
    ]
    # Lordelo: os circuitos PAP (C22, C23) não têm viatura no planeamento, por isso não há passagem
    assert zones["Lordelo"]["door_to_door"] == []


async def test_textile_never_rides_an_organic_circuit(logged_in: httpx.AsyncClient) -> None:
    # BIO 1 é porta a porta e tem viatura, mas é de biorresíduos: o têxtil molhar-se-ia. Só indiferenciado.
    zones = (await logged_in.get(f"{P}/zones")).json()
    circuits = {p["circuit"] for z in zones for p in z["door_to_door"]}
    assert circuits and not any(c.startswith("BIO") for c in circuits)


async def test_on_demand_rides_the_door_to_door_circuit_without_new_km(logged_in: httpx.AsyncClient) -> None:
    s = (await logged_in.post(f"{P}/scenarios", json=request_body())).json()
    zones = {z["code"]: z for z in (await logged_in.get(f"{P}/zones")).json()}
    plan = s["result"]["collection_plan"]
    pap = [e for e in plan if e["channel"] == "door_to_door"]
    assert pap, "com 60 000 €/ano há freguesias servidas no circuito PAP"
    alloc = {a["parish_code"]: a for a in s["result"]["allocations"]}
    for e in pap:
        passes = {(p["circuit"], p["weekday"], p["vehicle"]) for p in zones[e["parish_code"]]["door_to_door"]}
        assert (e["circuit"], e["weekday"], e["vehicle"]) in passes and e["new_km_year"] == 0
        assert e["kg_per_round"] == pytest.approx(e["tonnes_year"] * 1000 / 52, abs=0.1)
        assert e["round_kg"] >= e["kg_per_round"] - 0.1
        assert e["fits_capacity"] is None  # capacidade livre por validar com a Vitrus: não se inventa
        part = next(x for x in alloc[e["parish_code"]]["parts"] if x["mode"] == "on_demand")
        assert part["km_year"] == 0 and part["tonnes"] == pytest.approx(e["tonnes_year"], abs=0.002)
    for e in plan:
        if e["channel"] == "detour":
            assert zones[e["parish_code"]]["door_to_door"] == [] and e["circuit"] is None


async def test_avoided_treatment_is_pending_until_the_vitrus_cost_arrives(logged_in: httpx.AsyncClient) -> None:
    body = (await logged_in.get(f"{P}/parameters")).json()
    assert body["values"]["rsu_treatment_eur_per_t"] is None
    meta = {m["key"]: m for m in body["meta"]}
    assert "financeiro" in meta["rsu_treatment_eur_per_t"]["note"]
    pending = (await logged_in.post(f"{P}/scenarios", json=request_body(budget_eur_year=20000))).json()
    assert pending["result"]["kpis"]["avoided_treatment_eur"] is None  # «por validar»
    params = {**body["values"], "rsu_treatment_eur_per_t": 50.0}
    priced = (await logged_in.post(f"{P}/scenarios", json=request_body(budget_eur_year=20000, params=params))).json()
    k = priced["result"]["kpis"]
    assert k["avoided_treatment_eur"] == pytest.approx(k["tonnes_year"] * 50, abs=0.01)
