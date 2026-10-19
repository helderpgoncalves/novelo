"""Cobertura da rede de contentores: lê freguesias, localidades e contentores e aplica `domain/coverage.py`."""

import uuid
from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.domain import coverage as cov
from novelo.domain.vocab import ContainerKind, ContainerStatus, CoverageState
from novelo.features.network.models import Container, Locality, Parish
from novelo.features.network.schemas import CoverageSummary, ParishCoverage, ReferenceStandard

METHOD = (
    "Estimativa. A população de cada freguesia (INE) reparte-se em partes iguais pelas suas localidades "
    "geocodificadas (ou pelo centroide, se não houver nenhuma). Um ponto está coberto se o contentor ativo mais "
    "próximo estiver a radius_m ou menos em linha reta. Não considera passeios, declives nem a capacidade."
)
REFERENCE_NOTE = (
    "Referência francesa de pontos de recolha de têxteis: cerca de 1 ponto por 1 414 habitantes. "
    "Valor por verificar na fonte antes de ser usado fora da comparação."
)


async def get_coverage(db: AsyncSession, radius_m: int, kind: ContainerKind) -> CoverageSummary:
    parishes = (
        (
            await db.execute(
                select(Parish)
                .where(Parish.population.is_not(None), Parish.latitude.is_not(None), Parish.longitude.is_not(None))
                .order_by(Parish.name)
            )
        )
        .scalars()
        .all()
    )
    population = sum(p.population or 0 for p in parishes)
    reference_total = cov.reference_points(population)
    reference = ReferenceStandard(
        name="Referência francesa",
        people_per_point=cov.FRENCH_PEOPLE_PER_POINT,
        points=reference_total,
        verified=False,
        note=REFERENCE_NOTE,
    )
    total_any = (await db.execute(select(func.count()).select_from(Container))).scalar_one()
    if total_any == 0:
        return CoverageSummary(
            state=CoverageState.AWAITING_DATA,
            method=METHOD,
            radius_m=radius_m,
            kind=kind,
            population=population,
            containers=0,
            containers_total=0,
            containers_per_1000=None,
            covered_population=None,
            covered_pct=None,
            reference=reference,
            gap_points=None,
            parishes=[],
        )

    rows = (
        await db.execute(
            select(Container.latitude, Container.longitude, Container.parish_id).where(
                Container.kind == kind, Container.status == ContainerStatus.ACTIVE
            )
        )
    ).all()
    points = [(float(lat), float(lon)) for lat, lon, _ in rows]
    per_parish: Counter[uuid.UUID] = Counter(pid for _, _, pid in rows if pid is not None)

    localities = (
        await db.execute(
            select(Locality.parish_id, Locality.latitude, Locality.longitude).where(
                Locality.parish_id.is_not(None), Locality.latitude.is_not(None), Locality.longitude.is_not(None)
            )
        )
    ).all()
    locs_by_parish: dict[uuid.UUID, list[tuple[float, float]]] = {}
    for pid, lat, lon in localities:
        if pid is not None and lat is not None and lon is not None:
            locs_by_parish.setdefault(pid, []).append((float(lat), float(lon)))

    out: list[ParishCoverage] = []
    covered_total = 0.0
    for p in parishes:
        pop = p.population or 0
        demand = cov.demand_points((float(p.latitude or 0), float(p.longitude or 0)), locs_by_parish.get(p.id, []))
        result = cov.parish_coverage(pop, demand, points, radius_m)
        covered_total += result.covered_population
        ref = cov.reference_points(pop)
        n = per_parish.get(p.id, 0)
        out.append(
            ParishCoverage(
                parish_code=p.dicofre,
                parish_name=p.name,
                population=pop,
                demand_points=result.demand_points,
                containers=n,
                containers_per_1000=round(cov.per_thousand(n, pop), 2),
                covered_population=round(result.covered_population),
                covered_pct=result.covered_pct,
                nearest_container_m=round(result.nearest_container_m)
                if result.nearest_container_m is not None
                else None,
                reference_points=ref,
                gap_points=cov.gap_points(ref, n),
            )
        )
    return CoverageSummary(
        state=CoverageState.OK,
        method=METHOD,
        radius_m=radius_m,
        kind=kind,
        population=population,
        containers=len(points),
        containers_total=total_any,
        containers_per_1000=round(cov.per_thousand(len(points), population), 2),
        covered_population=round(covered_total),
        covered_pct=cov.covered_fraction_pct(covered_total, population),
        reference=reference,
        gap_points=cov.gap_points(reference_total, len(points)),
        parishes=out,
    )
