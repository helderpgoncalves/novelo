"""Rede municipal: API de leitura sobre uma amostra feita à mão (tests/fixtures/municipal).

A amostra tem 3 freguesias, 6 locais e 11 contentores (1 pendente). Todos os valores esperados foram calculados à mão
(ver os comentários); os nomes de produtores são "Restaurante Teste Um" e "Hotel Teste".
"""

import io
from collections.abc import Awaitable, Callable
from typing import Any

import httpx
import pytest
from openpyxl import load_workbook
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import load_municipal

M = "/api/v1/municipal"
SECRETS = ("Restaurante Teste", "Hotel Teste", 'producer_name":"R')  # nomes que um não admin nunca vê
MakeUser = Callable[..., Awaitable[httpx.AsyncClient]]


@pytest.fixture
async def operator(municipal: None, make_user: MakeUser) -> httpx.AsyncClient:
    return await make_user("operador@vitrus.pt", "operator")


@pytest.fixture
async def admin(municipal: None, make_user: MakeUser) -> httpx.AsyncClient:
    return await make_user("admin@vitrus.pt", "admin")


def ids(items: list[dict[str, Any]], key: str = "site_id") -> list[str]:
    return [i[key] for i in items]


# --- autenticação -----------------------------------------------------------------------------------------------


async def test_every_route_requires_a_session(client: httpx.AsyncClient, municipal: None) -> None:
    for path in ("/overview", "/parishes", "/parishes/030801", "/sites", "/sites/geojson", "/containers", "/producers",
                 "/textile-candidates", "/gap-ranking", "/density-benchmark", "/export", "/parishes/caop.geojson"):  # fmt: skip
        resp = await client.get(M + path)
        assert resp.status_code == 401, path
        assert resp.json()["code"] == "unauthenticated"


# --- visão geral ------------------------------------------------------------------------------------------------


async def test_overview_values_are_hand_checked(operator: httpx.AsyncClient) -> None:
    body = (await operator.get(f"{M}/overview")).json()
    # 11 contentores aceites; 10 com coordenadas; 1 pendente (C900); 1 rejeitado vem do resumo do ETL
    assert body["containers"] == {
        "accepted": 11, "located": 10, "pending": 1, "rejected": 1,
        "capacity_litres_total": 11770,  # 6100 + 1100 + 3300 + 80 + 90 + 1100; o pendente tem capacidade "???"
        "capacity_unknown": 1, "brands": {"bluebee": 1},
    }  # fmt: skip
    # locais: S1, S2, S3, S6 públicos; S4, S5 de produtores; 3 com 1 contentor; máximo 3 (S3)
    sites = body["sites"]
    assert (sites["total"], sites["public"], sites["producer"], sites["mixed"]) == (6, 4, 2, 0)
    assert (sites["single_container"], sites["max_containers"]) == (3, 3)
    # candidatos: S1 (precisa, enterrado), S2 e S3 (aproximadas)
    assert (
        sites["textile_candidates"],
        sites["textile_candidates_precise"],
        sites["textile_candidates_underground"],
    ) == (3, 1, 1)
    d = body["density"]
    assert (d["population"], d["area_km2"]) == (4520, 7.0)  # 1000 + 3000 + 520; 2 + 4 + 1
    assert d["containers_per_1000_hab"] == 2.2  # 10 · 1000 / 4520 = 2,21
    assert d["public_sites_per_1000_hab"] == 0.9  # 4 · 1000 / 4520 = 0,88
    assert (d["containers_per_km2"], d["public_sites_per_km2"]) == (1.4, 0.6)  # 10/7 = 1,43; 4/7 = 0,57
    cov = body["coverage"]
    assert cov["is_estimate"] is True and cov["basis"] == "area"
    assert (cov["pct_200m"], cov["pct_300m"], cov["pct_500m"]) == (30.0, 45.0, 70.0)
    assert (cov["parishes_half_covered_300m"], cov["parishes_under_quarter_300m"]) == (1, 1)  # Aldão 60%; Lordelo 10%
    assert cov["nn_distance"]["median_m"] == 862.0
    q = body["quality"]
    assert (q["sites_precise"], q["sites_approximate"]) == (2, 4)
    assert q["containers_coord_suspect"] == 1  # C004
    assert (q["parish_compared"], q["parish_equal"], q["parish_equal_pct"]) == (10, 9, 90.0)  # sem C900 (sem_coord)
    assert q["stream_unknown_containers"] == 6  # 1 enterrado + 5 de superfície (com o pendente)
    assert q["capacity_assumed_containers"] == 3  # B1, B2, B3 sem unidade
    assert (q["alerts_total"], q["open_alerts"]) == (2, 2)
    kinds = {k["kind"]: (k["containers"], k["located"]) for k in body["by_kind"]}
    assert kinds == {
        "underground": (1, 1), "organic_collective": (1, 1), "surface": (5, 4), "organic_producer": (3, 3), "green_waste": (1, 1),
    }  # fmt: skip
    assert {s["stream"]: s["containers"] for s in body["by_stream"]} == {"organico": 4, "verdes": 1, "desconhecido": 6}
    producers = {p["type"]: (p["containers"], p["producers_distinct"]) for p in body["by_producer_type"]}
    assert producers["restaurant"] == (1, 1) and producers["hospitality"] == (2, 1) and producers["school"] == (0, 0)
    assert body["source"]["not_textile"] is True and "CAOP 2019" in body["source"]["caop_version"]
    assert "coverage" in body["estimates"]["fields"]


async def test_overview_has_etag_and_answers_304(operator: httpx.AsyncClient) -> None:
    first = await operator.get(f"{M}/overview")
    etag = first.headers["etag"]
    assert first.headers["cache-control"] == "private, max-age=300"
    again = await operator.get(f"{M}/overview", headers={"If-None-Match": etag})
    assert again.status_code == 304 and again.content == b"" and again.headers["etag"] == etag
    other = await operator.get(f"{M}/overview", headers={"If-None-Match": 'W/"outro"'})
    assert other.status_code == 200


async def test_etag_changes_with_the_query_and_the_role(operator: httpx.AsyncClient, admin: httpx.AsyncClient) -> None:
    a = (await operator.get(f"{M}/sites")).headers["etag"]
    b = (await operator.get(f"{M}/sites", params={"kind": "surface"})).headers["etag"]
    c = (await admin.get(f"{M}/sites")).headers["etag"]
    assert len({a, b, c}) == 3


async def test_not_imported_yields_404_and_empty_lists(session: AsyncSession, make_user: MakeUser) -> None:
    await load_municipal(session, empty=True)
    c = await make_user("vazio@vitrus.pt", "operator")
    resp = await c.get(f"{M}/overview")
    assert resp.status_code == 404 and resp.json()["code"] == "not_found"
    assert (await c.get(f"{M}/sites")).json()["total"] == 0
    assert (await c.get(f"{M}/parishes")).json()["items"] == []
    assert (await c.get(f"{M}/parishes/caop.geojson")).status_code == 404


# --- freguesias -------------------------------------------------------------------------------------------------


async def test_parishes_list_sort_and_filters(operator: httpx.AsyncClient) -> None:
    def names(body: dict[str, Any]) -> list[str]:
        return [p["name"] for p in body["items"]]

    body = (await operator.get(f"{M}/parishes")).json()
    assert body["total"] == 3 and names(body) == ["Aldão", "Azurém", "Lordelo"]
    assert "textile_gap_t" in body["estimates"]["fields"]
    by_density = (
        await operator.get(f"{M}/parishes", params={"sort": "containers_per_1000_hab", "order": "desc"})
    ).json()
    assert names(by_density) == ["Aldão", "Azurém", "Lordelo"]  # 3,0; 2,0; 1,92
    assert [p["containers_per_1000_hab"] for p in by_density["items"]] == [3.0, 2.0, 1.92]
    by_gap = (await operator.get(f"{M}/parishes", params={"sort": "gap_rank"})).json()
    assert names(by_gap) == ["Azurém", "Lordelo", "Aldão"]
    assert names((await operator.get(f"{M}/parishes", params={"min_population": 1000})).json()) == ["Aldão", "Azurém"]
    assert names((await operator.get(f"{M}/parishes", params={"max_containers_per_1000_hab": 2.0})).json()) == [
        "Azurém",
        "Lordelo",
    ]
    assert names((await operator.get(f"{M}/parishes", params={"has_candidates": False})).json()) == ["Lordelo"]
    assert names((await operator.get(f"{M}/parishes", params={"max_cover_pct_300m": 10})).json()) == ["Lordelo"]
    assert names((await operator.get(f"{M}/parishes", params={"q": "AZUREM"})).json()) == ["Azurém"]  # sem acentos


async def test_parish_detail(operator: httpx.AsyncClient) -> None:
    p = (await operator.get(f"{M}/parishes/030804")).json()
    assert (p["name"], p["population"], p["containers"], p["sites"], p["public_sites"]) == ("Azurém", 3000, 6, 3, 1)
    assert p["by_kind"] == {
        "underground": 0,
        "surface": 3,
        "platform": 0,
        "organic_collective": 0,
        "organic_producer": 3,
        "green_waste": 0,
    }
    assert p["producers"]["hospitality"] == 2 and p["producers"]["restaurant"] == 1
    # estimativa: 3000 · 0,7 · 12 / 1000 = 25,2 t; lacuna com 25% de captura = 18,9 t; 1 candidato
    assert (p["textile_potential_t"], p["textile_gap_t"], p["gap_t_per_candidate_site"], p["gap_rank"]) == (
        25.2,
        18.9,
        18.9,
        1,
    )
    assert (await operator.get(f"{M}/parishes/999999")).status_code == 404


# --- locais -----------------------------------------------------------------------------------------------------


async def test_sites_pagination_with_cursor(operator: httpx.AsyncClient) -> None:
    first = (await operator.get(f"{M}/sites", params={"limit": 4})).json()
    assert first["total"] == 6 and ids(first["items"]) == ["S0000001a", "S0000002b", "S0000003c", "S0000004d"]
    assert first["next_cursor"] is not None
    second = (await operator.get(f"{M}/sites", params={"limit": 4, "cursor": first["next_cursor"]})).json()
    assert ids(second["items"]) == ["S0000005e", "S0000006f"] and second["next_cursor"] is None
    exact = (await operator.get(f"{M}/sites", params={"limit": 6})).json()
    assert exact["next_cursor"] is None  # 6 de 6: não há página vazia a seguir
    bad = await operator.get(f"{M}/sites", params={"cursor": "%%%"})
    assert bad.status_code == 400 and bad.json()["code"] == "bad_request"


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"kind": "underground"}, ["S0000001a"]),
        ({"kind": ["surface", "underground"]}, ["S0000001a", "S0000002b", "S0000003c"]),
        ({"stream": "verdes"}, ["S0000006f"]),
        ({"stream": "organico"}, ["S0000001a", "S0000004d", "S0000005e"]),
        ({"parish": "030804"}, ["S0000003c", "S0000004d", "S0000005e"]),
        ({"producer_type": "hospitality"}, ["S0000005e"]),
        ({"site_class": "producer"}, ["S0000004d", "S0000005e"]),
        ({"textile_candidate": True}, ["S0000001a", "S0000002b", "S0000003c"]),
        ({"textile_candidate": False}, ["S0000004d", "S0000005e", "S0000006f"]),
        ({"coord_suspect": True}, ["S0000003c"]),
        ({"coord_precision": "precise"}, ["S0000001a", "S0000006f"]),
        ({"bbox": "-8.30,41.45,-8.29,41.46"}, ["S0000003c", "S0000004d", "S0000005e"]),
        ({"bbox": "-8.30,41.45,-8.29,41.46", "kind": "surface"}, ["S0000003c"]),
        ({"q": "tres"}, ["S0000003c"]),  # "Rua Três" sem acento
        ({"q": "cemiterio lordelo"}, ["S0000006f"]),  # dois termos, ambos têm de existir
        ({"q": "S0000006"}, ["S0000006f"]),
        ({"q": "lordelo", "kind": "surface"}, []),
    ],
)
async def test_sites_filters(operator: httpx.AsyncClient, params: dict[str, Any], expected: list[str]) -> None:
    body = (await operator.get(f"{M}/sites", params=params)).json()
    assert ids(body["items"]) == expected and body["total"] == len(expected)


async def test_sites_invalid_bbox_is_400(operator: httpx.AsyncClient) -> None:
    for bbox in ("1,2,3", "a,b,c,d", "-8.3,41.5,-8.4,41.4", "-8,100,-7,101"):
        resp = await operator.get(f"{M}/sites", params={"bbox": bbox})
        assert resp.status_code == 400 and resp.json()["code"] == "bad_request", bbox


async def test_site_payload_matches_the_fixture(operator: httpx.AsyncClient) -> None:
    s = next(i for i in (await operator.get(f"{M}/sites")).json()["items"] if i["site_id"] == "S0000001a")
    assert (s["latitude"], s["longitude"], s["parish_name"], s["site_class"]) == (41.46, -8.27, "Aldão", "public")
    assert (s["containers"], s["capacity_litres_total"]) == (2, 6100)
    assert s["by_kind"]["underground"] == 1 and s["by_kind"]["organic_collective"] == 1
    assert s["by_stream"] == {"organico": 1, "verdes": 0, "desconhecido": 1}
    assert s["kinds"] == ["organic_collective", "underground"] and s["source_files"] == [
        "organico_coletivo",
        "profundidade",
    ]
    assert (s["textile_candidate"], s["organic_collective_within_15m"], s["nn_distance_m"]) == (True, 1, 139.0)
    assert s["streets"] == ["Rua Um"] and s["producer_names"] is None


# --- nomes de produtores ----------------------------------------------------------------------------------------


async def test_non_admin_cannot_ask_for_names(operator: httpx.AsyncClient) -> None:
    for path in ("/sites", "/containers", "/producers", "/textile-candidates", "/sites/S0000004d", "/export"):
        resp = await operator.get(M + path, params={"show_names": True})
        assert resp.status_code == 403 and resp.json()["code"] == "forbidden", path


async def test_no_endpoint_leaks_names_to_a_non_admin(operator: httpx.AsyncClient) -> None:
    paths = ["/overview", "/parishes", "/parishes/030804", "/sites", "/sites/geojson", "/sites/S0000004d", "/sites/S0000005e",
             "/containers", "/producers", "/textile-candidates", "/gap-ranking", "/density-benchmark", "/parishes/caop.geojson",
             "/export?format=csv", "/export?format=csv&scope=containers", "/export?format=geojson&scope=containers",
             "/export?format=geojson", "/export?format=xlsx"]  # fmt: skip
    for path in paths:
        resp = await operator.get(M + path)
        assert resp.status_code == 200, path
        text = resp.text if "xlsx" not in path else resp.content.decode("latin-1")
        assert "Restaurante Teste" not in text and "Hotel Teste" not in text, path
    # nem por pesquisa (um filtro seria um oráculo dos nomes)
    for q in ("restaurante", "hotel teste", "teste"):  # "hotel" sozinho casa com o tipo "Hotelaria", que é público
        assert (await operator.get(f"{M}/sites", params={"q": q})).json()["total"] == 0
        assert (await operator.get(f"{M}/containers", params={"q": q})).json()["total"] == 0
    assert (await operator.get(f"{M}/sites/S0000004d")).json()["containers"][0]["producer_name"] is None


async def test_admin_sees_names_only_when_asking(admin: httpx.AsyncClient) -> None:
    default = (await admin.get(f"{M}/sites", params={"site_class": "producer"})).json()
    assert default["names_visible"] is False and all(s["producer_names"] is None for s in default["items"])
    shown = (await admin.get(f"{M}/sites", params={"site_class": "producer", "show_names": True})).json()
    assert shown["names_visible"] is True
    assert {s["site_id"]: s["producer_names"] for s in shown["items"]} == {
        "S0000004d": ["Restaurante Teste Um"], "S0000005e": ["Hotel Teste"],
    }  # fmt: skip
    found = (await admin.get(f"{M}/sites", params={"q": "hotel teste", "show_names": True})).json()
    assert ids(found["items"]) == ["S0000005e"]  # o admin pode pesquisar pelos nomes se os pedir
    assert (await admin.get(f"{M}/sites", params={"q": "hotel teste"})).json()["total"] == 0  # sem show_names, não
    detail = (await admin.get(f"{M}/sites/S0000005e", params={"show_names": True})).json()
    assert [c["producer_name"] for c in detail["containers"]] == ["Hotel Teste", "Hotel Teste"]
    csv = await admin.get(f"{M}/export", params={"show_names": True})
    assert "producer_names" in csv.text.splitlines()[0] and "Restaurante Teste Um" in csv.text


# --- contentores ------------------------------------------------------------------------------------------------


async def test_containers_table_filters_and_cursor(operator: httpx.AsyncClient) -> None:
    body = (await operator.get(f"{M}/containers", params={"limit": 5})).json()
    assert body["total"] == 11 and len(body["items"]) == 5 and body["next_cursor"]
    assert ids(body["items"], "container_uid") == sorted(ids(body["items"], "container_uid"))
    seen = ids(body["items"], "container_uid")
    page = body
    while page["next_cursor"]:
        page = (await operator.get(f"{M}/containers", params={"limit": 5, "cursor": page["next_cursor"]})).json()
        seen += ids(page["items"], "container_uid")
    assert len(seen) == 11 and len(set(seen)) == 11  # sem repetidos nem omissões

    async def uids(**params: Any) -> list[str]:
        return ids((await operator.get(f"{M}/containers", params=params)).json()["items"], "container_uid")

    assert await uids(located=False) == ["superficie:C900"]
    assert len(await uids(located=True)) == 10
    assert await uids(brand="bluebee") == ["profundidade:1"]
    assert await uids(parish_match="diferente") == ["superficie:C004"]
    assert await uids(coord_suspect=True) == ["superficie:C004"]
    assert await uids(kind="surface", parish="030804") == ["superficie:C002", "superficie:C003", "superficie:C004"]
    assert len(await uids(textile_candidate=True)) == 6  # S1 (2) + S2 (1) + S3 (3)
    assert await uids(site_class="producer", kind="organic_producer", producer_type="restaurant") == [
        "organico_tipologia:B1"
    ]
    assert await uids(q="pendente") == ["superficie:C900"]
    assert await uids(bbox="-8.28,41.45,-8.26,41.47") == ["organico_coletivo:BC1", "profundidade:1", "superficie:C001"]
    row = next(
        c
        for c in body["items"] + (await operator.get(f"{M}/containers")).json()["items"]
        if c["container_uid"] == "profundidade:1"
    )
    assert (row["source_file"], row["source_line"], row["capacity_litres"], row["brand"]) == (
        "profundidade",
        2,
        5000,
        "bluebee",
    )


async def test_pending_container_keeps_its_nulls(operator: httpx.AsyncClient) -> None:
    c = (await operator.get(f"{M}/containers", params={"located": False})).json()["items"][0]
    assert (c["latitude"], c["longitude"], c["site_id"], c["capacity_litres"]) == (None, None, None, None)
    assert (c["coord_status"], c["capacity_status"], c["parish_match"]) == ("pending", "unknown", "sem_coord")


# --- detalhe do local -------------------------------------------------------------------------------------------


async def test_site_detail_with_containers_neighbours_and_links(operator: httpx.AsyncClient) -> None:
    d = (await operator.get(f"{M}/sites/S0000003c")).json()
    assert d["site"]["containers"] == 3 and len(d["containers"]) == 3 and d["radius_m"] == 200
    assert d["parish"]["name"] == "Azurém"
    # S4 está a 0,001° de latitude e de longitude: haversine a 41,456°N = 138,96 m; S5 está a 277,91 m (fora dos 200)
    assert [(n["site_id"], n["distance_m"]) for n in d["neighbours"]] == [("S0000004d", 139.0)]
    wide = (await operator.get(f"{M}/sites/S0000003c", params={"radius_m": 300})).json()
    assert [(n["site_id"], n["distance_m"]) for n in wide["neighbours"]] == [("S0000004d", 139.0), ("S0000005e", 277.9)]
    far = (await operator.get(f"{M}/sites/S0000003c", params={"radius_m": 10})).json()
    assert far["neighbours"] == []
    s1 = (await operator.get(f"{M}/sites/S0000001a")).json()
    assert [(n["site_id"], n["distance_m"]) for n in s1["neighbours"]] == [("S0000002b", 139.0)]
    assert s1["neighbours"][0]["textile_candidate"] is True
    assert [(x["organic_uid"], x["nearest_street_uid"], x["within_link_radius"]) for x in s1["links"]] == [
        ("organico_coletivo:BC1", "profundidade:1", True)
    ]
    assert (await operator.get(f"{M}/sites/S9999999z")).status_code == 404
    assert (await operator.get(f"{M}/sites/S0000001a", params={"radius_m": 5})).status_code == 422


# --- GeoJSON ----------------------------------------------------------------------------------------------------


async def test_sites_geojson_unclustered(operator: httpx.AsyncClient) -> None:
    resp = await operator.get(f"{M}/sites/geojson")
    assert resp.headers["content-type"].startswith("application/geo+json")
    assert resp.headers["content-encoding"] == "gzip" and "Accept-Encoding" in resp.headers["vary"]
    body = resp.json()
    assert body["type"] == "FeatureCollection" and body["clustered"] is False and body["total_sites"] == 6
    f = next(x for x in body["features"] if x["id"] == "S0000001a")
    assert f["geometry"] == {"type": "Point", "coordinates": [-8.27, 41.46]}  # [lon, lat]
    assert f["properties"]["kind"] == "underground" and f["properties"]["containers"] == 2
    assert f["properties"]["cluster"] is False and f["properties"]["textile_candidate"] is True
    again = await operator.get(f"{M}/sites/geojson", headers={"If-None-Match": resp.headers["etag"]})
    assert again.status_code == 304


async def test_sites_geojson_clusters_by_zoom(operator: httpx.AsyncClient) -> None:
    body = (await operator.get(f"{M}/sites/geojson", params={"zoom": 10})).json()
    # zoom 10: células de 0,0879° — S1..S5 caem todas na mesma; S6 (Lordelo) fica sozinho
    assert body["clustered"] is True and body["zoom"] == 10 and body["total_sites"] == 6 and len(body["features"]) == 2
    cluster = next(f for f in body["features"] if f["properties"]["cluster"])
    assert cluster["properties"]["point_count"] == 5 and cluster["properties"]["containers"] == 9  # 2+1+3+1+2
    lon, lat = cluster["geometry"]["coordinates"]
    assert (lat, lon) == (41.458, -8.286889)  # médias ponderadas pelos contentores: 373,122/9 e -74,582/9
    alone = next(f for f in body["features"] if not f["properties"]["cluster"])
    assert alone["properties"]["site_id"] == "S0000006f" and alone["properties"]["kind"] == "green_waste"
    # sem agrupar, ou com zoom de rua, vêm os 6 locais
    assert (
        len((await operator.get(f"{M}/sites/geojson", params={"zoom": 10, "cluster": False})).json()["features"]) == 6
    )
    assert len((await operator.get(f"{M}/sites/geojson", params={"zoom": 16})).json()["features"]) == 6
    inside = (await operator.get(f"{M}/sites/geojson", params={"bbox": "-8.28,41.45,-8.26,41.47"})).json()
    assert inside["total_sites"] == 2 and sorted(f["id"] for f in inside["features"]) == ["S0000001a", "S0000002b"]
    assert (await operator.get(f"{M}/sites/geojson", params={"zoom": 30})).status_code == 422


async def test_caop_geojson_with_metrics_and_cache(operator: httpx.AsyncClient) -> None:
    resp = await operator.get(f"{M}/parishes/caop.geojson")
    assert resp.headers["cache-control"] == "private, max-age=3600" and resp.headers["content-type"].startswith(
        "application/geo+json"
    )
    body = resp.json()
    assert [f["id"] for f in body["features"]] == ["030801", "030804", "030828"]
    az = body["features"][1]
    assert az["geometry"]["type"] == "Polygon" and az["properties"]["containers"] == 6
    assert (az["properties"]["containers_per_1000_hab"], az["properties"]["gap_rank"], az["properties"]["lat"]) == (
        2.0,
        1,
        41.455,
    )
    assert (
        await operator.get(f"{M}/parishes/caop.geojson", headers={"If-None-Match": resp.headers["etag"]})
    ).status_code == 304


# --- produtores -------------------------------------------------------------------------------------------------


async def test_producers_by_type_and_sites(operator: httpx.AsyncClient) -> None:
    body = (await operator.get(f"{M}/producers")).json()
    assert body["names_visible"] is False and body["total"] == 2 and ids(body["items"]) == ["S0000004d", "S0000005e"]
    by = {t["type"]: t for t in body["by_type"]}
    assert (by["hospitality"]["containers"], by["hospitality"]["sites"], by["hospitality"]["producers_distinct"]) == (
        2,
        1,
        1,
    )
    assert by["hospitality"]["capacity_litres_total"] == 90 and by["hospitality"]["top_parishes"] == [
        {"dicofre": "030804", "name": "Azurém", "containers": 2}
    ]
    assert (by["restaurant"]["containers"], by["school"]["containers"], by["school"]["top_parishes"]) == (1, 0, [])
    assert "Primeiro alvo" in by["hospitality"]["textile_hypothesis"]
    assert all(i["producer_names"] is None for i in body["items"])
    only = (await operator.get(f"{M}/producers", params={"producer_type": "hospitality"})).json()
    assert only["total"] == 1 and ids(only["items"]) == ["S0000005e"] and len(only["by_type"]) == 6
    assert (await operator.get(f"{M}/producers", params={"parish": "030801"})).json()["total"] == 0


# --- candidatos, lacuna e densidade -----------------------------------------------------------------------------


async def test_textile_candidates_ranked_with_reasons(operator: httpx.AsyncClient) -> None:
    body = (await operator.get(f"{M}/textile-candidates")).json()
    assert body["is_estimate"] is True and body["total"] == 3 and body["total_precise"] == 1
    assert "coordenada precisa antes de aproximada" in body["rank_rule"] and "não de recomendados" in body["rank_rule"]
    # S1 é o único preciso; depois S3 (Azurém: 18,9 t por candidato) antes de S2 (Aldão: 3,15)
    assert [(c["rank"], c["site"]["site_id"]) for c in body["items"]] == [
        (1, "S0000001a"),
        (2, "S0000003c"),
        (3, "S0000002b"),
    ]
    assert [c["reasons"] for c in body["items"]] == [
        ["underground", "organic_collective_nearby"], ["three_or_more_containers", "approximate_coordinates"], ["approximate_coordinates"],
    ]  # fmt: skip
    assert body["items"][0]["reason_text"].startswith("ponto de recolha na rua; contentor de profundidade")
    assert (body["items"][1]["parish_gap_t_per_candidate"], body["items"][1]["parish_gap_rank"]) == (18.9, 1)


async def test_textile_candidates_filters_keep_the_global_rank(operator: httpx.AsyncClient) -> None:
    precise = (await operator.get(f"{M}/textile-candidates", params={"precise_only": True})).json()
    assert [c["site"]["site_id"] for c in precise["items"]] == ["S0000001a"] and precise["total"] == 1
    azurem = (await operator.get(f"{M}/textile-candidates", params={"parish": "030804"})).json()
    assert [(c["rank"], c["site"]["site_id"]) for c in azurem["items"]] == [(2, "S0000003c")]
    first = (await operator.get(f"{M}/textile-candidates", params={"limit": 2})).json()
    assert len(first["items"]) == 2 and first["next_cursor"]
    rest = (await operator.get(f"{M}/textile-candidates", params={"limit": 2, "cursor": first["next_cursor"]})).json()
    assert [c["rank"] for c in rest["items"]] == [3] and rest["next_cursor"] is None
    assert (await operator.get(f"{M}/textile-candidates", params={"cursor": "abc"})).status_code == 400


async def test_gap_ranking_states_the_rule_and_is_an_estimate(operator: httpx.AsyncClient) -> None:
    body = (await operator.get(f"{M}/gap-ranking")).json()
    assert body["is_estimate"] is True and "Estimativa" in body["rule"] and "captura atual" in body["rule"]
    assert body["parameters"] == {"kg_per_inhab_month": 0.525, "capture_pct": 25.0, "months_per_year": 12}
    # lacuna = hab × 0,525 × 12 / 1000: Azurém 18,9/1; Lordelo 3,276/max(1,0) = 3,28; Aldão 6,3/2 = 3,15
    assert [(r["rank"], r["name"], r["gap_t_per_candidate_site"]) for r in body["items"]] == [
        (1, "Azurém", 18.9), (2, "Lordelo", 3.28), (3, "Aldão", 3.15),
    ]  # fmt: skip
    assert [r["name"] for r in (await operator.get(f"{M}/gap-ranking", params={"limit": 1})).json()["items"]] == [
        "Azurém"
    ]


async def test_density_benchmark_hand_checked(operator: httpx.AsyncClient) -> None:
    body = (await operator.get(f"{M}/density-benchmark")).json()
    stats = {s["key"]: s for s in body["stats"]}
    c1000 = stats["containers_per_1000_hab"]
    assert c1000["concelho"] == 2.21  # 10 · 1000 / 4520
    # valores por freguesia: 3,0 (Aldão), 2,0 (Azurém), 1,92 (Lordelo): p25 = 1,92 + 0,5 · 0,08 = 1,96; p75 = 2,0 + 0,5 · 1,0
    assert c1000["distribution"] == {"minimum": 1.92, "p25": 1.96, "median": 2.0, "p75": 2.5, "maximum": 3.0}
    assert stats["containers_per_km2"]["concelho"] == 1.43  # 10 / 7
    assert stats["cover_pct_300m"]["concelho"] == 41.43  # (60·2 + 40·4 + 10·1) / 7, ponderada pela área
    assert body["population"] == 4520 and body["people_per_public_site"] == 1130.0  # 4520 / 4
    assert [(p["name"], p["below_p25"]) for p in body["parishes"]] == [
        ("Lordelo", True),
        ("Azurém", False),
        ("Aldão", False),
    ]
    ref = body["textile_reference"]
    # 4520 / 1414 = 3,2 -> 3 pontos de referência; 3 candidatos -> 1,0 por ponto
    assert (ref["people_per_point"], ref["verified"], ref["reference_points"], ref["candidate_sites"]) == (
        1414,
        False,
        3,
        3,
    )
    assert ref["candidates_per_reference_point"] == 1.0 and ref["is_estimate"] is True


# --- exportação -------------------------------------------------------------------------------------------------


async def test_export_csv_sites(operator: httpx.AsyncClient) -> None:
    resp = await operator.get(f"{M}/export", params={"kind": "surface"})
    assert resp.status_code == 200 and resp.headers["content-type"].startswith("text/csv")
    assert (
        resp.headers["content-disposition"].endswith('-ffffffffffff-1792497600.csv"')
        and "sites" in resp.headers["content-disposition"]
    )
    assert resp.content.startswith("﻿".encode())
    lines = resp.text.lstrip("﻿").splitlines()
    assert lines[0].startswith("site_id,latitude,longitude") and "producer_names" not in lines[0]
    assert [ln.split(",")[0] for ln in lines[1:]] == ["S0000002b", "S0000003c"]


async def test_export_xlsx_and_geojson(operator: httpx.AsyncClient) -> None:
    xlsx = await operator.get(f"{M}/export", params={"format": "xlsx", "scope": "containers"})
    sheet = load_workbook(io.BytesIO(xlsx.content)).active
    rows = list(sheet.iter_rows(values_only=True))
    assert rows[0][0] == "container_uid" and len(rows) == 12  # cabeçalho + 11 contentores (com o pendente)
    assert "producer_name" not in rows[0]
    geo = (await operator.get(f"{M}/export", params={"format": "geojson"})).json()
    assert len(geo["features"]) == 6 and geo["features"][0]["geometry"]["coordinates"] == [-8.27, 41.46]
    containers = (await operator.get(f"{M}/export", params={"format": "geojson", "scope": "containers"})).json()
    assert len(containers["features"]) == 10  # o pendente não tem geometria
    csv = await operator.get(f"{M}/export", params={"scope": "containers"})
    assert len(csv.text.splitlines()) == 12  # cabeçalho + 11 contentores
    empty = await operator.get(f"{M}/export", params={"kind": "platform"})
    assert empty.status_code == 200 and empty.content == "﻿".encode()
    assert (await operator.get(f"{M}/export", params={"format": "pdf"})).status_code == 422
