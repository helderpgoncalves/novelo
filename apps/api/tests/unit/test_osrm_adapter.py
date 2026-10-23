"""Adaptador do OSRM: /table (blocos, pontos sem estrada), /route (troços cosidos), erros, cache e disjuntor."""

import json
import re
from collections.abc import Callable
from itertools import pairwise

import httpx
import pytest

from novelo.adapters.osrm import PROBE, OsrmClient, OsrmError, ResilientRouter, get_road_router
from novelo.core.config import Settings
from novelo.domain.routing import LatLon, RoadMatrix

A: LatLon = (41.4425, -8.2918)
B: LatLon = (41.4525, -8.2918)
C: LatLon = (41.4425, -8.2718)


def parse(path: str) -> list[LatLon]:
    coords = path.split("/driving/")[1].split(";")
    return [(float(c.split(",")[1]), float(c.split(",")[0])) for c in coords]


def metres(a: LatLon, b: LatLon) -> float:
    """ "Estrada" do servidor falso: distância de Manhattan em graus × 100 km, para os valores serem previsíveis."""
    return round((abs(a[0] - b[0]) + abs(a[1] - b[1])) * 100_000, 1)


class FakeOsrm:
    """Responde como o OSRM 5.27: /table (com sources/destinations), /route e erros; regista os pedidos."""

    def __init__(self, *, snap: dict[LatLon, float] | None = None, max_table: int = 10_000) -> None:
        self.snap, self.max_table = snap or {}, max_table
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        points = parse(path)
        q = request.url.params
        if "/table/" in path:
            if len(points) > self.max_table:
                return httpx.Response(400, json={"code": "TooBig", "message": "Too many table coordinates"})
            idx = list(range(len(points)))
            src = [int(i) for i in q["sources"].split(";")] if "sources" in q else idx
            dst = [int(i) for i in q["destinations"].split(";")] if "destinations" in q else idx
            d = [[metres(points[i], points[j]) for j in dst] for i in src]
            t = [[x / 10 for x in row] for row in d]

            def wp(ids: list[int]) -> list[dict[str, object]]:
                return [{"distance": self.snap.get(points[i], 3.0), "location": [0, 0]} for i in ids]

            return httpx.Response(
                200, json={"code": "Ok", "distances": d, "durations": t, "sources": wp(src), "destinations": wp(dst)}
            )
        if "/route/" in path:
            if q.get("overview") == "false":
                return httpx.Response(200, json={"code": "Ok", "routes": [{"distance": 4678.9, "duration": 503.6}]})
            # geometria: cada troço vira dois segmentos (passa por um canto), com [lon, lat]
            line: list[list[float]] = []
            for a, b in pairwise(points):
                line += [[a[1], a[0]], [b[1], a[0]]]
            line.append([points[-1][1], points[-1][0]])
            return httpx.Response(200, json={"code": "Ok", "routes": [{"geometry": {"coordinates": line}}]})
        return httpx.Response(404, json={"code": "InvalidUrl"})


def client(fake: Callable[[httpx.Request], httpx.Response], **kw: object) -> OsrmClient:
    return OsrmClient("http://osrm:5000", transport=httpx.MockTransport(fake), **kw)  # type: ignore[arg-type]


# --- /table --------------------------------------------------------------------------------------------------------


def test_table_returns_integer_metres_and_seconds_for_every_pair() -> None:
    fake = FakeOsrm()
    m = client(fake).table([A, B, C])
    assert m.distance_m[0][1] == round(metres(A, B)) == 1000 and m.distance_m[0][2] == 2000
    assert m.duration_s[0][1] == 100 and m.distance_m[1][1] == 0
    assert all(isinstance(x, int) for row in m.distance_m for x in row)
    (req,) = fake.requests
    assert req.url.params["annotations"] == "distance,duration" and "sources" not in req.url.params
    assert "-8.291800,41.442500;-8.291800,41.452500" in str(req.url.path)  # lon,lat com 6 casas


def test_table_marks_a_point_far_from_any_road_as_unreachable() -> None:
    m = client(FakeOsrm(snap={B: 900.0}), max_snap_m=500.0).table([A, B, C])
    assert m.distance_m[0][1] is None and m.distance_m[1][0] is None and m.duration_s[1][2] is None
    assert m.distance_m[0][2] == 2000 and m.distance_m[2][0] == 2000  # o resto da matriz fica
    assert m.distance_m[1][1] is None  # um ponto sem estrada também não tem a diagonal: o domínio põe 0


def test_table_keeps_null_pairs_from_the_server() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "code": "Ok",
                "distances": [[0, None], [1200.4, 0]],
                "durations": [[0, None], [90.6, 0]],
                "sources": [{"distance": 1.0}, {"distance": 2.0}],
            },
        )

    m = client(handler).table([A, B])
    assert m.distance_m == [[0, None], [1200, 0]] and m.duration_s == [[0, None], [91, 0]]


def test_a_large_table_is_split_in_blocks_and_reassembled_exactly() -> None:
    points = [(41.40 + i * 0.001, -8.30 + (i % 7) * 0.002) for i in range(23)]
    fake = FakeOsrm(max_table=10)
    m = client(fake, max_locations=10).table(points)  # blocos de 5 x 5
    assert len(fake.requests) > 1 and all(len(parse(r.url.path)) <= 10 for r in fake.requests)
    for i, a in enumerate(points):
        for j, b in enumerate(points):
            assert m.distance_m[i][j] == round(metres(a, b)), (i, j)
    whole = client(FakeOsrm(), max_locations=100).table(points)
    assert whole == m  # igual a pedir tudo de uma vez


def test_table_of_nothing_and_of_one_point() -> None:
    assert client(FakeOsrm()).table([]) == RoadMatrix([], [])
    assert client(FakeOsrm()).table([A]).distance_m == [[0]]


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, json={"code": "NoTable", "message": "no"}),
        httpx.Response(400, json={"code": "InvalidQuery", "message": "bad"}),
        httpx.Response(500, text="boom"),
        httpx.Response(200, json=[1, 2]),
        httpx.Response(200, json={"code": "Ok", "distances": "x", "durations": [], "sources": []}),
        httpx.Response(200, json={"code": "Ok", "distances": [[0]], "durations": [[0]], "sources": []}),
    ],
)
def test_bad_responses_raise_osrm_error(response: httpx.Response) -> None:
    with pytest.raises(OsrmError):
        client(lambda r: response).table([A])


def test_network_errors_raise_osrm_error() -> None:
    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("timeout", request=request)

    with pytest.raises(OsrmError, match="timeout"):
        client(boom).table([A, B])


# --- /route --------------------------------------------------------------------------------------------------------


def test_route_returns_lat_lon_pairs_along_the_road() -> None:
    fake = FakeOsrm()
    path = client(fake).route([A, B])
    assert path[0] == A and path[-1] == B and len(path) == 3
    assert fake.requests[0].url.params["overview"] == "full" and fake.requests[0].url.params["geometries"] == "geojson"
    assert fake.requests[0].url.params["continue_straight"] == "false"  # a matriz não proíbe inversões nas paragens


def test_a_long_route_is_stitched_without_repeating_the_junction_points() -> None:
    points = [(41.40 + i * 0.001, -8.30) for i in range(250)]
    fake = FakeOsrm()
    path = client(fake).route(points)
    assert [len(parse(r.url.path)) for r in fake.requests] == [100, 100, 52]
    assert path[0] == points[0] and path[-1] == points[-1]
    for p in points:  # passa por todas as paragens, uma vez cada
        assert path.count((pytest.approx(p[0]), pytest.approx(p[1]))) >= 1  # type: ignore[arg-type]


def test_route_of_less_than_two_points_needs_no_request() -> None:
    fake = FakeOsrm()
    assert client(fake).route([A]) == [A] and client(fake).route([]) == [] and not fake.requests


@pytest.mark.parametrize(
    "body",
    [
        {"code": "Ok", "routes": []},
        {"code": "Ok", "routes": [{"geometry": {"coordinates": [[1, 2]]}}]},
        {"code": "Ok", "routes": [{"geometry": {"coordinates": [["a", "b"], ["c", "d"]]}}]},
        {"code": "NoRoute", "message": "x"},
    ],
)
def test_bad_route_bodies_raise_osrm_error(body: dict[str, object]) -> None:
    with pytest.raises(OsrmError):
        client(lambda r: httpx.Response(200, json=body)).route([A, B])


def test_probe_identifies_the_dataset_by_a_fixed_route() -> None:
    fake = FakeOsrm()
    assert client(fake).probe() == "4679-504"
    assert parse(fake.requests[0].url.path) == list(PROBE)


# --- ResilientRouter -----------------------------------------------------------------------------------------------


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def router(fake: FakeOsrm, clock: Clock | None = None, **kw: object) -> ResilientRouter:
    return ResilientRouter(client(fake), cooldown_s=30.0, clock=clock or Clock(), **kw)  # type: ignore[arg-type]


def test_the_same_points_are_answered_from_the_cache() -> None:
    fake = FakeOsrm()
    r = router(fake)
    first, second = r.matrix([A, B, C]), r.matrix([A, B, C])
    assert first is second and len(fake.requests) == 1
    r.geometry([A, B]), r.geometry([A, B])
    assert len(fake.requests) == 2  # a rota é outra chave
    r.matrix([A, B])
    assert len(fake.requests) == 3  # outros pontos, outro pedido


def test_the_cache_is_bounded_and_evicts_the_oldest() -> None:
    fake = FakeOsrm()
    r = router(fake, cache_size=2)
    r.matrix([A, B]), r.matrix([A, C]), r.matrix([B, C])
    n = len(fake.requests)
    r.matrix([A, C])  # ainda está
    assert len(fake.requests) == n
    r.matrix([A, B])  # a mais antiga saiu
    assert len(fake.requests) == n + 1


def test_a_failure_returns_none_and_pauses_the_router_until_the_cooldown_ends() -> None:
    clock, up = Clock(), {"ok": False}
    fake = FakeOsrm()

    def flaky(request: httpx.Request) -> httpx.Response:
        return fake(request) if up["ok"] else httpx.Response(503, text="down")

    r = ResilientRouter(client(flaky), cooldown_s=30.0, clock=clock)
    assert r.available and r.matrix([A, B]) is None
    assert not r.available and r.fingerprint == "estimate"
    up["ok"] = True
    assert r.matrix([A, B]) is None and r.geometry([A, B]) is None  # em pausa: nem tenta
    assert not fake.requests
    clock.now += 31
    assert r.available and r.matrix([A, B]) is not None  # voltou
    assert r.fingerprint == "osrm:4679-504"


def test_a_cached_answer_is_still_served_while_paused() -> None:
    clock, fake = Clock(), FakeOsrm()
    r = router(fake, clock)
    assert r.matrix([A, B]) is not None
    r._fail("teste", OsrmError("x"))
    assert not r.available and r.matrix([A, B]) is not None  # já estava em cache


def test_the_fingerprint_is_stable_and_fetched_once() -> None:
    fake = FakeOsrm()
    r = router(fake)
    assert r.fingerprint == r.fingerprint == "osrm:4679-504" and len(fake.requests) == 1


def test_a_failing_probe_means_estimate() -> None:
    r = ResilientRouter(client(lambda req: httpx.Response(500, text="x")), clock=Clock())
    assert r.fingerprint == "estimate" and not r.available


def test_the_router_is_safe_under_concurrent_use() -> None:
    from concurrent.futures import ThreadPoolExecutor  # noqa: PLC0415

    fake = FakeOsrm()
    r = router(fake)
    with ThreadPoolExecutor(8) as pool:
        results = list(pool.map(lambda i: r.matrix([A, B, C]), range(40)))
    assert all(m is not None and m.distance_m[0][1] == 1000 for m in results)


# --- Configuração --------------------------------------------------------------------------------------------------


def test_without_osrm_url_there_is_no_router(monkeypatch: pytest.MonkeyPatch) -> None:
    get_road_router.cache_clear()
    monkeypatch.setattr("novelo.adapters.osrm.get_settings", lambda: Settings(OSRM_URL=""))  # type: ignore[call-arg]
    assert get_road_router() is None
    get_road_router.cache_clear()
    monkeypatch.setattr("novelo.adapters.osrm.get_settings", lambda: Settings(OSRM_URL="http://osrm:5000"))
    assert isinstance(get_road_router(), ResilientRouter)
    get_road_router.cache_clear()


def test_request_urls_carry_only_coordinates() -> None:
    fake = FakeOsrm()
    client(fake).table([A, B])
    assert re.fullmatch(r"/table/v1/driving/(-?\d+\.\d{6},-?\d+\.\d{6};?)+", fake.requests[0].url.path)
    assert json.loads(json.dumps(dict(fake.requests[0].url.params))) == {"annotations": "distance,duration"}
