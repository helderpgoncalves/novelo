"""Rede MUNICIPAL de contentores (outras frações; não é a rede de têxteis). Rotas finas: a lógica está em `service`.

Autenticado (`guest`/`operator` leem; só `admin` pode pedir `show_names=true`). Respostas com ETag e Cache-Control.
"""

from dataclasses import dataclass
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import CurrentUser
from novelo.core.errors import AppError
from novelo.domain.municipal import parse_bbox
from novelo.domain.vocab import (
    CoordPrecision,
    MunicipalKind,
    MunicipalStream,
    ParishMatch,
    ProducerType,
    SiteClass,
)
from novelo.features.municipal import access, analytics, exports, service
from novelo.features.municipal.filters import ContainerFilters, SiteFilters
from novelo.features.municipal.http import Cache, StaticCache
from novelo.features.municipal.schemas import (
    CaopFeatureCollection,
    MunicipalCandidatesOut,
    MunicipalContainerPage,
    MunicipalDensityBenchmarkOut,
    MunicipalGapRankingOut,
    MunicipalOverview,
    MunicipalParishList,
    MunicipalParishOut,
    MunicipalParishSort,
    MunicipalProducersOut,
    MunicipalSiteDetail,
    MunicipalSitePage,
    MunicipalSortOrder,
    SiteFeatureCollection,
)

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]

DEFAULT_LIMIT = 100


class InvalidBboxError(AppError):
    status_code = 400


@dataclass
class SiteQuery:
    filters: SiteFilters
    names: bool


@dataclass
class ContainerQuery:
    filters: ContainerFilters
    names: bool


ShowNames = Annotated[
    bool,
    Query(description="Incluir nomes de estabelecimentos. Só admin; qualquer outro papel recebe 403. Por omissão não."),
]


def _bbox(raw: str | None):  # type: ignore[no-untyped-def]
    if raw is None:
        return None
    try:
        return parse_bbox(raw)
    except ValueError as exc:
        raise InvalidBboxError(str(exc)) from None


def site_query(
    user: CurrentUser,
    kind: Annotated[list[MunicipalKind] | None, Query(description="Tipos de contentor presentes no local")] = None,
    stream: Annotated[list[MunicipalStream] | None, Query(description="Frações presentes no local")] = None,
    parish: Annotated[list[str] | None, Query(description="Códigos de freguesia (app/INE ou CAOP)")] = None,
    producer_type: Annotated[list[ProducerType] | None, Query()] = None,
    site_class: Annotated[list[SiteClass] | None, Query()] = None,
    textile_candidate: Annotated[
        bool | None, Query(description="Só candidatos (true) ou só não candidatos (false)")
    ] = None,
    coord_suspect: Annotated[
        bool | None, Query(description="Local com contentores a mais de 1 km da freguesia declarada")
    ] = None,
    coord_precision: Annotated[CoordPrecision | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=80, description="Pesquisa sem acentos: id, freguesia, ruas")] = None,
    bbox: Annotated[str | None, Query(description="min_lon,min_lat,max_lon,max_lat")] = None,
    show_names: ShowNames = False,
) -> SiteQuery:
    names = access.resolve_names(user.role, show_names)
    return SiteQuery(
        SiteFilters(
            kind=kind or [],
            stream=stream or [],
            parish=parish or [],
            producer_type=producer_type or [],
            site_class=site_class or [],
            textile_candidate=textile_candidate,
            coord_suspect=coord_suspect,
            coord_precision=coord_precision,
            q=q,
            bbox=_bbox(bbox),
            search_names=names,
        ),
        names,
    )


def container_query(
    user: CurrentUser,
    kind: Annotated[list[MunicipalKind] | None, Query()] = None,
    stream: Annotated[list[MunicipalStream] | None, Query()] = None,
    parish: Annotated[list[str] | None, Query(description="Códigos de freguesia (app/INE ou CAOP)")] = None,
    producer_type: Annotated[list[ProducerType] | None, Query()] = None,
    site_class: Annotated[list[SiteClass] | None, Query()] = None,
    textile_candidate: Annotated[bool | None, Query(description="O local do contentor é candidato a têxteis")] = None,
    coord_suspect: Annotated[bool | None, Query()] = None,
    coord_precision: Annotated[CoordPrecision | None, Query()] = None,
    located: Annotated[bool | None, Query(description="true = com coordenadas; false = pendentes")] = None,
    parish_match: Annotated[list[ParishMatch] | None, Query()] = None,
    brand: Annotated[str | None, Query(max_length=24, description="molok, bluebee, greenbee")] = None,
    q: Annotated[
        str | None, Query(max_length=80, description="Pesquisa sem acentos: id, rua, freguesia, marca")
    ] = None,
    bbox: Annotated[str | None, Query(description="min_lon,min_lat,max_lon,max_lat")] = None,
    show_names: ShowNames = False,
) -> ContainerQuery:
    names = access.resolve_names(user.role, show_names)
    return ContainerQuery(
        ContainerFilters(
            kind=kind or [],
            stream=stream or [],
            parish=parish or [],
            producer_type=producer_type or [],
            site_class=site_class or [],
            textile_candidate=textile_candidate,
            coord_suspect=coord_suspect,
            coord_precision=coord_precision,
            q=q,
            bbox=_bbox(bbox),
            search_names=names,
            located=located,
            parish_match=parish_match or [],
            brand=brand,
        ),
        names,
    )


SiteQ = Annotated[SiteQuery, Depends(site_query)]
ContainerQ = Annotated[ContainerQuery, Depends(container_query)]
Limit = Annotated[int, Query(ge=1, le=500, description="Itens por página")]
Cursor = Annotated[str | None, Query(max_length=200, description="`next_cursor` da página anterior")]


@router.get("/overview", response_model=MunicipalOverview)
async def get_municipal_overview(db: Db, cache: Cache) -> MunicipalOverview | Response:
    """KPIs da rede municipal: contentores, locais, densidade, cobertura e qualidade (estimativas etiquetadas)."""
    if cache.fresh:
        return cache.not_modified()
    return cache.stamp(await analytics.get_overview(db))


@router.get("/parishes", response_model=MunicipalParishList)
async def list_municipal_parishes(
    db: Db,
    cache: Cache,
    sort: Annotated[MunicipalParishSort, Query()] = MunicipalParishSort.NAME,
    order: Annotated[MunicipalSortOrder, Query()] = MunicipalSortOrder.ASC,
    q: Annotated[str | None, Query(max_length=80, description="Nome (sem acentos) ou código")] = None,
    min_population: Annotated[int | None, Query(ge=0)] = None,
    max_containers_per_1000_hab: Annotated[float | None, Query(ge=0)] = None,
    max_cover_pct_300m: Annotated[float | None, Query(ge=0, le=100)] = None,
    has_candidates: Annotated[bool | None, Query()] = None,
) -> MunicipalParishList | Response:
    """As 48 freguesias com população, contentores por 1 000 hab., por km², vizinho mais próximo e produtores."""
    if cache.fresh:
        return cache.not_modified()
    out = await service.list_parishes(
        db,
        sort=sort,
        order=order,
        q=q,
        min_population=min_population,
        max_containers_per_1000_hab=max_containers_per_1000_hab,
        max_cover_pct_300m=max_cover_pct_300m,
        has_candidates=has_candidates,
    )
    return cache.stamp(out)


@router.get("/parishes/caop.geojson", response_model=CaopFeatureCollection)
async def get_caop_parishes_geojson(db: Db, cache: StaticCache) -> Response:
    """Contornos CAOP 2019 das 48 freguesias (substitui o OSM, que falha 3 uniões) com métricas para coroplético."""
    if cache.fresh:
        return cache.not_modified()
    return cache.json_response(await service.caop_geojson(db), media_type="application/geo+json")


@router.get("/parishes/{dicofre}", response_model=MunicipalParishOut)
async def get_municipal_parish(
    dicofre: Annotated[str, Path(max_length=8)], db: Db, cache: Cache
) -> MunicipalParishOut | Response:
    """Uma freguesia pelo código da app/INE (ou CAOP)."""
    if cache.fresh:
        return cache.not_modified()
    return cache.stamp(await service.get_parish(db, dicofre))


@router.get("/sites", response_model=MunicipalSitePage)
async def list_municipal_sites(
    db: Db, query: SiteQ, cache: Cache, limit: Limit = DEFAULT_LIMIT, cursor: Cursor = None
) -> MunicipalSitePage | Response:
    """Locais (contentores no mesmo ponto) com filtros e paginação por cursor, ordenados por `site_id`."""
    if cache.fresh:
        return cache.not_modified()
    return cache.stamp(await service.list_sites(db, query.filters, limit=limit, cursor=cursor, names=query.names))


@router.get("/sites/geojson", response_model=SiteFeatureCollection)
async def get_municipal_sites_geojson(
    db: Db,
    query: SiteQ,
    cache: Cache,
    zoom: Annotated[
        int | None, Query(ge=0, le=22, description="Zoom do mapa; com `cluster` agrupa abaixo do 16")
    ] = None,
    cluster: Annotated[bool, Query(description="Agrupar no servidor (grelha por zoom)")] = True,
) -> Response:
    """GeoJSON leve dos locais por bbox/zoom, com agrupamento opcional no servidor. Comprimido (gzip)."""
    if cache.fresh:
        return cache.not_modified()
    out = await service.sites_geojson(db, query.filters, zoom=zoom, cluster=cluster)
    return cache.json_response(out, media_type="application/geo+json")


@router.get("/sites/{site_id}", response_model=MunicipalSiteDetail)
async def get_municipal_site(
    site_id: Annotated[str, Path(max_length=12)],
    db: Db,
    user: CurrentUser,
    cache: Cache,
    radius_m: Annotated[
        int, Query(ge=10, le=1000, description="Raio dos vizinhos")
    ] = service.DEFAULT_NEIGHBOUR_RADIUS_M,
    show_names: ShowNames = False,
) -> MunicipalSiteDetail | Response:
    """Um local com os seus contentores, as relações com orgânicos coletivos e os locais vizinhos."""
    names = access.resolve_names(user.role, show_names)
    if cache.fresh:
        return cache.not_modified()
    return cache.stamp(await service.get_site(db, site_id, radius_m=radius_m, names=names))


@router.get("/containers", response_model=MunicipalContainerPage)
async def list_municipal_containers(
    db: Db, query: ContainerQ, cache: Cache, limit: Limit = DEFAULT_LIMIT, cursor: Cursor = None
) -> MunicipalContainerPage | Response:
    """Tabela completa dos contentores (com os pendentes sem coordenadas), por cursor e ordenada por `container_uid`."""
    if cache.fresh:
        return cache.not_modified()
    return cache.stamp(await service.list_containers(db, query.filters, limit=limit, cursor=cursor, names=query.names))


@router.get("/producers", response_model=MunicipalProducersOut)
async def list_municipal_producers(
    db: Db, query: SiteQ, cache: Cache, limit: Limit = DEFAULT_LIMIT, cursor: Cursor = None
) -> MunicipalProducersOut | Response:
    """Produtores (hotelaria, lares, escolas, restauração, grandes) por tipo e local. Sem nomes por omissão."""
    if cache.fresh:
        return cache.not_modified()
    return cache.stamp(await service.list_producers(db, query.filters, limit=limit, cursor=cursor, names=query.names))


@router.get("/textile-candidates", response_model=MunicipalCandidatesOut)
async def get_textile_candidate_sites(
    db: Db,
    query: SiteQ,
    cache: Cache,
    precise_only: Annotated[bool, Query(description="Só com coordenada precisa (4 ou mais casas)")] = False,
    limit: Limit = DEFAULT_LIMIT,
    cursor: Cursor = None,
) -> MunicipalCandidatesOut | Response:
    """Locais candidatos a têxteis do ETL, com justificação e ordem explícita. Lugares possíveis, não recomendados."""
    if cache.fresh:
        return cache.not_modified()
    out = await service.textile_candidates(
        db, query.filters, precise_only=precise_only, limit=limit, cursor=cursor, names=query.names
    )
    return cache.stamp(out)


@router.get("/gap-ranking", response_model=MunicipalGapRankingOut)
async def get_municipal_gap_ranking(
    db: Db, cache: Cache, limit: Annotated[int | None, Query(ge=1, le=48)] = None
) -> MunicipalGapRankingOut | Response:
    """Lacuna de têxtil por freguesia (ESTIMATIVA, captura média igual em todas), com a regra explícita."""
    if cache.fresh:
        return cache.not_modified()
    return cache.stamp(await analytics.gap_ranking(db, limit=limit))


@router.get("/density-benchmark", response_model=MunicipalDensityBenchmarkOut)
async def get_municipal_density_benchmark(db: Db, cache: Cache) -> MunicipalDensityBenchmarkOut | Response:
    """Densidade do concelho e distribuição entre freguesias; compara com a referência francesa (por verificar)."""
    if cache.fresh:
        return cache.not_modified()
    return cache.stamp(await analytics.density_benchmark(db))


@router.get(
    "/export",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": "Ficheiro CSV (UTF-8 com BOM), XLSX ou GeoJSON",
            "content": {mt.split(";")[0]: {} for mt in exports.MEDIA_TYPES.values()},
        }
    },
)
async def export_municipal_sites(
    db: Db,
    query: SiteQ,
    fmt: Annotated[exports.ExportFormat, Query(alias="format")] = exports.ExportFormat.CSV,
    scope: Annotated[
        exports.ExportScope, Query(description="Uma linha por local ou por contentor")
    ] = exports.ExportScope.SITES,
) -> StreamingResponse:
    """Exporta locais ou contentores filtrados em CSV, XLSX ou GeoJSON. Sem nomes de produtores, salvo admin."""
    version = await access.data_version(db)
    stream = exports.STREAMERS[fmt](db, scope, query.filters, query.names)
    return StreamingResponse(
        stream,
        media_type=exports.MEDIA_TYPES[fmt],
        headers={
            "Content-Disposition": f'attachment; filename="contentores-municipais-{scope.value}-{version}.{fmt.value}"',
            "Cache-Control": "private, no-store",
        },
    )
