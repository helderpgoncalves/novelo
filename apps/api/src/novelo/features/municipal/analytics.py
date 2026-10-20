"""Rede MUNICIPAL: casos de uso de leitura. Sem FastAPI; levantam `AppError`.

Nomes de produtores: as funções recebem `names: bool` já decidido por `resolve_names` (admin + pedido explícito).
Tudo o que vem do ETL como estimativa (lacuna por freguesia, cobertura de área) sai com essa etiqueta.
"""

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import NotFoundError
from novelo.domain import municipal as dom
from novelo.domain.coverage import FRENCH_PEOPLE_PER_POINT, reference_points
from novelo.domain.vocab import (
    PRODUCER_TYPE_LABELS,
    AlertStatus,
    CoordPrecision,
    CoordStatus,
    MunicipalStream,
    ParishMatch,
    ProducerType,
    SiteClass,
)
from novelo.features.datasets.models import DataAlert
from novelo.features.municipal.access import get_meta, get_source
from novelo.features.municipal.models import (
    MunicipalContainer,
    MunicipalParishStat,
    MunicipalSite,
)
from novelo.features.municipal.schemas import (
    MunicipalContainerTotals,
    MunicipalCoverageKpis,
    MunicipalDensityBenchmarkOut,
    MunicipalDensityKpis,
    MunicipalDensityStat,
    MunicipalDistributionOut,
    MunicipalEstimateNote,
    MunicipalGapParameters,
    MunicipalGapRankingOut,
    MunicipalGapRow,
    MunicipalKindCount,
    MunicipalNnDistance,
    MunicipalOverview,
    MunicipalParishDensity,
    MunicipalProducerTypeCount,
    MunicipalQualityKpis,
    MunicipalSiteTotals,
    MunicipalSourceInfo,
    MunicipalStreamCount,
    MunicipalTextileReference,
)

OVERVIEW_ESTIMATES = MunicipalEstimateNote(
    fields=["coverage", "sites.textile_candidates", "density.public_sites_per_1000_hab"],
    note=(
        "A cobertura é da área do concelho (sem população por quarteirão) e os candidatos são lugares possíveis a "
        "validar com a Vitrus; as densidades usam a população de 2021."
    ),
)


def _pct(part: int, whole: int) -> float | None:
    return round(part * 100 / whole, 1) if whole else None


# --- visão geral -------------------------------------------------------------------------------------------------


async def get_overview(db: AsyncSession) -> MunicipalOverview:
    source = await get_source(db)
    summary = await get_meta(db, "summary")
    caop = await get_meta(db, "caop")
    C, S, P = MunicipalContainer, MunicipalSite, MunicipalParishStat

    located = C.coord_status == CoordStatus.OK
    tot = (
        await db.execute(
            select(
                func.count(),
                func.count().filter(located),
                func.coalesce(func.sum(C.capacity_litres), 0),
                func.count().filter(C.capacity_litres.is_(None)),
                func.count().filter(C.stream == MunicipalStream.UNKNOWN),
                func.count().filter(C.capacity_status == "assumed_litres"),
                func.count().filter(C.coord_suspect.is_(True)),
                func.count().filter(C.parish_match.in_([ParishMatch.EQUAL, ParishMatch.DIFFERENT])),
                func.count().filter(C.parish_match == ParishMatch.EQUAL),
            )
        )
    ).one()
    accepted, n_located, litres, cap_unknown, stream_unknown, assumed, suspect, compared, equal = tot
    brands = dict((await db.execute(select(C.brand, func.count()).where(C.brand.is_not(None)).group_by(C.brand))).all())

    by_kind = [
        MunicipalKindCount(kind=k, containers=n, located=loc, capacity_litres_total=int(cap or 0))
        for k, n, loc, cap in (
            await db.execute(
                select(
                    C.kind, func.count(), func.count().filter(located), func.coalesce(func.sum(C.capacity_litres), 0)
                )
                .group_by(C.kind)
                .order_by(C.kind)
            )
        )
    ]
    streams = dict((await db.execute(select(C.stream, func.count()).group_by(C.stream))).all())
    by_stream = [MunicipalStreamCount(stream=s, containers=streams.get(s, 0)) for s in MunicipalStream]

    by_producer: list[MunicipalProducerTypeCount] = []
    rows = {
        t: (n, loc, int(cap or 0), dist)
        for t, n, loc, cap, dist in (
            await db.execute(
                select(
                    C.producer_type_key,
                    func.count(),
                    func.count().filter(located),
                    func.coalesce(func.sum(C.capacity_litres), 0),
                    func.count(distinct(C.producer_name)),
                )
                .where(C.producer_type_key.is_not(None))
                .group_by(C.producer_type_key)
            )
        )
    }
    for ptype in ProducerType:
        n, loc, cap, dist = rows.get(ptype, (0, 0, 0, 0))
        by_producer.append(
            MunicipalProducerTypeCount(
                type=ptype,
                label=PRODUCER_TYPE_LABELS[ptype],
                containers=n,
                located=loc,
                producers_distinct=dist,
                capacity_litres_total=cap,
            )
        )

    st = (
        await db.execute(
            select(
                func.count(),
                func.count().filter(S.site_class == SiteClass.PUBLIC),
                func.count().filter(S.site_class == SiteClass.PRODUCER),
                func.count().filter(S.site_class == SiteClass.MIXED),
                func.count().filter(S.containers == 1),
                func.coalesce(func.max(S.containers), 0),
                func.count().filter(S.textile_candidate.is_(True)),
                func.count().filter(S.textile_candidate.is_(True), S.coord_precision == CoordPrecision.PRECISE),
                func.count().filter(S.textile_candidate.is_(True), S.n_underground > 0),
                func.count().filter(S.coord_precision == CoordPrecision.PRECISE),
                func.count().filter(S.coord_precision == CoordPrecision.APPROXIMATE),
            )
        )
    ).one()
    parish_agg = (
        await db.execute(
            select(
                func.coalesce(func.sum(P.population), 0),
                func.coalesce(func.sum(P.area_km2), 0.0),
                func.coalesce(func.sum(P.containers), 0),
                func.coalesce(func.sum(P.public_sites), 0),
                func.count().filter(P.cover_pct_300m >= 50),
                func.count().filter(P.cover_pct_300m < 25),
            )
        )
    ).one()
    population, area_km2, p_containers, p_public, half_covered, under_quarter = parish_agg

    alerts_total, alerts_open = (
        await db.execute(
            select(func.count(), func.count().filter(DataAlert.status == AlertStatus.OPEN)).where(
                DataAlert.source_id == source.id
            )
        )
    ).one()

    analysis = summary.get("analysis", {})
    cover = analysis.get("coverage_pct_of_municipality_area", {})
    nn = analysis.get("public_site_nn_distance_m")
    nn_out = (
        MunicipalNnDistance(
            n=nn["n"],
            mean_m=nn["mean"],
            p5_m=nn["p5"],
            p25_m=nn["p25"],
            median_m=nn["median"],
            p75_m=nn["p75"],
            p95_m=nn["p95"],
            max_m=nn["max"],
        )
        if nn
        else None
    )
    return MunicipalOverview(
        source=MunicipalSourceInfo(
            key=source.key,
            title=source.title,
            provider=source.provider,
            received_on=source.received_on,
            imported_at=source.imported_at,
            file_sha256=source.file_sha256,
            caop_version=str(summary.get("caop", {}).get("version") or caop.get("metadata", {}).get("source", "")),
        ),
        containers=MunicipalContainerTotals(
            accepted=accepted,
            located=n_located,
            pending=accepted - n_located,
            rejected=summary.get("containers", {}).get("rejected"),
            capacity_litres_total=int(litres or 0),
            capacity_unknown=cap_unknown,
            brands=brands,
        ),
        sites=MunicipalSiteTotals(
            total=st[0],
            public=st[1],
            producer=st[2],
            mixed=st[3],
            single_container=st[4],
            max_containers=st[5],
            textile_candidates=st[6],
            textile_candidates_precise=st[7],
            textile_candidates_underground=st[8],
        ),
        density=MunicipalDensityKpis(
            population=int(population),
            area_km2=round(float(area_km2), 2),
            containers_per_1000_hab=round(dom.per_thousand(p_containers, int(population)), 1),
            public_sites_per_1000_hab=round(dom.per_thousand(p_public, int(population)), 1),
            containers_per_km2=round(p_containers / area_km2, 1) if area_km2 else 0.0,
            public_sites_per_km2=round(p_public / area_km2, 1) if area_km2 else 0.0,
        ),
        coverage=MunicipalCoverageKpis(
            pct_200m=cover.get("200m"),
            pct_300m=cover.get("300m"),
            pct_500m=cover.get("500m"),
            parishes_half_covered_300m=half_covered,
            parishes_under_quarter_300m=under_quarter,
            nn_distance=nn_out,
        ),
        quality=MunicipalQualityKpis(
            sites_precise=st[9],
            sites_approximate=st[10],
            containers_coord_suspect=suspect,
            parish_compared=compared,
            parish_equal=equal,
            parish_equal_pct=_pct(equal, compared),
            stream_unknown_containers=stream_unknown,
            capacity_assumed_containers=assumed,
            open_alerts=alerts_open,
            alerts_total=alerts_total,
        ),
        by_kind=by_kind,
        by_stream=by_stream,
        by_producer_type=by_producer,
        estimates=OVERVIEW_ESTIMATES,
    )


async def gap_ranking(db: AsyncSession, *, limit: int | None) -> MunicipalGapRankingOut:
    summary = await get_meta(db, "summary")
    rules = summary.get("rules", {})
    stmt = select(MunicipalParishStat).order_by(MunicipalParishStat.gap_rank)
    if limit:
        stmt = stmt.limit(limit)
    rows = (await db.execute(stmt)).scalars()
    return MunicipalGapRankingOut(
        rule=dom.GAP_RULE_PT,
        parameters=MunicipalGapParameters(
            kg_per_inhab_month=float(rules.get("potential_kg_per_inhab_month", 0.7)),
            capture_pct=float(rules.get("capture_today_pct", 0.0)),
        ),
        caveat=(
            "Quase sem registos no inventário (ou sem recolha de rua): Lordelo, Tabuadelo e São Faustino, Serzedo e "
            "Calvos, Infantas; aí os pontos novos teriam de ser de raiz. Rácios com população de 2021."
        ),
        items=[
            MunicipalGapRow(
                rank=p.gap_rank,
                dicofre=p.dicofre,
                name=p.name,
                population=p.population,
                containers=p.containers,
                containers_per_1000_hab=p.containers_per_1000_hab,
                candidate_sites=p.candidate_sites,
                candidate_sites_precise=p.candidate_sites_precise,
                textile_potential_t=p.textile_potential_t,
                textile_gap_t=p.textile_gap_t,
                gap_t_per_candidate_site=p.gap_t_per_candidate_site,
            )
            for p in rows
        ],
    )


async def density_benchmark(db: AsyncSession) -> MunicipalDensityBenchmarkOut:
    from novelo.features.planning.benchmark_service import FRENCH_PERFORMANCE  # noqa: PLC0415

    parishes = list((await db.execute(select(MunicipalParishStat).order_by(MunicipalParishStat.dicofre))).scalars())
    if not parishes:
        raise NotFoundError("Municipal containers have not been imported")
    population = sum(p.population for p in parishes)
    area = sum(p.area_km2 for p in parishes)
    containers = sum(p.containers for p in parishes)
    public = sum(p.public_sites for p in parishes)
    candidates = sum(p.candidate_sites for p in parishes)

    def stat(key: str, label: str, unit: str, concelho: float, values: list[float]) -> MunicipalDensityStat:
        d = dom.distribution(values)
        return MunicipalDensityStat(
            key=key,
            label=label,
            unit=unit,
            concelho=round(concelho, 2),
            distribution=MunicipalDistributionOut(
                minimum=round(d.minimum, 2),
                p25=round(d.p25, 2),
                median=round(d.median, 2),
                p75=round(d.p75, 2),
                maximum=round(d.maximum, 2),
            ),
        )

    def over(attr: str) -> list[float]:
        return [getattr(p, attr) for p in parishes]

    cover_weighted = sum(p.cover_pct_300m * p.area_km2 for p in parishes) / area if area else 0.0
    stats = [
        stat(
            "containers_per_1000_hab",
            "Contentores por 1 000 habitantes",
            "contentores/1 000 hab.",
            dom.per_thousand(containers, population),
            over("containers_per_1000_hab"),
        ),
        stat(
            "public_sites_per_1000_hab",
            "Locais públicos por 1 000 habitantes",
            "locais/1 000 hab.",
            dom.per_thousand(public, population),
            over("public_sites_per_1000_hab"),
        ),
        stat(
            "containers_per_km2",
            "Contentores por km²",
            "contentores/km²",
            containers / area if area else 0.0,
            over("containers_per_km2"),
        ),
        stat(
            "public_sites_per_km2",
            "Locais públicos por km²",
            "locais/km²",
            public / area if area else 0.0,
            over("public_sites_per_km2"),
        ),
        stat("cover_pct_300m", "Cobertura da área a 300 m", "% da área", cover_weighted, over("cover_pct_300m")),
    ]
    p25 = dom.quantile([p.containers_per_1000_hab for p in parishes], 0.25)
    ref_points = reference_points(population, FRENCH_PEOPLE_PER_POINT)
    return MunicipalDensityBenchmarkOut(
        population=population,
        stats=stats,
        people_per_public_site=(round(v, 1) if (v := dom.people_per(public, population)) is not None else None),
        parishes=[
            MunicipalParishDensity(
                dicofre=p.dicofre,
                name=p.name,
                population=p.population,
                containers_per_1000_hab=p.containers_per_1000_hab,
                public_sites_per_1000_hab=p.public_sites_per_1000_hab,
                below_p25=p.containers_per_1000_hab < p25,
            )
            for p in sorted(parishes, key=lambda x: (x.containers_per_1000_hab, x.dicofre))
        ],
        textile_reference=MunicipalTextileReference(
            people_per_point=FRENCH_PERFORMANCE.people_per_point,
            verified=FRENCH_PERFORMANCE.verified,
            reference_points=ref_points,
            candidate_sites=candidates,
            candidates_per_reference_point=round(candidates / ref_points, 1) if ref_points else None,
            note=(
                "Referência francesa de 1 ponto de têxteis por ~1 414 habitantes (por verificar com a fonte). "
                "Compara-se com lugares possíveis da rede municipal, não com pontos de têxteis existentes."
            ),
        ),
        note=(
            "A cobertura do concelho é a média das freguesias ponderada pela área. A densidade usa a população "
            "de 2021 e só contentores com coordenadas dentro do concelho."
        ),
    )
