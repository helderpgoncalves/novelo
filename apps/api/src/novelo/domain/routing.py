"""Distâncias por estrada: tipos da porta `RoadRouter` e funções puras (sem I/O).

O domínio nunca fala com o OSRM: recebe um `RoadRouter` injetado (`network.Params.road`) e trata o que ele devolve.
Um par sem caminho (ponto fora da rede, ilha) cai na estimativa haversine × desvio e fica marcado como não exato,
por isso uma rota só se diz "por estrada" quando TODOS os seus troços o são. Sem router, tudo é estimativa.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from itertools import pairwise
from typing import Literal, Protocol

from novelo.domain.geo import haversine_km

LatLon = tuple[float, float]
RoutingSource = Literal["road", "estimate"]
PlanSource = Literal["road", "mixed", "estimate"]  # um conjunto de rotas: todas, algumas ou nenhuma por estrada


@dataclass(frozen=True)
class RoadMatrix:
    """Matriz de um router: distâncias em metros e durações em segundos entre todos os pares (`None` = sem caminho)."""

    distance_m: list[list[int | None]]
    duration_s: list[list[int | None]]


class RoadRouter(Protocol):
    """Porta para um motor de rotas por estrada (OSRM). A implementação trata de erros, cache e disponibilidade."""

    @property
    def fingerprint(self) -> str:
        """Identifica os dados em uso (chave de cache dos cenários); `estimate` enquanto o motor não responde."""
        ...

    def matrix(self, points: Sequence[LatLon]) -> RoadMatrix | None:
        """Distâncias e durações entre todos os pares de pontos; `None` se o motor não está disponível."""
        ...

    def geometry(self, points: Sequence[LatLon]) -> list[LatLon] | None:
        """Traçado pela estrada passando pelos pontos por ordem; `None` se o motor não está disponível."""
        ...


@dataclass(frozen=True)
class ResolvedMatrix:
    """Matriz completa para o VRP: a estrada onde há caminho e a estimativa onde não; `exact` marca a estrada."""

    distance_m: list[list[int]]
    duration_s: list[list[int]]
    exact: list[list[bool]]

    def arcs_exact(self, order: Sequence[int]) -> bool:
        """Todos os troços do percurso (índices dos nós, por ordem) vêm da estrada?"""
        return all(self.exact[a][b] for a, b in pairwise(order))

    def length_m(self, order: Sequence[int]) -> int:
        return sum(self.distance_m[a][b] for a, b in pairwise(order))

    def duration_of_s(self, order: Sequence[int]) -> int:
        return sum(self.duration_s[a][b] for a, b in pairwise(order))


def estimate_leg(a: LatLon, b: LatLon, detour_factor: float, speed_kmh: float) -> tuple[int, int]:
    """(metros, segundos) de um troço em linha reta × desvio, à velocidade da viatura."""
    km = haversine_km(a[0], a[1], b[0], b[1]) * detour_factor
    return round(km * 1000), round(km / speed_kmh * 3600) if speed_kmh > 0 else 0


def resolve(
    points: Sequence[LatLon], road: RoadMatrix | None, detour_factor: float, speed_kmh: float
) -> ResolvedMatrix:
    """Completa a matriz da estrada com a estimativa nos pares sem caminho (ou todos, se não há matriz).

    A diagonal é sempre 0 e exata. Uma matriz de tamanho errado é um bug do router: levanta `ValueError`.
    """
    n = len(points)
    if road is not None and (len(road.distance_m) != n or len(road.duration_s) != n):
        raise ValueError(f"A matriz do router tem {len(road.distance_m)} linhas e eram precisas {n}")
    distance: list[list[int]] = []
    duration: list[list[int]] = []
    exact: list[list[bool]] = []
    for i in range(n):
        d_row: list[int] = []
        t_row: list[int] = []
        e_row: list[bool] = []
        for j in range(n):
            d = road.distance_m[i][j] if road is not None else None
            t = road.duration_s[i][j] if road is not None else None
            if i == j:
                d_row.append(0)
                t_row.append(0)
                e_row.append(True)
            elif d is not None and t is not None:
                d_row.append(d)
                t_row.append(t)
                e_row.append(True)
            else:
                est_d, est_t = estimate_leg(points[i], points[j], detour_factor, speed_kmh)
                d_row.append(est_d)
                t_row.append(est_t)
                e_row.append(False)
        distance.append(d_row)
        duration.append(t_row)
        exact.append(e_row)
    return ResolvedMatrix(distance, duration, exact)


def overall_source(sources: Sequence[RoutingSource]) -> PlanSource:
    """ "road" se todas as rotas o são (e há pelo menos uma), "mixed" se só algumas, senão "estimate"."""
    if not sources or not any(x == "road" for x in sources):
        return "estimate"
    return "road" if all(x == "road" for x in sources) else "mixed"
