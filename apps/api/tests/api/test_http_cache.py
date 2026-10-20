"""Cache HTTP dos dados quase estáticos: ETag estável, 304, invalidação quando os dados mudam, nada partilhado."""

from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.datasets.models import DataSource

P = "/api/v1"
REFERENCE = [
    f"{P}/textile/baseline",
    f"{P}/textile/flows",
    f"{P}/textile/waste",
    f"{P}/network/circuits",
    f"{P}/network/fleet",
    f"{P}/network/localities",
    f"{P}/network/containers",
    f"{P}/network/coverage",
]
PLANNING = [f"{P}/planning/zones", f"{P}/planning/parameters"]


@pytest.mark.parametrize("url", REFERENCE + PLANNING)
async def test_etag_is_stable_and_revalidates_with_304(logged_in: httpx.AsyncClient, url: str) -> None:
    first = await logged_in.get(url)
    assert first.status_code == 200
    etag = first.headers["etag"]
    assert etag == (await logged_in.get(url)).headers["etag"]  # estável entre pedidos
    cc = first.headers["cache-control"]
    assert cc.startswith("private, max-age=") and "Cookie" in first.headers["vary"]
    assert "Accept-Encoding" in first.headers["vary"]
    again = await logged_in.get(url, headers={"If-None-Match": etag})
    assert again.status_code == 304 and again.content == b"" and again.headers["etag"] == etag
    assert (await logged_in.get(url, headers={"If-None-Match": 'W/"outro"'})).status_code == 200


async def test_reference_data_is_cached_for_minutes_but_planning_data_always_revalidates(
    logged_in: httpx.AsyncClient,
) -> None:
    assert (await logged_in.get(f"{P}/textile/baseline")).headers["cache-control"] == "private, max-age=300"
    zones = await logged_in.get(f"{P}/planning/zones")
    assert zones.headers["cache-control"] == "private, max-age=0, must-revalidate"  # a edição de pressupostos vê-se já


async def test_etag_depends_on_the_query(logged_in: httpx.AsyncClient) -> None:
    a = (await logged_in.get(f"{P}/network/coverage", params={"radius_m": 300})).headers["etag"]
    b = (await logged_in.get(f"{P}/network/coverage", params={"radius_m": 500})).headers["etag"]
    assert a != b
    stale = await logged_in.get(f"{P}/network/coverage", params={"radius_m": 500}, headers={"If-None-Match": a})
    assert stale.status_code == 200  # o ETag de outra query não valida esta


async def test_zones_are_gzipped_when_accepted_and_identical_when_decoded(logged_in: httpx.AsyncClient) -> None:
    plain = await logged_in.get(f"{P}/planning/zones", headers={"Accept-Encoding": "identity"})
    packed = await logged_in.get(f"{P}/planning/zones", headers={"Accept-Encoding": "gzip"})
    assert "content-encoding" not in plain.headers and packed.headers["content-encoding"] == "gzip"
    assert packed.json() == plain.json() and len(plain.json()) == 48
    assert packed.num_bytes_downloaded < plain.num_bytes_downloaded / 2


async def test_parameter_update_invalidates_zones_and_parameters(make_user: Any) -> None:
    admin: httpx.AsyncClient = await make_user("admin@x.pt", "admin")
    zones = await admin.get(f"{P}/planning/zones")
    params = await admin.get(f"{P}/planning/parameters")
    values = params.json()["values"]
    values["kg_per_inhab_month"] = 0.5
    assert (await admin.put(f"{P}/planning/parameters", json=values)).status_code == 200
    for old, url in ((zones, "zones"), (params, "parameters")):
        fresh = await admin.get(f"{P}/planning/{url}", headers={"If-None-Match": old.headers["etag"]})
        assert fresh.status_code == 200 and fresh.headers["etag"] != old.headers["etag"], url
    new_zones = (await admin.get(f"{P}/planning/zones")).json()
    assert new_zones[0]["demand_t"] != zones.json()[0]["demand_t"]  # e o conteúdo novo chega mesmo


async def test_new_import_invalidates_reference_data(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    before = await logged_in.get(f"{P}/network/circuits")
    await session.execute(
        update(DataSource).where(DataSource.key.like("vitrus_circuits%")).values(imported_at=datetime.now(UTC))
    )
    await session.flush()
    after = await logged_in.get(f"{P}/network/circuits", headers={"If-None-Match": before.headers["etag"]})
    assert after.status_code == 200 and after.headers["etag"] != before.headers["etag"]


async def test_cache_needs_a_session_and_is_never_public(
    client: httpx.AsyncClient, logged_in: httpx.AsyncClient
) -> None:
    anonymous = httpx.AsyncClient(transport=client._transport, base_url="http://test")
    try:
        resp = await anonymous.get(f"{P}/planning/zones")
        assert resp.status_code == 401 and "etag" not in resp.headers  # sem sessão não há 304 nem cache
    finally:
        await anonymous.aclose()
    for url in REFERENCE + PLANNING:
        assert "public" not in (await logged_in.get(url)).headers["cache-control"]


async def test_per_user_data_is_not_cached(logged_in: httpx.AsyncClient) -> None:
    for url in (
        f"{P}/planning/scenarios",
        f"{P}/datasets/quality",
        f"{P}/textile/overview",
        f"{P}/lots",
        f"{P}/reports",
    ):
        resp = await logged_in.get(url)
        assert "etag" not in resp.headers and "max-age" not in resp.headers.get("cache-control", ""), url
