"""OSRM (OpenStreetMap, servidor próprio): matriz de distâncias e traçado das rotas por estrada.

`OsrmClient` fala HTTP e levanta `OsrmError`. `ResilientRouter` é o que o domínio usa (`domain.routing.RoadRouter`):
nunca levanta, devolve `None` quando o OSRM não está disponível (o domínio cai na estimativa), guarda os resultados em
cache e, depois de uma falha, deixa de tentar durante `cooldown_s` para não pôr cada pedido à espera de um timeout.
Sem custos nem chaves: ver apps/osrm e docs/engenharia/rotas-reais.md.
"""

import logging
import threading
import time
from collections import OrderedDict
from collections.abc import Callable, Hashable, Sequence
from functools import lru_cache

import httpx

from novelo.core.config import get_settings
from novelo.domain.routing import LatLon, RoadMatrix

log = logging.getLogger(__name__)

# Rota-sonda (estaleiro de Polvoreira -> centro de Guimarães): a resposta muda quando os dados ou o perfil mudam,
# por isso identifica a versão do grafo sem o OSRM a anunciar (a API não traz `data_version`).
PROBE: tuple[LatLon, LatLon] = ((41.4592, -8.3187), (41.4425, -8.2918))
ROUTE_WAYPOINTS = 100  # máximo de pontos por pedido /route; percursos maiores são cosidos em troços
COORD_PLACES = 6  # ~0,1 m: chave de cache e coordenadas enviadas


class OsrmError(Exception):
    """O OSRM não respondeu a tempo, devolveu um erro ou uma resposta fora do formato."""


def _coords(points: Sequence[LatLon]) -> str:
    return ";".join(f"{lon:.{COORD_PLACES}f},{lat:.{COORD_PLACES}f}" for lat, lon in points)


class OsrmClient:
    def __init__(
        self,
        base_url: str,
        *,
        timeout_s: float = 8.0,
        max_locations: int = 400,
        max_snap_m: float = 500.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        if max_locations < 2:
            raise ValueError("max_locations tem de ser pelo menos 2")
        self._max_locations, self._max_snap_m = max_locations, max_snap_m
        self._http = httpx.Client(base_url=base_url.rstrip("/"), timeout=timeout_s, transport=transport)

    def close(self) -> None:
        self._http.close()

    def _get(self, path: str, params: dict[str, str]) -> dict[str, object]:
        what = f"{path.split('/driving/', maxsplit=1)[0]} ({path.count(';') + 1} pontos)"  # sem as coordenadas no log
        try:
            resp = self._http.get(path, params=params)
            body = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise OsrmError(f"OSRM {what}: {exc}") from exc
        if not isinstance(body, dict):
            raise OsrmError(f"OSRM {what}: resposta inesperada")
        if resp.status_code != 200 or body.get("code") != "Ok":
            raise OsrmError(f"OSRM {what}: {body.get('code', resp.status_code)} {body.get('message', '')}".strip())
        return body

    # --- /table --------------------------------------------------------------------------------------------------

    def table(self, points: Sequence[LatLon]) -> RoadMatrix:
        """Distâncias (m) e durações (s) entre todos os pares; pontos a mais de `max_snap_m` de uma estrada ficam sem
        caminho. Acima de `max_locations` pontos o pedido é dividido em blocos (fontes × destinos)."""
        n = len(points)
        if n == 0:
            return RoadMatrix([], [])
        dist: list[list[int | None]] = [[None] * n for _ in range(n)]
        dur: list[list[int | None]] = [[None] * n for _ in range(n)]
        if n <= self._max_locations:
            self._fill_block(points, list(range(n)), list(range(n)), dist, dur)
        else:
            block = self._max_locations // 2
            for i0 in range(0, n, block):
                rows = list(range(i0, min(i0 + block, n)))
                for j0 in range(0, n, block):
                    self._fill_block(points, rows, list(range(j0, min(j0 + block, n))), dist, dur)
        return RoadMatrix(dist, dur)

    def _fill_block(
        self,
        points: Sequence[LatLon],
        rows: list[int],
        cols: list[int],
        dist: list[list[int | None]],
        dur: list[list[int | None]],
    ) -> None:
        same = rows == cols
        used = rows if same else [*rows, *cols]
        params = {"annotations": "distance,duration"}
        if not same:
            params["sources"] = ";".join(str(k) for k in range(len(rows)))
            params["destinations"] = ";".join(str(len(rows) + k) for k in range(len(cols)))
        body = self._get(f"/table/v1/driving/{_coords([points[k] for k in used])}", params)
        d, t = body.get("distances"), body.get("durations")
        if not (isinstance(d, list) and isinstance(t, list) and len(d) == len(rows) and len(t) == len(rows)):
            raise OsrmError("OSRM /table: matriz fora do formato esperado")
        # Pontos longe de qualquer estrada (no mar, fora do extrato) não têm caminho de confiança.
        snap = self._snap_distances(body, same, len(rows), len(cols))
        for a, row in enumerate(rows):
            for b, col in enumerate(cols):
                d_ab, t_ab = d[a][b], t[a][b]
                if d_ab is None or t_ab is None or snap[0][a] > self._max_snap_m or snap[1][b] > self._max_snap_m:
                    continue
                dist[row][col], dur[row][col] = round(d_ab), round(t_ab)

    @staticmethod
    def _snap_distances(
        body: dict[str, object], same: bool, n_rows: int, n_cols: int
    ) -> tuple[list[float], list[float]]:
        """Distância de cada ponto à estrada onde foi encaixado: (fontes, destinos)."""

        def column(key: str, expected: int) -> list[float]:
            items = body.get(key)
            if not isinstance(items, list) or len(items) != expected:
                raise OsrmError(f"OSRM /table: '{key}' fora do formato esperado")
            return [float(w.get("distance", 0.0)) if isinstance(w, dict) else 0.0 for w in items]

        rows = column("sources", n_rows)
        return rows, rows if same else column("destinations", n_cols)

    # --- /route --------------------------------------------------------------------------------------------------

    def route(self, points: Sequence[LatLon]) -> list[LatLon]:
        """Traçado pela estrada passando por todos os pontos por ordem (troços cosidos acima de `ROUTE_WAYPOINTS`)."""
        if len(points) < 2:
            return list(points)
        path: list[LatLon] = []
        start = 0
        while start < len(points) - 1:
            chunk = points[start : start + ROUTE_WAYPOINTS]
            leg = self._route_chunk(chunk)
            path.extend(leg[1:] if path else leg)
            start += len(chunk) - 1
        return path

    def _route_chunk(self, points: Sequence[LatLon]) -> list[LatLon]:
        body = self._get(
            f"/route/v1/driving/{_coords(points)}",
            {"overview": "full", "geometries": "geojson", "steps": "false", "continue_straight": "false"},
        )
        routes = body.get("routes")
        if not isinstance(routes, list) or not routes or not isinstance(routes[0], dict):
            raise OsrmError("OSRM /route: sem rota")
        geometry = routes[0].get("geometry")
        coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            raise OsrmError("OSRM /route: geometria vazia")
        try:
            return [(float(c[1]), float(c[0])) for c in coordinates]
        except (TypeError, ValueError, IndexError) as exc:
            raise OsrmError("OSRM /route: coordenadas inválidas") from exc

    def probe(self) -> str:
        """Identificador dos dados em uso: distância e duração da rota-sonda."""
        body = self._get(
            f"/route/v1/driving/{_coords(PROBE)}", {"overview": "false", "steps": "false", "alternatives": "false"}
        )
        routes = body.get("routes")
        if not isinstance(routes, list) or not routes or not isinstance(routes[0], dict):
            raise OsrmError("OSRM /route: sem rota na sonda")
        return f"{float(routes[0].get('distance', 0)):.0f}-{float(routes[0].get('duration', 0)):.0f}"


class ResilientRouter:
    """`RoadRouter` seguro para o domínio: cache, disjuntor e `None` em vez de exceções."""

    def __init__(
        self,
        client: OsrmClient,
        *,
        cache_size: int = 256,
        cooldown_s: float = 30.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._client, self._cache_size, self._cooldown_s, self._clock = client, cache_size, cooldown_s, clock
        self._lock = threading.Lock()
        self._cache: OrderedDict[Hashable, object] = OrderedDict()
        self._down_until = 0.0
        self._data_id: str | None = None

    # --- estado --------------------------------------------------------------------------------------------------

    @property
    def available(self) -> bool:
        """Falso durante o tempo de espera que se segue a uma falha."""
        with self._lock:
            return self._clock() >= self._down_until

    @property
    def fingerprint(self) -> str:
        """Identifica os dados em uso (entra na chave da cache dos cenários); `estimate` se o OSRM não responde."""
        if not self.available:
            return "estimate"
        if self._data_id is None:
            try:
                self._data_id = f"osrm:{self._client.probe()}"
            except OsrmError as exc:
                self._fail("probe", exc)
                return "estimate"
        return self._data_id

    def _fail(self, what: str, exc: Exception) -> None:
        with self._lock:
            first = self._clock() >= self._down_until
            self._down_until = self._clock() + self._cooldown_s
        if first:  # um aviso por episódio, não um por pedido
            log.warning("OSRM indisponível (%s): rotas estimadas durante %.0f s. %s", what, self._cooldown_s, exc)

    def _cached(self, key: Hashable, compute: Callable[[], object], what: str) -> object | None:
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key]
            if self._clock() < self._down_until:
                return None
        try:
            value = compute()
        except OsrmError as exc:
            self._fail(what, exc)
            return None
        with self._lock:
            self._cache[key] = value
            while len(self._cache) > self._cache_size:
                self._cache.popitem(last=False)
        return value

    # --- RoadRouter ----------------------------------------------------------------------------------------------

    @staticmethod
    def _key(kind: str, points: Sequence[LatLon]) -> Hashable:
        return kind, tuple((round(lat, COORD_PLACES), round(lon, COORD_PLACES)) for lat, lon in points)

    def matrix(self, points: Sequence[LatLon]) -> RoadMatrix | None:
        value = self._cached(self._key("table", points), lambda: self._client.table(points), "table")
        return value if isinstance(value, RoadMatrix) else None

    def geometry(self, points: Sequence[LatLon]) -> list[LatLon] | None:
        value = self._cached(self._key("route", points), lambda: self._client.route(points), "route")
        return list(value) if isinstance(value, list) else None


@lru_cache(maxsize=1)
def get_road_router() -> ResilientRouter | None:
    """O router da aplicação; `None` com `OSRM_URL` vazio (sempre estimativa, como nos testes)."""
    s = get_settings()
    if not s.osrm_url:
        return None
    client = OsrmClient(
        s.osrm_url, timeout_s=s.osrm_timeout_s, max_locations=s.osrm_max_locations, max_snap_m=s.osrm_max_snap_m
    )
    return ResilientRouter(client, cache_size=s.osrm_cache_size, cooldown_s=s.osrm_cooldown_s)
