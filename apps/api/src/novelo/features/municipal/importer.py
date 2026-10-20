"""Importa os `municipal_*` de data/processed (gerados por `just etl`). Idempotente: pode correr sempre.

Ordem: locais -> contentores -> relações -> freguesias (com o contorno CAOP) -> resumo -> alertas -> limpeza do que
saiu do ficheiro. Nunca toca na tabela `containers` (têxteis). O estado dos alertas (aberto/resolvido) é preservado.
"""

import csv
import json
import logging
import uuid
from collections import Counter
from pathlib import Path
from typing import Any

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.upsert import upsert
from novelo.domain.municipal import fold
from novelo.domain.vocab import PRODUCER_TYPE_LABELS
from novelo.features.datasets.models import DataAlert
from novelo.features.municipal.models import (
    MunicipalContainer,
    MunicipalLink,
    MunicipalMeta,
    MunicipalParishStat,
    MunicipalSite,
)

log = logging.getLogger(__name__)

MUNICIPAL_SOURCE = "vitrus_municipal_containers_2026_10"
REQUIRED_FILES = (
    "municipal_containers.csv",
    "municipal_sites.csv",
    "municipal_by_parish.csv",
    "municipal_links.csv",
    "municipal_alerts.csv",
    "municipal_summary.json",
    "caop_guimaraes.geojson",
)
LIST_SEPARATOR = "|"
PRODUCER_KEY_BY_LABEL = {label: key.value for key, label in PRODUCER_TYPE_LABELS.items()}


def has_package(data_dir: Path) -> bool:
    return all((data_dir / name).exists() for name in REQUIRED_FILES)


def _read(data_dir: Path, name: str) -> list[dict[str, str]]:
    with (data_dir / name).open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def _int(value: str) -> int | None:
    return int(float(value)) if value != "" else None


def _float(value: str) -> float | None:
    return float(value) if value != "" else None


def _bool(value: str) -> bool:
    return value.strip().lower() == "true"


def _text(value: str) -> str | None:
    return value if value != "" else None


def _list(value: str) -> list[str]:
    return [v for v in value.split(LIST_SEPARATOR) if v]


def site_row(r: dict[str, str], source_id: uuid.UUID, suspects: Counter[str]) -> dict[str, Any]:
    streets, names = _list(r["streets"]), _list(r["producer_names"])
    return {
        "source_id": source_id,
        "site_id": r["site_id"],
        "latitude": float(r["latitude"]),
        "longitude": float(r["longitude"]),
        "parish_dicofre": _text(r["parish_dicofre"]),
        "parish_code": _text(r["parish_code"]),
        "parish_name": _text(r["parish_name"]),
        "site_class": r["site_class"],
        "containers": int(r["containers"]),
        "units_declared": int(r["units_declared"]),
        "capacity_litres_total": int(r["capacity_litres_total"]),
        "capacity_unknown": int(r["capacity_unknown"]),
        **{k: int(r[k]) for k in _SITE_COUNTS},
        "kinds": _list(r["kinds"]),
        "source_files": _list(r["source_files"]),
        "producer_type_keys": sorted({PRODUCER_KEY_BY_LABEL[t] for t in _list(r["producer_types"])}),
        "streets": streets,
        "producer_names": names,
        "coord_precision": r["coord_precision"],
        "organic_collective_within_15m": int(r["organic_collective_within_15m"]),
        "nn_distance_m": _float(r["nn_distance_m"]),
        "textile_candidate": _bool(r["textile_candidate"]),
        "candidate_reason": _text(r["candidate_reason"]),
        "coord_suspect_containers": suspects[r["site_id"]],
        "search_text": fold(" ".join([r["site_id"], r["parish_name"], *streets])),
        "search_names": fold(" ".join(names)),
    }


_SITE_COUNTS = (
    "n_underground",
    "n_surface",
    "n_platform",
    "n_organic_collective",
    "n_organic_producer",
    "n_green_waste",
    "n_stream_organic",
    "n_stream_green",
    "n_stream_unknown",
)


def container_row(r: dict[str, str], source_id: uuid.UUID) -> dict[str, Any]:
    located = r["coord_status"] == "ok"
    return {
        "source_id": source_id,
        "container_uid": r["container_uid"],
        "source_file": r["source_file"],
        "source_line": int(r["source_line"]),
        "external_id": r["external_id"],
        "kind": r["kind"],
        "stream": r["stream"],
        "brand": _text(r["brand"]),
        "capacity_litres": _int(r["capacity_litres"]),
        "capacity_raw": _text(r["capacity_raw"]),
        "capacity_status": r["capacity_status"],
        "producer_type_key": _text(r["producer_type_key"]),
        "producer_name": _text(r["producer_name"]),
        "street": _text(r["street"]),
        "quantity": _int(r["quantity"]),
        "declared_parish": _text(r["declared_parish"]),
        "parish_dicofre": _text(r["parish_dicofre"]),
        "parish_code": _text(r["parish_code"]),
        "parish_name": _text(r["parish_name"]),
        "parish_match": r["parish_match"],
        "parish_match_level": _text(r["parish_match_level"]),
        "parish_mismatch_distance_m": _float(r["parish_mismatch_distance_m"]),
        "coord_suspect": _bool(r["coord_suspect"]),
        "latitude": _float(r["latitude"]),
        "longitude": _float(r["longitude"]),
        "coord_status": r["coord_status"],
        "coord_swapped": _bool(r["coord_swapped"]),
        "coord_cleaned": _bool(r["coord_cleaned"]),
        "coord_decimals": _int(r["coord_decimals"]),
        "coord_precision": _text(r["coord_precision"]),
        "boundary_note": _text(r["boundary_note"]),
        "site_id": _text(r["site_id"]) if located else None,
        "units_at_site": _int(r["units_at_site"]) if located else None,
        "search_text": fold(
            " ".join(
                [
                    r["container_uid"],
                    r["street"],
                    r["parish_name"],
                    r["declared_parish"],
                    r["brand"],
                    r["producer_type"],
                ]
            )
        ),
        "search_names": fold(r["producer_name"]),
    }


_PARISH_RENAMES = {
    "textile_potential_t_estimate": "textile_potential_t",
    "textile_gap_t_estimate": "textile_gap_t",
}
_PARISH_INTS = (
    "population",
    "containers",
    "containers_pending",
    "sites",
    "public_sites",
    "n_underground",
    "n_surface",
    "n_platform",
    "n_organic_collective",
    "n_organic_producer",
    "n_green_waste",
    "capacity_litres_total",
    "producers_restaurant",
    "producers_school",
    "producers_establishment",
    "producers_large_producer",
    "producers_care_home",
    "producers_hospitality",
    "containers_coord_suspect",
    "candidate_sites",
    "candidate_sites_precise",
    "gap_rank",
)
_PARISH_FLOATS = (
    "area_km2",
    "containers_per_1000_hab",
    "public_sites_per_1000_hab",
    "containers_per_km2",
    "public_sites_per_km2",
    "mean_nn_distance_m",
    "median_nn_distance_m",
    "cover_pct_200m",
    "cover_pct_300m",
    "cover_pct_500m",
    "textile_potential_t_estimate",
    "textile_gap_t_estimate",
    "gap_t_per_candidate_site",
)


def parish_row(r: dict[str, str], source_id: uuid.UUID, feature: dict[str, Any] | None) -> dict[str, Any]:
    out: dict[str, Any] = {
        "source_id": source_id,
        "dicofre": r["dicofre"],
        "dicofre_caop": r["dicofre_caop"],
        "name": r["name"],
        **{k: int(r[k]) for k in _PARISH_INTS},
        **{_PARISH_RENAMES.get(k, k): _float(r[k]) for k in _PARISH_FLOATS},
    }
    props = feature["properties"] if feature else {}
    out |= {
        "taa": props.get("taa"),
        "area_ha": props.get("area_ha"),
        "centroid_lat": props.get("lat"),
        "centroid_lon": props.get("lon"),
        "geometry": feature["geometry"] if feature else None,
    }
    return out


async def import_municipal(db: AsyncSession, data_dir: Path, source_id: uuid.UUID) -> dict[str, int]:
    """Importa o pacote municipal. Devolve as contagens. Não faz commit (quem chama decide)."""
    containers = _read(data_dir, "municipal_containers.csv")
    suspects: Counter[str] = Counter(r["site_id"] for r in containers if _bool(r["coord_suspect"]) and r["site_id"])

    site_rows = [site_row(r, source_id, suspects) for r in _read(data_dir, "municipal_sites.csv")]
    await upsert(db, MunicipalSite, site_rows, ["site_id"], [c for c in site_rows[0] if c not in {"site_id"}])

    container_rows = [container_row(r, source_id) for r in containers]
    await upsert(
        db,
        MunicipalContainer,
        container_rows,
        ["container_uid"],
        [c for c in container_rows[0] if c != "container_uid"],
    )

    # Relações: retrato completo (cascata a partir do contentor).
    await db.execute(delete(MunicipalLink).where(MunicipalLink.source_id == source_id))
    link_rows = [
        {
            "source_id": source_id,
            "organic_uid": r["organic_uid"],
            "nearest_street_uid": _text(r["nearest_street_uid"]),
            "nearest_street_kind": _text(r["nearest_street_kind"]),
            "distance_m": _float(r["distance_m"]),
            "within_link_radius": _bool(r["within_link_radius"]),
            "same_number_uid": _text(r["same_number_uid"]),
            "same_number_distance_m": _float(r["same_number_distance_m"]),
            "same_number_same_street": _bool(r["same_number_same_street"]) if r["same_number_same_street"] else None,
        }
        for r in _read(data_dir, "municipal_links.csv")
    ]
    db.add_all(MunicipalLink(**row) for row in link_rows)

    caop = json.loads((data_dir / "caop_guimaraes.geojson").read_text(encoding="utf-8"))
    features = {f["properties"]["dicofre"]: f for f in caop["features"]}
    parish_rows = [
        parish_row(r, source_id, features.get(r["dicofre"])) for r in _read(data_dir, "municipal_by_parish.csv")
    ]
    await upsert(db, MunicipalParishStat, parish_rows, ["dicofre"], [c for c in parish_rows[0] if c != "dicofre"])

    summary = json.loads((data_dir / "municipal_summary.json").read_text(encoding="utf-8"))
    meta = [
        {"source_id": source_id, "key": "summary", "payload": summary},
        {"source_id": source_id, "key": "caop", "payload": {k: v for k, v in caop.items() if k != "features"}},
    ]
    await upsert(db, MunicipalMeta, meta, ["key"], ["payload", "source_id"])

    alerts = [
        {
            "source_id": source_id,
            "number": int(a["id"]),
            "kind": a["type_key"],
            "detail": a["detail"],
            "suggestion": a["suggestion"],
        }
        for a in _read(data_dir, "municipal_alerts.csv")
    ]
    await upsert(db, DataAlert, alerts, ["source_id", "number"], ["kind", "detail", "suggestion"])
    await db.execute(
        delete(DataAlert).where(
            DataAlert.source_id == source_id, DataAlert.number.not_in([a["number"] for a in alerts])
        )
    )

    # O que saiu do ficheiro sai da base (contentores primeiro, por causa da chave estrangeira).
    await db.execute(
        delete(MunicipalContainer).where(
            MunicipalContainer.source_id == source_id,
            MunicipalContainer.container_uid.not_in([r["container_uid"] for r in container_rows]),
        )
    )
    await db.execute(
        delete(MunicipalSite).where(
            MunicipalSite.source_id == source_id, MunicipalSite.site_id.not_in([r["site_id"] for r in site_rows])
        )
    )
    counts = {
        "municipal_containers": len(container_rows),
        "municipal_sites": len(site_rows),
        "municipal_parishes": len(parish_rows),
        "municipal_links": len(link_rows),
        "municipal_alerts": len(alerts),
    }
    log.info("importação municipal concluída: %s", counts)
    return counts
