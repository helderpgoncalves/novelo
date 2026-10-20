"""Rede MUNICIPAL de contentores (pacote QGIS da Vitrus, 20 out 2026): outras frações, NÃO é a rede de têxteis.

Tabelas próprias (`municipal_*`); a tabela `containers` fica só para têxteis. Cada linha guarda a fonte
(`source_id` -> `data_sources`, onde está o SHA-256 do pacote) e, nos contentores, o ficheiro e a linha de origem.
"""

import uuid
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Float,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.vocab import (
    CapacityStatus,
    CoordPrecision,
    CoordStatus,
    MunicipalKind,
    MunicipalSourceFile,
    MunicipalStream,
    ParishMatch,
    ParishMatchLevel,
    ProducerType,
    SiteClass,
)


def _source_fk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="RESTRICT"), index=True)


class MunicipalSite(Base, UuidPkMixin, TimestampMixin):
    """Local: contentores com as mesmas coordenadas (5 casas decimais). `site_id` = S + 8 hex do SHA-1 de `lat,lon`."""

    __tablename__ = "municipal_sites"
    __table_args__ = (
        enum_check("site_class", SiteClass),
        enum_check("coord_precision", CoordPrecision),
        CheckConstraint("containers >= 1", name="containers_positive"),
        Index("ix_municipal_sites_lat_lon", "latitude", "longitude"),
        Index("ix_municipal_sites_candidate", "textile_candidate"),
    )

    source_id: Mapped[uuid.UUID] = _source_fk()
    site_id: Mapped[str] = mapped_column(String(12), unique=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    parish_dicofre: Mapped[str | None] = mapped_column(String(6), index=True)  # CAOP 2019
    parish_code: Mapped[str | None] = mapped_column(String(6), index=True)  # código da app (INE; uniões 0308U1..5)
    parish_name: Mapped[str | None] = mapped_column(String(160))
    site_class: Mapped[SiteClass] = mapped_column(enum_column(SiteClass))
    containers: Mapped[int] = mapped_column(Integer)
    units_declared: Mapped[int] = mapped_column(Integer)
    capacity_litres_total: Mapped[int] = mapped_column(Integer)
    capacity_unknown: Mapped[int] = mapped_column(Integer)
    n_underground: Mapped[int] = mapped_column(Integer)
    n_surface: Mapped[int] = mapped_column(Integer)
    n_platform: Mapped[int] = mapped_column(Integer)
    n_organic_collective: Mapped[int] = mapped_column(Integer)
    n_organic_producer: Mapped[int] = mapped_column(Integer)
    n_green_waste: Mapped[int] = mapped_column(Integer)
    n_stream_organic: Mapped[int] = mapped_column(Integer)
    n_stream_green: Mapped[int] = mapped_column(Integer)
    n_stream_unknown: Mapped[int] = mapped_column(Integer)
    kinds: Mapped[list[str]] = mapped_column(ARRAY(String(24)))
    source_files: Mapped[list[str]] = mapped_column(ARRAY(String(24)))
    producer_type_keys: Mapped[list[str]] = mapped_column(ARRAY(String(24)))
    streets: Mapped[list[str]] = mapped_column(ARRAY(Text))
    # SENSÍVEL: estabelecimentos privados. Só se mostram a admins que o peçam (decisão pendente da Vitrus).
    producer_names: Mapped[list[str]] = mapped_column(ARRAY(Text))
    coord_precision: Mapped[CoordPrecision] = mapped_column(enum_column(CoordPrecision))
    organic_collective_within_15m: Mapped[int] = mapped_column(Integer)
    nn_distance_m: Mapped[float | None] = mapped_column(Float)  # vizinho público mais próximo (só locais públicos)
    textile_candidate: Mapped[bool] = mapped_column(Boolean)
    candidate_reason: Mapped[str | None] = mapped_column(Text)
    coord_suspect_containers: Mapped[int] = mapped_column(Integer, default=0)  # derivado dos contentores do local
    search_text: Mapped[str] = mapped_column(Text)  # id, freguesia e ruas, sem acentos nem maiúsculas
    search_names: Mapped[str] = mapped_column(Text, default="")  # nomes de produtores, só pesquisável por admins


class MunicipalContainer(Base, UuidPkMixin, TimestampMixin):
    """Um contentor (linha de um dos 5 ficheiros). Os sem coordenadas ficam `pending` e sem local."""

    __tablename__ = "municipal_containers"
    __table_args__ = (
        enum_check("kind", MunicipalKind),
        enum_check("stream", MunicipalStream),
        enum_check("source_file", MunicipalSourceFile),
        enum_check("capacity_status", CapacityStatus),
        enum_check("producer_type_key", ProducerType),
        enum_check("parish_match", ParishMatch),
        enum_check("parish_match_level", ParishMatchLevel),
        enum_check("coord_status", CoordStatus),
        enum_check("coord_precision", CoordPrecision),
        Index("ix_municipal_containers_lat_lon", "latitude", "longitude"),
    )

    source_id: Mapped[uuid.UUID] = _source_fk()
    container_uid: Mapped[str] = mapped_column(String(48), unique=True)  # ficheiro:id, estável entre importações
    source_file: Mapped[MunicipalSourceFile] = mapped_column(enum_column(MunicipalSourceFile))
    source_line: Mapped[int] = mapped_column(Integer)  # linha física (1 = cabeçalho)
    external_id: Mapped[str] = mapped_column(String(24))
    kind: Mapped[MunicipalKind] = mapped_column(enum_column(MunicipalKind), index=True)
    stream: Mapped[MunicipalStream] = mapped_column(enum_column(MunicipalStream), index=True)
    brand: Mapped[str | None] = mapped_column(String(24))
    capacity_litres: Mapped[int | None] = mapped_column(Integer)
    capacity_raw: Mapped[str | None] = mapped_column(String(40))
    capacity_status: Mapped[CapacityStatus] = mapped_column(enum_column(CapacityStatus))
    producer_type_key: Mapped[ProducerType | None] = mapped_column(enum_column(ProducerType), index=True)
    producer_name: Mapped[str | None] = mapped_column(Text)  # SENSÍVEL, ver `MunicipalSite.producer_names`
    street: Mapped[str | None] = mapped_column(Text)
    quantity: Mapped[int | None] = mapped_column(SmallInteger)  # `Quantidade` dos verdes: semântica por esclarecer
    declared_parish: Mapped[str | None] = mapped_column(String(160))  # como escrito no ficheiro; nunca conta
    parish_dicofre: Mapped[str | None] = mapped_column(String(6), index=True)
    parish_code: Mapped[str | None] = mapped_column(String(6))
    parish_name: Mapped[str | None] = mapped_column(String(160))
    parish_match: Mapped[ParishMatch] = mapped_column(enum_column(ParishMatch))
    parish_match_level: Mapped[ParishMatchLevel | None] = mapped_column(enum_column(ParishMatchLevel))
    parish_mismatch_distance_m: Mapped[float | None] = mapped_column(Float)
    coord_suspect: Mapped[bool] = mapped_column(Boolean)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    coord_status: Mapped[CoordStatus] = mapped_column(enum_column(CoordStatus))
    coord_swapped: Mapped[bool] = mapped_column(Boolean)
    coord_cleaned: Mapped[bool] = mapped_column(Boolean)
    coord_decimals: Mapped[int | None] = mapped_column(SmallInteger)
    coord_precision: Mapped[CoordPrecision | None] = mapped_column(enum_column(CoordPrecision))
    boundary_note: Mapped[str | None] = mapped_column(Text)
    site_id: Mapped[str | None] = mapped_column(
        String(12), ForeignKey("municipal_sites.site_id", ondelete="SET NULL"), index=True
    )
    units_at_site: Mapped[int | None] = mapped_column(Integer)
    search_text: Mapped[str] = mapped_column(Text)
    search_names: Mapped[str] = mapped_column(Text, default="")


class MunicipalParishStat(Base, UuidPkMixin, TimestampMixin):
    """Métricas municipais de uma freguesia (48) e o contorno CAOP 2019 (GeoJSON simplificado a 5 m)."""

    __tablename__ = "municipal_parish_stats"
    __table_args__ = (UniqueConstraint("dicofre", name="uq_municipal_parish_stats_dicofre"),)

    source_id: Mapped[uuid.UUID] = _source_fk()
    dicofre: Mapped[str] = mapped_column(String(6))  # código da app/INE (liga a `parishes.dicofre`)
    dicofre_caop: Mapped[str] = mapped_column(String(6))
    name: Mapped[str] = mapped_column(String(160))
    population: Mapped[int] = mapped_column(Integer)
    area_km2: Mapped[float] = mapped_column(Float)
    containers: Mapped[int] = mapped_column(Integer)
    containers_pending: Mapped[int] = mapped_column(Integer)
    sites: Mapped[int] = mapped_column(Integer)
    public_sites: Mapped[int] = mapped_column(Integer)
    n_underground: Mapped[int] = mapped_column(Integer)
    n_surface: Mapped[int] = mapped_column(Integer)
    n_platform: Mapped[int] = mapped_column(Integer)
    n_organic_collective: Mapped[int] = mapped_column(Integer)
    n_organic_producer: Mapped[int] = mapped_column(Integer)
    n_green_waste: Mapped[int] = mapped_column(Integer)
    containers_per_1000_hab: Mapped[float] = mapped_column(Float)
    public_sites_per_1000_hab: Mapped[float] = mapped_column(Float)
    containers_per_km2: Mapped[float] = mapped_column(Float)
    public_sites_per_km2: Mapped[float] = mapped_column(Float)
    mean_nn_distance_m: Mapped[float | None] = mapped_column(Float)
    median_nn_distance_m: Mapped[float | None] = mapped_column(Float)
    capacity_litres_total: Mapped[int] = mapped_column(Integer)
    cover_pct_200m: Mapped[float] = mapped_column(Float)  # % da ÁREA (não da população) a ≤ 200 m de um local
    cover_pct_300m: Mapped[float] = mapped_column(Float)
    cover_pct_500m: Mapped[float] = mapped_column(Float)
    producers_restaurant: Mapped[int] = mapped_column(Integer)
    producers_school: Mapped[int] = mapped_column(Integer)
    producers_establishment: Mapped[int] = mapped_column(Integer)
    producers_large_producer: Mapped[int] = mapped_column(Integer)
    producers_care_home: Mapped[int] = mapped_column(Integer)
    producers_hospitality: Mapped[int] = mapped_column(Integer)
    containers_coord_suspect: Mapped[int] = mapped_column(Integer)
    candidate_sites: Mapped[int] = mapped_column(Integer)
    candidate_sites_precise: Mapped[int] = mapped_column(Integer)
    textile_potential_t: Mapped[float] = mapped_column(Float)  # ESTIMATIVA
    textile_gap_t: Mapped[float] = mapped_column(Float)  # ESTIMATIVA
    gap_t_per_candidate_site: Mapped[float] = mapped_column(Float)  # ESTIMATIVA
    gap_rank: Mapped[int] = mapped_column(SmallInteger)
    taa: Mapped[str | None] = mapped_column(String(40))
    area_ha: Mapped[float | None] = mapped_column(Float)
    centroid_lat: Mapped[float | None] = mapped_column(Float)
    centroid_lon: Mapped[float | None] = mapped_column(Float)
    geometry: Mapped[dict[str, Any] | None] = mapped_column(JSONB)


class MunicipalLink(Base, UuidPkMixin, TimestampMixin):
    """Orgânico coletivo -> contentor de rua mais próximo (relação espacial, não por número de ID)."""

    __tablename__ = "municipal_links"

    source_id: Mapped[uuid.UUID] = _source_fk()
    organic_uid: Mapped[str] = mapped_column(
        String(48), ForeignKey("municipal_containers.container_uid", ondelete="CASCADE"), unique=True
    )
    nearest_street_uid: Mapped[str | None] = mapped_column(String(48), index=True)
    nearest_street_kind: Mapped[str | None] = mapped_column(String(24))
    distance_m: Mapped[float | None] = mapped_column(Float)
    within_link_radius: Mapped[bool] = mapped_column(Boolean)
    same_number_uid: Mapped[str | None] = mapped_column(String(48))
    same_number_distance_m: Mapped[float | None] = mapped_column(Float)
    same_number_same_street: Mapped[bool | None] = mapped_column(Boolean)


class MunicipalMeta(Base, UuidPkMixin, TimestampMixin):
    """Documentos pequenos da importação: `summary` (municipal_summary.json) e `caop` (metadados do GeoJSON)."""

    __tablename__ = "municipal_meta"

    source_id: Mapped[uuid.UUID] = _source_fk()
    key: Mapped[str] = mapped_column(String(40), unique=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
