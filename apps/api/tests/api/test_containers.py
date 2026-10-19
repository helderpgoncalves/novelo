"""Contentores: ETL de um ficheiro FALSO -> seed -> API de lista, cobertura e planeamento."""

import shutil
from pathlib import Path

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.config import get_settings
from novelo.features.network.models import Container
from novelo.seed import seed
from tests.unit.test_etl_containers import FIXTURES, etl

NETWORK = "/api/v1/network"
PLANNING = "/api/v1/planning"


async def test_coverage_awaits_data_without_containers(logged_in: httpx.AsyncClient) -> None:
    resp = await logged_in.get(f"{NETWORK}/coverage")
    assert resp.status_code == 200
    body = (resp).json()
    assert body["state"] == "awaiting_data" and body["is_estimate"] is True
    assert body["parishes"] == [] and body["covered_pct"] is None and body["gap_points"] is None
    assert body["population"] == 156_830
    assert body["reference"]["people_per_point"] == 1414
    assert body["reference"]["points"] == 111  # 156 830 / 1 414 = 110,9
    assert body["reference"]["verified"] is False
    listing = (await logged_in.get(f"{NETWORK}/containers")).json()
    assert listing == {"items": [], "total": 0}


async def test_coverage_validates_radius(logged_in: httpx.AsyncClient) -> None:
    assert (await logged_in.get(f"{NETWORK}/coverage", params={"radius_m": 5})).status_code == 422


@pytest.fixture
async def imported(session: AsyncSession, tmp_path: Path) -> Path:
    """Copia data/processed para uma pasta temporária, junta os contentores falsos e importa."""
    data = tmp_path / "processed"
    shutil.copytree(get_settings().data_dir, data)
    raw = tmp_path / "raw"
    raw.mkdir()
    shutil.copy(FIXTURES / "contentores_teste.csv", raw / "contentores_teste.csv")
    assert etl.run(raw, data)["status"] == "ok"
    counts = await seed(session, data)
    assert counts["containers"] == 6 and counts["container_alerts"] == 3
    return data


async def test_seed_is_idempotent(session: AsyncSession, imported: Path) -> None:
    assert (await session.execute(select(func.count()).select_from(Container))).scalar_one() == 6
    await seed(session, imported)
    assert (await session.execute(select(func.count()).select_from(Container))).scalar_one() == 6


async def test_list_containers_filters_and_assigns_parish(logged_in: httpx.AsyncClient, imported: Path) -> None:
    body = (await logged_in.get(f"{NETWORK}/containers")).json()
    assert body["total"] == 6  # TESTE-005 (sem coordenadas) não entra na base de dados
    first = next(c for c in body["items"] if c["external_ref"] == "TESTE-001")
    assert first["parish_code"] == "030804"  # o ponto cai no polígono de Azurém
    assert (first["kind"], first["status"], first["capacity_litres"]) == ("textile", "active", 2500)
    textile = (await logged_in.get(f"{NETWORK}/containers", params={"kind": "textile"})).json()
    assert [c["external_ref"] for c in textile["items"]] == ["TESTE-001", "TESTE-002", "TESTE-009"]
    inactive = (await logged_in.get(f"{NETWORK}/containers", params={"status": "inactive"})).json()
    assert [c["external_ref"] for c in inactive["items"]] == ["TESTE-003"]
    page = (await logged_in.get(f"{NETWORK}/containers", params={"limit": 2, "offset": 4})).json()
    assert page["total"] == 6 and len(page["items"]) == 2


async def test_coverage_by_parish_hand_checked(logged_in: httpx.AsyncClient, imported: Path) -> None:
    # Azurém (9 089 hab.): 2 localidades no mesmo ponto, a 479 m do contentor TESTE-001 (e a 583 m do TESTE-002)
    wide = (await logged_in.get(f"{NETWORK}/coverage", params={"radius_m": 500})).json()
    assert wide["state"] == "ok" and wide["kind"] == "textile"
    assert (wide["containers"], wide["containers_total"]) == (3, 6)  # têxteis ativos / todos
    assert wide["containers_per_1000"] == 0.02  # 3 · 1000 / 156 830
    assert wide["reference"]["points"] == 111 and wide["gap_points"] == 108
    azurem = next(p for p in wide["parishes"] if p["parish_code"] == "030804")
    assert azurem["population"] == 9089 and azurem["containers"] == 2
    assert azurem["containers_per_1000"] == 0.22  # 2 · 1000 / 9 089
    assert azurem["nearest_container_m"] == 479
    assert (azurem["covered_pct"], azurem["covered_population"]) == (100.0, 9089)
    assert (azurem["reference_points"], azurem["gap_points"]) == (6, 4)  # 9 089 / 1 414 = 6,4
    assert len(wide["parishes"]) == 48

    narrow = (await logged_in.get(f"{NETWORK}/coverage", params={"radius_m": 300})).json()
    azurem = next(p for p in narrow["parishes"] if p["parish_code"] == "030804")
    assert (azurem["covered_pct"], azurem["covered_population"]) == (0.0, 0)
    assert narrow["covered_pct"] < wide["covered_pct"]


async def test_other_kind_counts_only_that_kind(logged_in: httpx.AsyncClient, imported: Path) -> None:
    body = (await logged_in.get(f"{NETWORK}/coverage", params={"kind": "recyclable"})).json()
    assert body["containers"] == 0  # TESTE-004 está planeado, não ativo
    assert body["containers_total"] == 6 and body["covered_pct"] == 0.0


async def test_container_alerts_reach_data_quality_screen(logged_in: httpx.AsyncClient, imported: Path) -> None:
    body = (await logged_in.get("/api/v1/datasets/quality")).json()
    alerts = [a for a in body["alerts"] if a["source_key"] == "vitrus_containers"]
    assert sorted(a["kind"] for a in alerts) == [
        "container_assumed_values",
        "container_pending_location",
        "container_rows_rejected",
    ]
    assert any(s["key"] == "vitrus_containers" and len(s["file_sha256"]) == 64 for s in body["sources"])


async def test_existing_mode_sees_real_containers(logged_in: httpx.AsyncClient, imported: Path) -> None:
    zones = {z["code"]: z for z in (await logged_in.get(f"{PLANNING}/zones")).json()}
    assert zones["030804"]["existing_containers"] == 2  # TESTE-001 e TESTE-002
    assert zones["0308U4"]["existing_containers"] == 1  # TESTE-009
    assert sum(z["existing_containers"] for z in zones.values()) == 3
