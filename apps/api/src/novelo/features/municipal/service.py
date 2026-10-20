"""Rede MUNICIPAL: casos de uso de leitura. Sem FastAPI; levantam `AppError`.

Nomes de produtores: as funções recebem `names: bool` já decidido por `resolve_names` (admin + pedido explícito).
Tudo o que vem do ETL como estimativa (lacuna por freguesia, cobertura de área) sai com essa etiqueta.
"""

from collections import defaultdict
from dataclasses import replace
from math import cos, radians
from typing import Any

from sqlalchemy import Select, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import NotFoundError
from novelo.domain import municipal as dom
from novelo.domain.geo import haversine_m
from novelo.domain.vocab import (
    PRODUCER_TYPE_LABELS,
    CoordPrecision,
    CoordStatus,
    MunicipalKind,
    ProducerType,
)
from novelo.features.municipal import mappers
from novelo.features.municipal.access import get_meta
from novelo.features.municipal.filters import (
    ContainerFilters,
    SiteFilters,
    apply_container_filters,
    apply_site_filters,
    decode_cursor,
    decode_offset,
    encode_cursor,
)
from novelo.features.municipal.models import (
    MunicipalContainer,
    MunicipalLink,
    MunicipalParishStat,
    MunicipalSite,
)
from novelo.features.municipal.schemas import (
    NOT_TEXTILE_NOTE,
    CaopFeature,
    CaopFeatureCollection,
    CaopProps,
    MunicipalCandidateOut,
    MunicipalCandidatesOut,
    MunicipalContainerPage,
    MunicipalEstimateNote,
    MunicipalNeighbourOut,
    MunicipalParishCount,
    MunicipalParishList,
    MunicipalParishOut,
    MunicipalParishSort,
    MunicipalProducerSite,
    MunicipalProducersOut,
    MunicipalProducerTypeSummary,
    MunicipalSiteDetail,
    MunicipalSitePage,
    MunicipalSortOrder,
    PointGeometry,
    SiteFeature,
    SiteFeatureCollection,
    SiteFeatureProps,
)

DEFAULT_NEIGHBOUR_RADIUS_M = 200
MAX_NEIGHBOURS = 10
METERS_PER_DEGREE = 111_320.0

PARISH_ESTIMATES = MunicipalEstimateNote(
    fields=["textile_potential_t", "textile_gap_t", "gap_t_per_candidate_site", "gap_rank"],
    note=(
        "Não há têxtil recolhido por freguesia: potencial, lacuna e t por candidato usam a captura média do concelho "
        "igual em todas. A cobertura (cover_pct_*) é da área, não da população."
    ),
)
TEXTILE_HYPOTHESIS: dict[ProducerType, str] = {
    ProducerType.HOSPITALITY: "Roupa de cama e toalhas em volume; clientes B2B. Primeiro alvo (poucos contactos).",
    ProducerType.CARE_HOME: "Roupa de cama e toalhas em volume; já são clientes B2B.",
    ProducerType.LARGE_PRODUCER: "Fardamento (hospital, universidade, fábricas). Primeiro alvo (poucos contactos).",
    ProducerType.SCHOOL: "Já têm campanha de têxteis com a Vitrus (cerca de 3 t em mais de 30 escolas).",
    ProducerType.ESTABLISHMENT: "Uniformes e roupa de trabalho; sem evidência de volume.",
    ProducerType.RESTAURANT: "Pouco têxtil reutilizável.",
}


# --- freguesias --------------------------------------------------------------------------------------------------

_PARISH_SORT: dict[MunicipalParishSort, Any] = {
    MunicipalParishSort.NAME: MunicipalParishStat.name,
    MunicipalParishSort.POPULATION: MunicipalParishStat.population,
    MunicipalParishSort.CONTAINERS: MunicipalParishStat.containers,
    MunicipalParishSort.CONTAINERS_PER_1000_HAB: MunicipalParishStat.containers_per_1000_hab,
    MunicipalParishSort.PUBLIC_SITES_PER_1000_HAB: MunicipalParishStat.public_sites_per_1000_hab,
    MunicipalParishSort.CONTAINERS_PER_KM2: MunicipalParishStat.containers_per_km2,
    MunicipalParishSort.MEAN_NN_DISTANCE_M: MunicipalParishStat.mean_nn_distance_m,
    MunicipalParishSort.COVER_PCT_300M: MunicipalParishStat.cover_pct_300m,
    MunicipalParishSort.CANDIDATE_SITES: MunicipalParishStat.candidate_sites,
    MunicipalParishSort.GAP_RANK: MunicipalParishStat.gap_rank,
    MunicipalParishSort.PRODUCERS: (
        MunicipalParishStat.producers_restaurant
        + MunicipalParishStat.producers_school
        + MunicipalParishStat.producers_establishment
        + MunicipalParishStat.producers_large_producer
        + MunicipalParishStat.producers_care_home
        + MunicipalParishStat.producers_hospitality
    ),
}


async def list_parishes(
    db: AsyncSession,
    *,
    sort: MunicipalParishSort = MunicipalParishSort.NAME,
    order: MunicipalSortOrder = MunicipalSortOrder.ASC,
    q: str | None = None,
    min_population: int | None = None,
    max_containers_per_1000_hab: float | None = None,
    max_cover_pct_300m: float | None = None,
    has_candidates: bool | None = None,
) -> MunicipalParishList:
    P = MunicipalParishStat
    stmt = select(P)
    if min_population is not None:
        stmt = stmt.where(P.population >= min_population)
    if max_containers_per_1000_hab is not None:
        stmt = stmt.where(P.containers_per_1000_hab <= max_containers_per_1000_hab)
    if max_cover_pct_300m is not None:
        stmt = stmt.where(P.cover_pct_300m <= max_cover_pct_300m)
    if has_candidates is not None:
        stmt = stmt.where(P.candidate_sites > 0 if has_candidates else P.candidate_sites == 0)
    column = _PARISH_SORT[sort]
    stmt = stmt.order_by((column.asc() if order == MunicipalSortOrder.ASC else column.desc()).nulls_last(), P.dicofre)
    rows = list((await db.execute(stmt)).scalars())
    terms = dom.fold(q or "").split()  # só 48 linhas: a pesquisa sem acentos faz-se aqui
    if terms:
        rows = [p for p in rows if all(t in dom.fold(p.name) or t == p.dicofre.lower() for t in terms)]
    items = [mappers.parish_out(p) for p in rows]
    return MunicipalParishList(items=items, total=len(items), estimates=PARISH_ESTIMATES)


async def get_parish(db: AsyncSession, code: str) -> MunicipalParishOut:
    P = MunicipalParishStat
    row = (await db.execute(select(P).where((P.dicofre == code) | (P.dicofre_caop == code)))).scalar_one_or_none()
    if row is None:
        raise NotFoundError("Parish not found")
    return mappers.parish_out(row)


async def find_parish(db: AsyncSession, text: str) -> tuple[MunicipalParishOut | None, list[str]]:
    """Freguesia por código ou por nome (sem acentos): (match único, sugestões). Para o copiloto."""
    needle = dom.fold(text)
    rows = list((await db.execute(select(MunicipalParishStat))).scalars())
    exact = [p for p in rows if text in {p.dicofre, p.dicofre_caop} or dom.fold(p.name) == needle]
    if len(exact) == 1:
        return mappers.parish_out(exact[0]), []
    part = [p for p in rows if needle and needle in dom.fold(p.name)]
    if len(part) == 1:
        return mappers.parish_out(part[0]), []
    return None, sorted(p.name for p in (part or exact))[:6]


# --- locais ------------------------------------------------------------------------------------------------------


async def list_sites(
    db: AsyncSession, f: SiteFilters, *, limit: int, cursor: str | None, names: bool
) -> MunicipalSitePage:
    S = MunicipalSite
    total = (await db.execute(apply_site_filters(select(func.count()).select_from(S), f))).scalar_one()
    stmt = apply_site_filters(select(S), f).order_by(S.site_id).limit(limit + 1)
    if cursor:
        stmt = stmt.where(S.site_id > decode_cursor(cursor))
    rows = list((await db.execute(stmt)).scalars())
    page, more = rows[:limit], len(rows) > limit
    return MunicipalSitePage(
        items=[mappers.site_out(s, names=names) for s in page],
        total=total,
        next_cursor=encode_cursor(page[-1].site_id) if more and page else None,
        names_visible=names,
    )


async def list_containers(
    db: AsyncSession, f: ContainerFilters, *, limit: int, cursor: str | None, names: bool
) -> MunicipalContainerPage:
    C = MunicipalContainer
    total = (await db.execute(apply_container_filters(select(func.count()).select_from(C), f))).scalar_one()
    stmt = apply_container_filters(select(C), f).order_by(C.container_uid).limit(limit + 1)
    if cursor:
        stmt = stmt.where(C.container_uid > decode_cursor(cursor))
    rows = list((await db.execute(stmt)).scalars())
    page, more = rows[:limit], len(rows) > limit
    return MunicipalContainerPage(
        items=[mappers.container_out(c, names=names) for c in page],
        total=total,
        next_cursor=encode_cursor(page[-1].container_uid) if more and page else None,
        names_visible=names,
    )


async def get_site(db: AsyncSession, site_id: str, *, radius_m: int, names: bool) -> MunicipalSiteDetail:
    S, C = MunicipalSite, MunicipalContainer
    site = (await db.execute(select(S).where(S.site_id == site_id))).scalar_one_or_none()
    if site is None:
        raise NotFoundError("Site not found")
    containers = list((await db.execute(select(C).where(C.site_id == site_id).order_by(C.container_uid))).scalars())
    uids = [c.container_uid for c in containers]
    links = list(
        (
            await db.execute(
                select(MunicipalLink)
                .where(MunicipalLink.organic_uid.in_(uids) | MunicipalLink.nearest_street_uid.in_(uids))
                .order_by(MunicipalLink.organic_uid)
            )
        ).scalars()
    )
    d_lat = radius_m / METERS_PER_DEGREE
    d_lon = radius_m / (METERS_PER_DEGREE * max(0.2, cos(radians(site.latitude))))
    near = (
        await db.execute(
            select(S).where(
                S.site_id != site_id,
                S.latitude.between(site.latitude - d_lat, site.latitude + d_lat),
                S.longitude.between(site.longitude - d_lon, site.longitude + d_lon),
            )
        )
    ).scalars()
    scored = sorted(
        ((haversine_m(site.latitude, site.longitude, n.latitude, n.longitude), n.site_id, n) for n in near),
        key=lambda t: (t[0], t[1]),
    )
    neighbours = [
        MunicipalNeighbourOut(
            site_id=n.site_id,
            distance_m=round(dist, 1),
            parish_name=n.parish_name,
            site_class=n.site_class,
            containers=n.containers,
            kinds=[MunicipalKind(k) for k in n.kinds],
            textile_candidate=n.textile_candidate,
        )
        for dist, _, n in scored
        if dist <= radius_m
    ][:MAX_NEIGHBOURS]
    parish = None
    if site.parish_dicofre:
        stat = (
            await db.execute(select(MunicipalParishStat).where(MunicipalParishStat.dicofre_caop == site.parish_dicofre))
        ).scalar_one_or_none()
        parish = mappers.parish_out(stat) if stat else None
    return MunicipalSiteDetail(
        site=mappers.site_out(site, names=names),
        containers=[mappers.container_out(c, names=names) for c in containers],
        neighbours=neighbours,
        links=[mappers.link_out(link) for link in links],
        parish=parish,
        radius_m=radius_m,
        names_visible=names,
    )


async def sites_geojson(db: AsyncSession, f: SiteFilters, *, zoom: int | None, cluster: bool) -> SiteFeatureCollection:
    S = MunicipalSite
    rows = list((await db.execute(apply_site_filters(select(S), f).order_by(S.site_id))).scalars())
    by_id = {s.site_id: s for s in rows}
    clustered = cluster and zoom is not None and zoom < dom.MAX_CLUSTER_ZOOM
    groups = (
        dom.grid_cluster([dom.GeoPoint(s.site_id, s.latitude, s.longitude, s.containers) for s in rows], zoom or 0)
        if clustered
        else [dom.Cluster(s.latitude, s.longitude, 1, s.containers, (s.site_id,)) for s in rows]
    )
    features: list[SiteFeature] = []
    for i, g in enumerate(groups):
        point = PointGeometry(coordinates=[round(g.lon, 6), round(g.lat, 6)])
        if g.sites == 1:
            s = by_id[g.keys[0]]
            props = SiteFeatureProps(
                cluster=False,
                point_count=1,
                containers=s.containers,
                site_id=s.site_id,
                site_class=s.site_class,
                kind=mappers.dominant_kind(s.kinds),
                kinds=[MunicipalKind(k) for k in s.kinds],
                textile_candidate=s.textile_candidate,
                coord_precision=s.coord_precision,
                parish_name=s.parish_name,
                nn_distance_m=s.nn_distance_m,
            )
            features.append(SiteFeature(id=s.site_id, geometry=point, properties=props))
        else:
            props = SiteFeatureProps(cluster=True, point_count=g.sites, containers=g.weight)
            features.append(SiteFeature(id=f"cluster-{zoom}-{i}", geometry=point, properties=props))
    return SiteFeatureCollection(features=features, total_sites=len(rows), clustered=clustered, zoom=zoom)


async def caop_geojson(db: AsyncSession) -> CaopFeatureCollection:
    P = MunicipalParishStat
    rows = list((await db.execute(select(P).where(P.geometry.is_not(None)).order_by(P.dicofre))).scalars())
    if not rows:
        raise NotFoundError("Municipal parish geometry has not been imported")
    caop = await get_meta(db, "caop")
    features = [
        CaopFeature(
            id=p.dicofre,
            geometry=p.geometry or {},
            properties=CaopProps(
                dicofre=p.dicofre,
                dicofre_caop=p.dicofre_caop,
                name=p.name,
                population=p.population,
                area_ha=p.area_ha,
                area_km2=p.area_km2,
                containers=p.containers,
                containers_per_1000_hab=p.containers_per_1000_hab,
                public_sites_per_1000_hab=p.public_sites_per_1000_hab,
                cover_pct_300m=p.cover_pct_300m,
                candidate_sites=p.candidate_sites,
                gap_t_per_candidate_site=p.gap_t_per_candidate_site,
                gap_rank=p.gap_rank,
                lat=p.centroid_lat,
                lon=p.centroid_lon,
            ),
        )
        for p in rows
    ]
    return CaopFeatureCollection(
        name=str(caop.get("name", "caop_guimaraes")),
        source=str(caop.get("metadata", {}).get("source", "CAOP 2019")),
        features=features,
    )


# --- produtores --------------------------------------------------------------------------------------------------

PRODUCER_TOP_PARISHES = 3


async def list_producers(
    db: AsyncSession, f: SiteFilters, *, limit: int, cursor: str | None, names: bool
) -> MunicipalProducersOut:
    S, C = MunicipalSite, MunicipalContainer
    located = C.coord_status == CoordStatus.OK
    stats = {
        t: (n, loc, sites, int(cap or 0), dist)
        for t, n, loc, sites, cap, dist in (
            await db.execute(
                select(
                    C.producer_type_key,
                    func.count(),
                    func.count().filter(located),
                    func.count(distinct(C.site_id)),
                    func.coalesce(func.sum(C.capacity_litres), 0),
                    func.count(distinct(C.producer_name)),
                )
                .where(C.producer_type_key.is_not(None))
                .group_by(C.producer_type_key)
            )
        )
    }
    per_parish: dict[ProducerType, list[MunicipalParishCount]] = defaultdict(list)
    for ptype, code, name, n in await db.execute(
        select(C.producer_type_key, C.parish_dicofre, func.coalesce(C.parish_name, "—"), func.count())
        .where(C.producer_type_key.is_not(None), located)
        .group_by(C.producer_type_key, C.parish_dicofre, C.parish_name)
    ):
        if ptype is not None:
            per_parish[ptype].append(MunicipalParishCount(dicofre=code, name=name, containers=n))
    by_type = []
    for ptype in ProducerType:
        n, loc, sites, cap, dist = stats.get(ptype, (0, 0, 0, 0, 0))
        top = sorted(per_parish[ptype], key=lambda x: (-x.containers, x.name))[:PRODUCER_TOP_PARISHES]
        by_type.append(
            MunicipalProducerTypeSummary(
                type=ptype,
                label=PRODUCER_TYPE_LABELS[ptype],
                containers=n,
                located=loc,
                sites=sites,
                producers_distinct=dist,
                capacity_litres_total=cap,
                top_parishes=top,
                textile_hypothesis=TEXTILE_HYPOTHESIS[ptype],
            )
        )

    base = apply_site_filters(select(S), f).where(func.cardinality(S.producer_type_keys) > 0)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    stmt: Select[Any] = base.order_by(S.site_id).limit(limit + 1)
    if cursor:
        stmt = stmt.where(S.site_id > decode_cursor(cursor))
    rows = list((await db.execute(stmt)).scalars())
    page, more = rows[:limit], len(rows) > limit
    items = [
        MunicipalProducerSite(
            site_id=s.site_id,
            latitude=s.latitude,
            longitude=s.longitude,
            parish_dicofre=s.parish_dicofre,
            parish_name=s.parish_name,
            producer_types=[ProducerType(p) for p in s.producer_type_keys],
            containers=s.containers,
            capacity_litres_total=s.capacity_litres_total,
            coord_precision=s.coord_precision,
            producer_names=list(s.producer_names) if names else None,
        )
        for s in page
    ]
    return MunicipalProducersOut(
        names_visible=names,
        by_type=by_type,
        items=items,
        total=total,
        next_cursor=encode_cursor(page[-1].site_id) if more and page else None,
    )


# --- candidatos a têxteis, lacuna e densidade ------------------------------------------------------------------------


async def textile_candidates(
    db: AsyncSession, f: SiteFilters, *, precise_only: bool, limit: int, cursor: str | None, names: bool
) -> MunicipalCandidatesOut:
    S, P = MunicipalSite, MunicipalParishStat
    light = select(
        S.site_id,
        S.coord_precision,
        S.n_underground,
        S.organic_collective_within_15m,
        S.containers,
        func.coalesce(P.gap_t_per_candidate_site, 0.0),
        func.coalesce(P.gap_rank, 0),
    ).join(P, P.dicofre_caop == S.parish_dicofre, isouter=True)
    everyone = (await db.execute(light.where(S.textile_candidate.is_(True)))).all()
    ordered = sorted(
        everyone,
        key=lambda r: dom.candidate_sort_key(
            dom.CandidateKeyInput(
                site_id=r[0],
                precise=r[1] == CoordPrecision.PRECISE,
                parish_gap_t_per_candidate=r[5],
                has_underground=r[2] > 0,
                organic_within_15m=r[3],
                containers=r[4],
            )
        ),
    )
    rank_of = {r[0]: i for i, r in enumerate(ordered, 1)}
    gap_of = {r[0]: (r[5], r[6]) for r in ordered}

    filt = replace(
        f, textile_candidate=True, coord_precision=CoordPrecision.PRECISE if precise_only else f.coord_precision
    )
    matching = (await db.execute(apply_site_filters(select(S.site_id, S.coord_precision), filt))).all()
    ids = sorted((r[0] for r in matching), key=lambda sid: rank_of[sid])
    total_precise = sum(1 for r in matching if r[1] == CoordPrecision.PRECISE)
    start = decode_offset(cursor)
    page_ids = ids[start : start + limit]
    sites = {s.site_id: s for s in (await db.execute(select(S).where(S.site_id.in_(page_ids)))).scalars()}
    items = []
    for sid in page_ids:
        s = sites[sid]
        items.append(
            MunicipalCandidateOut(
                rank=rank_of[sid],
                site=mappers.site_out(s, names=names),
                reasons=dom.candidate_reasons(
                    has_underground=s.n_underground > 0,
                    organic_within_15m=s.organic_collective_within_15m,
                    containers=s.containers,
                    approximate=s.coord_precision == CoordPrecision.APPROXIMATE,
                ),
                reason_text=s.candidate_reason,
                parish_gap_t_per_candidate=gap_of[sid][0],
                parish_gap_rank=gap_of[sid][1],
            )
        )
    nxt = start + limit
    return MunicipalCandidatesOut(
        rank_rule=dom.CANDIDATE_RANK_RULE_PT,
        note=NOT_TEXTILE_NOTE,
        total=len(ids),
        total_precise=total_precise,
        items=items,
        next_cursor=encode_cursor(nxt) if nxt < len(ids) else None,
    )
