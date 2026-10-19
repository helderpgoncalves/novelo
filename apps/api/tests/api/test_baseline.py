import pytest
from fastapi.testclient import TestClient

from novelo.main import create_app


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(create_app())


def test_health(client: TestClient) -> None:
    assert client.get("/api/v1/health").json() == {"status": "ok"}


def test_textile_baseline_matches_excel_totals(client: TestClient) -> None:
    body = client.get("/api/v1/baseline/textile").json()
    assert body["total_t"] == pytest.approx(301.265, abs=0.001)
    assert body["reuse_t"] + body["recycle_t"] + body["reject_t"] == pytest.approx(
        body["total_t"], abs=0.01
    )
    assert {e["entity"] for e in body["entities"]} == {
        "H Sarah Trading",
        "Nova Etapa",
        "Ultriplo",
        "Vitrus",
    }


def test_circuits_summary(client: TestClient) -> None:
    body = client.get("/api/v1/baseline/circuits").json()
    assert body["total"] == 40
    assert body["without_vehicle"] == 9


def test_observed_flows_conserve_mass(client: TestClient) -> None:
    body = client.get("/api/v1/baseline/flows").json()
    assert sum(link["tonnes"] for link in body["links"]) == pytest.approx(301.265, abs=0.01)
