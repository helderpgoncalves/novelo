"""Sensibilidade, robustez, benchmarks e piloto sobre os dados reais (48 freguesias, Censos 2021)."""

import uuid
from collections.abc import AsyncGenerator

import httpx
import pytest
from fastapi import Depends
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import get_current_user
from novelo.core.errors import COMMON_ERRORS
from novelo.features.planning.insights_router import router as insights_router
from novelo.features.users.models import User
from novelo.main import create_app
from tests.conftest import PASSWORD

P = "/api/v1/planning"


@pytest.fixture
async def api(session: AsyncSession) -> AsyncGenerator[httpx.AsyncClient, None]:
    """A app completa com o router de insights montado (o `main.py` ainda não o inclui)."""
    app = create_app()
    app.include_router(
        insights_router,
        prefix=P,
        tags=["planning"],
        dependencies=[Depends(get_current_user)],
        responses=COMMON_ERRORS,
    )

    async def _db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_db] = _db
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.post(
            "/api/v1/auth/register", json={"email": "ana@vitrus.pt", "password": PASSWORD, "name": "Ana"}
        )
        assert resp.status_code == 201
        await session.execute(update(User).where(User.email == "ana@vitrus.pt").values(approval_status="approved"))
        await session.commit()
        yield c


async def scenario(api: httpx.AsyncClient, budget: float, **extra: object) -> dict[str, object]:
    body = {"label": f"Orçamento {budget}", "objective": "max_tonnes", "budget_eur_year": budget, **extra}
    resp = await api.post(f"{P}/scenarios", json=body)
    assert resp.status_code == 201
    return resp.json()  # type: ignore[no-any-return]


async def test_sensitivity_reproduces_the_scenario_and_orders_the_tornado(api: httpx.AsyncClient) -> None:
    s = await scenario(api, 60_000)
    resp = await api.post(f"{P}/scenarios/{s['id']}/sensitivity", json={"threshold_eur_per_tonne": 200})
    assert resp.status_code == 200
    out = resp.json()

    # com os pressupostos centrais, a reavaliação reproduz os KPIs do cenário gravado
    assert out["base"]["tonnes"] == pytest.approx(s["tonnes_year"], rel=0.005)
    assert out["base"]["annual_cost_eur"] == pytest.approx(s["annual_cost_eur"], rel=0.01)
    assert out["base"]["eur_per_tonne"] == pytest.approx(s["eur_per_tonne"], rel=0.015)

    bars = out["tornado"]
    assert len(bars) >= 10
    swings = [b["swing_eur_per_tonne"] for b in bars]
    assert swings == sorted(swings, reverse=True) and swings[0] > 0
    assert all(b["source"] in {"plan", "vitrus_data", "assumption"} and b["unit"] is not None for b in bars)
    assert 0 <= out["assumption_share_of_top_drivers"] <= 1

    e = out["eur_per_tonne"]
    assert e["p10"] < e["p50"] < e["p90"]
    assert e["p10"] < out["base"]["eur_per_tonne"] < e["p90"]
    assert 0 <= out["prob_below_threshold"] <= 1
    assert out["n_samples"] == 500 and "não resolve o otimizador" in out["method"]

    again = await api.post(f"{P}/scenarios/{s['id']}/sensitivity", json={"threshold_eur_per_tonne": 200})
    assert again.json() == out  # semente fixa: mesma entrada, mesma resposta


async def test_sensitivity_errors(api: httpx.AsyncClient) -> None:
    missing = await api.post(f"{P}/scenarios/{uuid.uuid4()}/sensitivity", json={})
    assert missing.status_code == 404 and missing.json()["code"] == "not_found"
    infeasible = (
        await api.post(f"{P}/scenarios", json={"label": "x", "objective": "min_cost", "target_tonnes": 99999})
    ).json()
    resp = await api.post(f"{P}/scenarios/{infeasible['id']}/sensitivity", json={})
    assert resp.status_code == 409 and resp.json()["code"] == "conflict"
    s = await scenario(api, 30_000)
    assert (await api.post(f"{P}/scenarios/{s['id']}/sensitivity", json={"swing": 1.5})).status_code == 422


async def test_robustness_compares_two_scenarios_with_paired_samples(api: httpx.AsyncClient) -> None:
    big, small = await scenario(api, 90_000), await scenario(api, 15_000)
    resp = await api.get(
        f"{P}/compare-robustness",
        params={"recommended_id": big["id"], "alternative_id": small["id"], "criterion": "tonnes", "n_samples": 200},
    )
    assert resp.status_code == 200
    out = resp.json()
    # 90 000 €/ano capta muito mais toneladas do que 15 000: ganha em todas as amostras
    assert out["share_recommended_better"] == 1.0 and out["holds"] and out["median_advantage"] > 100
    assert out["base_recommended"]["tonnes"] > out["base_alternative"]["tonnes"]

    same = await api.get(
        f"{P}/compare-robustness", params={"recommended_id": big["id"], "alternative_id": big["id"], "n_samples": 100}
    )
    assert same.json()["share_recommended_better"] == 0.0 and same.json()["holds"] is False


async def test_benchmarks_expose_assumptions_source_and_consequences(api: httpx.AsyncClient) -> None:
    (b,) = (await api.get(f"{P}/benchmarks")).json()
    assert b["key"] == "french_performance" and b["verified"] is False
    assert (b["kg_per_inhab_year"], b["people_per_point"], b["density_mode"]) == (4.27, 1414, "street")
    assert "verificar" in b["source"] and "Refashion" in b["source"]
    assert b["population"] == 156_830  # Censos 2021, INE
    assert b["target_tonnes"] == pytest.approx(156_830 * 4.27 / 1000, abs=0.1)
    # 4,27 ÷ 19,1499 (têxtil no lixo por habitante e ano, 51 250,6 t × 5,86% ÷ 156 830) = 22,3%
    assert b["implied_capture_pct"] == pytest.approx(22.3, abs=0.05)
    assert b["observed_capture_pct"] == pytest.approx(9.1, abs=0.05)  # 301,27 ÷ 3 304,6
    assert b["observed_kg_per_inhab_year"] == pytest.approx(301.3 * 1000 / 156_830, abs=0.05)  # ~1,92 kg/hab/ano
    assert b["current_people_per_point"] == 1500
    assert b["reachable"] == (b["target_tonnes"] <= b["max_capturable_t"])


async def test_benchmark_scenario_reuses_create_scenario(api: httpx.AsyncClient) -> None:
    (b,) = (await api.get(f"{P}/benchmarks")).json()
    resp = await api.post(
        f"{P}/benchmarks/french_performance/scenario", json={"objective": "max_tonnes", "budget_eur_year": 90_000}
    )
    assert resp.status_code == 201
    s = resp.json()
    assert s["label"] == "Desempenho francês" and s["status"] == "computed"
    assert s["params"]["modes"]["street"]["people_per_point"] == 1414
    assert s["params"]["modes"]["existing"]["people_per_point"] == 4000  # os outros modos não mudam
    assert s["target_tonnes"] == pytest.approx(b["target_tonnes"])
    assert s["result"]["kpis"]["annual_cost_eur"] <= 90_000 * 1.02
    assert s["result"]["default_modes"] == ["existing", "street", "on_demand"]  # rua só aqui, como referência

    by_target = (await api.post(f"{P}/benchmarks/french_performance/scenario", json={"label": "Meta FR"})).json()
    assert by_target["objective"] == "min_cost"
    assert by_target["status"] == ("computed" if b["reachable"] else "infeasible")

    assert (await api.post(f"{P}/benchmarks/nope/scenario", json={})).status_code == 404
    no_budget = await api.post(f"{P}/benchmarks/french_performance/scenario", json={"objective": "max_tonnes"})
    assert no_budget.status_code == 422


async def test_pilot_recommends_two_parishes_with_numbers_from_the_data(api: httpx.AsyncClient) -> None:
    zones = {z["code"]: z for z in (await api.get(f"{P}/zones")).json()}
    resp = await api.post(f"{P}/pilot", json={})
    assert resp.status_code == 200
    out = resp.json()
    assert out["k"] == 2 and out["months"] == 3 and len(out["zones"]) == 2
    assert out["modes"] == ["existing", "on_demand"] and out["estimate"] is True  # sem contentores de têxtil

    for z in out["zones"]:
        facts = {f["key"]: f for f in z["facts"]}
        source = zones[z["parish_code"]]
        assert (
            facts["population"]["value"] == source["population"] and facts["population"]["source"] == "INE, Censos 2021"
        )
        assert facts["service_days"]["value"] == source["service_days"]
        assert facts["demand_t"]["value"] == pytest.approx(source["demand_t"], abs=0.1)
        assert z["tipau"] == source["tipau"]

    kpis = {k["key"]: k for k in out["kpis"]}
    assert set(kpis) == {"tonnes", "eur_per_tonne", "reject_rate_pct"}
    for k in kpis.values():
        assert k["p10"] < k["value"] < k["p90"]
    assert kpis["reject_rate_pct"]["value"] == pytest.approx(14.1, abs=0.1)  # observado em 2025
    assert out["rationale"] and all(z["parish_name"] in " ".join(out["rationale"]) for z in out["zones"])
    assert 0 < out["score"]["score"] <= 1
    assert sum(
        out["score"][w] for w in ("weight_tipau", "weight_density", "weight_coverage", "weight_cost")
    ) == pytest.approx(1)

    # a densidade vem da área geodésica calculada no seed (população INE / km²)
    assert all("density" in {f["key"] for f in z["facts"]} for z in out["zones"])
    assert {z["parish_name"] for z in out["zones"]} != {"Gonça", "Pinheiro"}

    floor = out["signal_floor"]
    cells = out["k"] * len(out["modes"])
    assert floor["computed"] and floor["floor_met"] and floor["tonnes_pilot"] >= floor["min_tonnes_pilot"]
    assert floor["min_tonnes_pilot"] == pytest.approx(cells * floor["calculation"][6]["value"], abs=0.01)
    assert 0 <= floor["combos_below_floor"] < floor["combos_total"] == 1128  # C(48, 2)
    assert "descartadas" in floor["explanation"]

    free = (await api.post(f"{P}/pilot", json={"min_tonnes_pilot": 0})).json()
    assert free["signal_floor"]["combos_below_floor"] == 0 and not free["signal_floor"]["computed"]
    impossible = (await api.post(f"{P}/pilot", json={"min_tonnes_pilot": 9999})).json()
    assert impossible["signal_floor"]["floor_met"] is False
    assert impossible["signal_floor"]["combos_below_floor"] == 1128

    assert (await api.post(f"{P}/pilot", json={})).json() == out  # determinista
    three = (await api.post(f"{P}/pilot", json={"k": 3, "months": 6})).json()
    assert len(three["zones"]) == 3 and three["months"] == 6
    assert (await api.post(f"{P}/pilot", json={"k": 1})).status_code == 422
