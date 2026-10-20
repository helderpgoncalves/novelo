"""Linhas da base de dados -> schemas. É aqui que os nomes de produtores são retirados para quem não os pode ver."""

from novelo.domain.vocab import MunicipalKind, MunicipalSourceFile, ProducerType
from novelo.features.municipal.models import MunicipalContainer, MunicipalLink, MunicipalParishStat, MunicipalSite
from novelo.features.municipal.schemas import (
    MunicipalContainerOut,
    MunicipalKindCounts,
    MunicipalLinkOut,
    MunicipalParishOut,
    MunicipalProducersByType,
    MunicipalSiteOut,
    MunicipalStreamCounts,
)

# Cor/tipo principal de um local com vários tipos: o de rua mais "pesado" primeiro.
KIND_PRIORITY = (
    MunicipalKind.UNDERGROUND,
    MunicipalKind.PLATFORM,
    MunicipalKind.SURFACE,
    MunicipalKind.ORGANIC_COLLECTIVE,
    MunicipalKind.GREEN_WASTE,
    MunicipalKind.ORGANIC_PRODUCER,
)


def dominant_kind(kinds: list[str]) -> MunicipalKind | None:
    present = set(kinds)
    return next((k for k in KIND_PRIORITY if k.value in present), None)


def kind_counts(row: MunicipalSite | MunicipalParishStat) -> MunicipalKindCounts:
    return MunicipalKindCounts(
        underground=row.n_underground,
        surface=row.n_surface,
        platform=row.n_platform,
        organic_collective=row.n_organic_collective,
        organic_producer=row.n_organic_producer,
        green_waste=row.n_green_waste,
    )


def site_out(s: MunicipalSite, *, names: bool) -> MunicipalSiteOut:
    return MunicipalSiteOut(
        site_id=s.site_id,
        latitude=s.latitude,
        longitude=s.longitude,
        parish_dicofre=s.parish_dicofre,
        parish_code=s.parish_code,
        parish_name=s.parish_name,
        site_class=s.site_class,
        containers=s.containers,
        units_declared=s.units_declared,
        capacity_litres_total=s.capacity_litres_total,
        capacity_unknown=s.capacity_unknown,
        by_kind=kind_counts(s),
        by_stream=MunicipalStreamCounts(
            organico=s.n_stream_organic, verdes=s.n_stream_green, desconhecido=s.n_stream_unknown
        ),
        kinds=[MunicipalKind(k) for k in s.kinds],
        producer_types=[ProducerType(p) for p in s.producer_type_keys],
        producer_names=list(s.producer_names) if names else None,
        streets=list(s.streets),
        source_files=[MunicipalSourceFile(f) for f in s.source_files],
        coord_precision=s.coord_precision,
        organic_collective_within_15m=s.organic_collective_within_15m,
        nn_distance_m=s.nn_distance_m,
        textile_candidate=s.textile_candidate,
        candidate_reason=s.candidate_reason,
        coord_suspect_containers=s.coord_suspect_containers,
    )


def container_out(c: MunicipalContainer, *, names: bool) -> MunicipalContainerOut:
    return MunicipalContainerOut(
        container_uid=c.container_uid,
        source_file=c.source_file,
        source_line=c.source_line,
        external_id=c.external_id,
        kind=c.kind,
        stream=c.stream,
        brand=c.brand,
        capacity_litres=c.capacity_litres,
        capacity_raw=c.capacity_raw,
        capacity_status=c.capacity_status,
        producer_type=c.producer_type_key,
        producer_name=c.producer_name if names else None,
        street=c.street,
        quantity=c.quantity,
        declared_parish=c.declared_parish,
        parish_dicofre=c.parish_dicofre,
        parish_code=c.parish_code,
        parish_name=c.parish_name,
        parish_match=c.parish_match,
        parish_match_level=c.parish_match_level,
        parish_mismatch_distance_m=c.parish_mismatch_distance_m,
        coord_suspect=c.coord_suspect,
        latitude=c.latitude,
        longitude=c.longitude,
        coord_status=c.coord_status,
        coord_swapped=c.coord_swapped,
        coord_cleaned=c.coord_cleaned,
        coord_precision=c.coord_precision,
        boundary_note=c.boundary_note,
        site_id=c.site_id,
    )


def parish_out(p: MunicipalParishStat) -> MunicipalParishOut:
    return MunicipalParishOut(
        dicofre=p.dicofre,
        dicofre_caop=p.dicofre_caop,
        name=p.name,
        population=p.population,
        area_km2=p.area_km2,
        containers=p.containers,
        containers_pending=p.containers_pending,
        sites=p.sites,
        public_sites=p.public_sites,
        by_kind=kind_counts(p),
        capacity_litres_total=p.capacity_litres_total,
        containers_per_1000_hab=p.containers_per_1000_hab,
        public_sites_per_1000_hab=p.public_sites_per_1000_hab,
        containers_per_km2=p.containers_per_km2,
        public_sites_per_km2=p.public_sites_per_km2,
        mean_nn_distance_m=p.mean_nn_distance_m,
        median_nn_distance_m=p.median_nn_distance_m,
        cover_pct_200m=p.cover_pct_200m,
        cover_pct_300m=p.cover_pct_300m,
        cover_pct_500m=p.cover_pct_500m,
        producers=MunicipalProducersByType(
            restaurant=p.producers_restaurant,
            school=p.producers_school,
            establishment=p.producers_establishment,
            large_producer=p.producers_large_producer,
            care_home=p.producers_care_home,
            hospitality=p.producers_hospitality,
        ),
        containers_coord_suspect=p.containers_coord_suspect,
        candidate_sites=p.candidate_sites,
        candidate_sites_precise=p.candidate_sites_precise,
        textile_potential_t=p.textile_potential_t,
        textile_gap_t=p.textile_gap_t,
        gap_t_per_candidate_site=p.gap_t_per_candidate_site,
        gap_rank=p.gap_rank,
        centroid_lat=p.centroid_lat,
        centroid_lon=p.centroid_lon,
    )


def link_out(link: MunicipalLink) -> MunicipalLinkOut:
    return MunicipalLinkOut(
        organic_uid=link.organic_uid,
        nearest_street_uid=link.nearest_street_uid,
        nearest_street_kind=link.nearest_street_kind,
        distance_m=link.distance_m,
        within_link_radius=link.within_link_radius,
        same_number_uid=link.same_number_uid,
        same_number_distance_m=link.same_number_distance_m,
        same_number_same_street=link.same_number_same_street,
    )
