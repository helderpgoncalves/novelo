import httpx
import pytest


async def test_health(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/v1/health")).json() == {"status": "ok"}


async def test_baseline_requires_login(client: httpx.AsyncClient) -> None:
    resp = await client.get("/api/v1/baseline/textile")
    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthorized"


async def test_textile_baseline_matches_excel_totals(logged_in: httpx.AsyncClient) -> None:
    body = (await logged_in.get("/api/v1/baseline/textile")).json()
    assert body["total_t"] == pytest.approx(301.265, abs=0.001)
    assert body["reuse_t"] + body["recycle_t"] + body["reject_t"] == pytest.approx(body["total_t"], abs=0.01)
    assert {e["entity"] for e in body["entities"]} == {"H Sarah Trading", "Nova Etapa", "Ultriplo", "Vitrus"}


async def test_circuits_summary(logged_in: httpx.AsyncClient) -> None:
    body = (await logged_in.get("/api/v1/baseline/circuits")).json()
    assert body["total"] == 40
    assert body["without_vehicle"] == 9


async def test_observed_flows_conserve_mass(logged_in: httpx.AsyncClient) -> None:
    body = (await logged_in.get("/api/v1/baseline/flows")).json()
    assert sum(link["tonnes"] for link in body["links"]) == pytest.approx(301.265, abs=0.01)
