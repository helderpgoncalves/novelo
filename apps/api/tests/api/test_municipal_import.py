"""Importação da rede municipal: idempotência, limpeza, alertas, isolamento dos têxteis e totais reais."""

import shutil
from collections.abc import Awaitable, Callable
from pathlib import Path

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.domain.vocab import AlertStatus
from novelo.features.datasets.models import DataAlert, DataSource
from novelo.features.municipal.importer import MUNICIPAL_SOURCE, has_package, import_municipal
from novelo.features.municipal.models import (
    MunicipalContainer,
    MunicipalLink,
    MunicipalMeta,
    MunicipalParishStat,
    MunicipalSite,
)
from novelo.features.network.models import Container
from tests.conftest import MUNICIPAL_FIXTURE

M = "/api/v1/municipal"
MakeUser = Callable[..., Awaitable[httpx.AsyncClient]]


async def count(session: AsyncSession, model: type) -> int:
    return (await session.execute(select(func.count()).select_from(model))).scalar_one()


async def source_id(session: AsyncSession) -> object:
    return (await session.execute(select(DataSource.id).where(DataSource.key == MUNICIPAL_SOURCE))).scalar_one()


async def test_import_counts_and_idempotence(session: AsyncSession, municipal: None) -> None:
    sid = await source_id(session)
    first = {
        m: await count(session, m)
        for m in (MunicipalContainer, MunicipalSite, MunicipalParishStat, MunicipalLink, MunicipalMeta)
    }
    assert first == {
        MunicipalContainer: 11,
        MunicipalSite: 6,
        MunicipalParishStat: 3,
        MunicipalLink: 1,
        MunicipalMeta: 2,
    }
    counts = await import_municipal(session, MUNICIPAL_FIXTURE, sid)  # type: ignore[arg-type]
    assert counts == {
        "municipal_containers": 11, "municipal_sites": 6, "municipal_parishes": 3, "municipal_links": 1, "municipal_alerts": 2,
    }  # fmt: skip
    again = {m: await count(session, m) for m in first}
    assert again == first  # duas importações dão o mesmo


async def test_import_keeps_the_textile_containers_table_untouched(session: AsyncSession, municipal: None) -> None:
    assert await count(session, Container) == 0  # a rede municipal nunca vai para `containers`


async def test_import_removes_what_left_the_file_and_keeps_alert_state(
    session: AsyncSession, municipal: None, tmp_path: Path
) -> None:
    sid = await source_id(session)
    alert = (
        await session.execute(select(DataAlert).where(DataAlert.source_id == sid, DataAlert.number == 1))
    ).scalar_one()
    alert.status = AlertStatus.RESOLVED
    alert.resolution_note = "visto com a Vitrus"
    await session.flush()

    data = tmp_path / "pkg"
    shutil.copytree(MUNICIPAL_FIXTURE, data)
    # tira o contentor pendente (C900), o local S6 com o seu contentor e o 2.º alerta; muda o texto do 1.º
    for name, drop in (
        ("municipal_containers.csv", ("superficie:C900", "residuos_verdes:BC10")),
        ("municipal_sites.csv", ("S0000006f",)),
    ):
        lines = (data / name).read_text(encoding="utf-8").splitlines(keepends=True)
        kept = [ln for i, ln in enumerate(lines) if i == 0 or not any(d in ln for d in drop)]
        (data / name).write_text("".join(kept), encoding="utf-8")
    alerts = (data / "municipal_alerts.csv").read_text(encoding="utf-8").replace("de teste são", "do pacote são")
    (data / "municipal_alerts.csv").write_text("\n".join(alerts.splitlines()[:2]) + "\n", encoding="utf-8")

    await import_municipal(session, data, sid)  # type: ignore[arg-type]
    await session.flush()
    assert await count(session, MunicipalContainer) == 9 and await count(session, MunicipalSite) == 5
    remaining = (await session.execute(select(DataAlert).where(DataAlert.source_id == sid))).scalars().all()
    assert [a.number for a in remaining] == [1] and "do pacote" in remaining[0].detail
    assert remaining[0].status == AlertStatus.RESOLVED and remaining[0].resolution_note == "visto com a Vitrus"


async def test_municipal_alerts_show_up_in_the_data_quality_screen(municipal: None, make_user: MakeUser) -> None:
    user = await make_user("qualidade@vitrus.pt", "operator")
    body = (await user.get("/api/v1/datasets/quality")).json()
    municipal_alerts = [a for a in body["alerts"] if a["source_key"] == MUNICIPAL_SOURCE]
    assert sorted(a["kind"] for a in municipal_alerts) == ["municipal_coords_missing", "municipal_not_textile"]
    assert any(s["key"] == MUNICIPAL_SOURCE and s["provider"] == "Vitrus Ambiente" for s in body["sources"])


def test_package_detection(tmp_path: Path) -> None:
    assert has_package(MUNICIPAL_FIXTURE) is True
    assert has_package(tmp_path) is False


# --- dados reais (sem a amostra): totais de docs/dados/analise-contentores-municipais.md ----------------------


async def test_real_package_totals(make_user: MakeUser) -> None:
    user = await make_user("real@vitrus.pt", "operator")
    o = (await user.get(f"{M}/overview")).json()
    assert (
        o["containers"]["accepted"] == 2751 and o["containers"]["located"] == 2722 and o["containers"]["pending"] == 29
    )
    assert o["containers"]["rejected"] == 3 and o["containers"]["capacity_litres_total"] == 4_315_830
    assert o["sites"]["total"] == 2026 and (o["sites"]["public"], o["sites"]["producer"], o["sites"]["mixed"]) == (
        1573,
        452,
        1,
    )
    assert (o["sites"]["textile_candidates"], o["sites"]["textile_candidates_precise"]) == (1187, 837)
    assert o["sites"]["textile_candidates_underground"] == 589 and o["sites"]["max_containers"] == 32
    assert o["density"]["population"] == 156_830 and o["density"]["containers_per_1000_hab"] == 17.4
    assert o["density"]["public_sites_per_1000_hab"] == 10.0
    assert (o["coverage"]["pct_200m"], o["coverage"]["pct_300m"], o["coverage"]["pct_500m"]) == (31.4, 47.8, 70.9)
    assert o["coverage"]["parishes_half_covered_300m"] == 26 and o["coverage"]["parishes_under_quarter_300m"] == 6
    assert (o["quality"]["parish_compared"], o["quality"]["parish_equal"], o["quality"]["parish_equal_pct"]) == (
        2670,
        2354,
        88.2,
    )
    assert o["quality"]["containers_coord_suspect"] == 79 and o["quality"]["alerts_total"] == 25
    assert o["quality"]["sites_precise"] == 1676 and o["quality"]["sites_approximate"] == 350
    kinds = {k["kind"]: k["containers"] for k in o["by_kind"]}
    assert kinds == {
        "underground": 591,
        "platform": 2,
        "surface": 793,
        "organic_collective": 397,
        "organic_producer": 922,
        "green_waste": 46,
    }
    assert {p["type"]: p["containers"] for p in o["by_producer_type"]} == {
        "restaurant": 446, "school": 250, "establishment": 93, "large_producer": 65, "care_home": 47, "hospitality": 21,
    }  # fmt: skip
    assert o["by_producer_type"][0]["producers_distinct"] > 0
    assert o["containers"]["brands"] == {"molok": 488, "bluebee": 66, "greenbee": 37}


async def test_real_package_parishes_gap_and_caop(make_user: MakeUser) -> None:
    user = await make_user("real2@vitrus.pt", "operator")
    parishes = (await user.get(f"{M}/parishes")).json()
    assert parishes["total"] == 48 and sum(p["containers"] for p in parishes["items"]) == 2722
    gap = (await user.get(f"{M}/gap-ranking", params={"limit": 5})).json()
    assert [r["name"] for r in gap["items"]][:2] == ["Lordelo", "União das freguesias de Tabuadelo e São Faustino"]
    assert gap["items"][0]["gap_t_per_candidate_site"] == 25.78 and gap["parameters"]["capture_pct"] == 22.9
    caop = (await user.get(f"{M}/parishes/caop.geojson")).json()
    assert len(caop["features"]) == 48 and all(
        f["geometry"]["type"] in {"Polygon", "MultiPolygon"} for f in caop["features"]
    )
    candidates = (await user.get(f"{M}/textile-candidates", params={"limit": 3})).json()
    assert candidates["total"] == 1187 and candidates["total_precise"] == 837
    assert [c["rank"] for c in candidates["items"]] == [1, 2, 3] and all(
        c["site"]["coord_precision"] == "precise" for c in candidates["items"]
    )
    assert (await user.get(f"{M}/containers", params={"limit": 1})).json()["total"] == 2751
    density = (await user.get(f"{M}/density-benchmark")).json()
    assert (
        density["textile_reference"]["reference_points"] == 111
        and density["textile_reference"]["candidate_sites"] == 1187
    )
    producers = (await user.get(f"{M}/producers", params={"limit": 1})).json()
    assert producers["total"] > 400 and all(i["producer_names"] is None for i in producers["items"])
