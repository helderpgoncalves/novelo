import httpx
import pytest


async def test_textile_baseline_matches_excel_totals(logged_in: httpx.AsyncClient) -> None:
    body = (await logged_in.get("/api/v1/textile/baseline")).json()
    assert body["total_t"] == pytest.approx(301.265, abs=0.01)
    assert body["reuse_t"] + body["recycle_t"] + body["reject_t"] == pytest.approx(body["total_t"], abs=0.01)
    assert [e["entity"] for e in body["entities"]][:2] == ["Ultriplo", "H Sarah Trading"]  # por toneladas
    by_name = {e["entity"]: e for e in body["entities"]}
    assert by_name["Ultriplo"]["method"] == "weighed"
    assert by_name["Nova Etapa"]["method"] == "percentage"
    # gerado = 43 051 t × 5,4% (Vitrus + APA) + 301,27 t = 2 626,0 t; captura 301,27 ÷ 2 626,0 = 11,5%
    assert body["estimated_demand_t"] == pytest.approx(2626.0, abs=0.1)
    assert body["gap_t"] == pytest.approx(2324.8, abs=0.1)  # o que ainda vai para o lixo
    assert body["capture_of_demand_pct"] == pytest.approx(11.5, abs=0.05)


async def test_observed_flows_conserve_mass(logged_in: httpx.AsyncClient) -> None:
    body = (await logged_in.get("/api/v1/textile/flows")).json()
    assert sum(link["tonnes"] for link in body["links"]) == pytest.approx(301.265, abs=0.01)
    assert {n["destination"] for n in body["nodes"] if n["destination"]} == {"reuse", "recycle", "reject"}


async def test_waste_composition_has_textiles(logged_in: httpx.AsyncClient) -> None:
    body = (await logged_in.get("/api/v1/textile/waste")).json()
    pt = {s["category"]: s["share_pct"] for s in body["shares"] if s["scope"] == "portugal"}
    assert pt["textiles"] == pytest.approx(4.55)
    assert pt["sanitary_textiles"] == pytest.approx(9.1)
