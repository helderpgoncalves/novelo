"""Importa data/processed/ (gerado por `just etl`) para a base de dados. Idempotente: pode correr sempre.

- Dados de referência (entidades, fluxos, circuitos, viaturas...) fazem upsert pela chave natural.
- Os turnos são um retrato do planeamento: substituem-se por completo por fonte.
- O estado dos alertas de dados (aberto/resolvido) nunca é sobrescrito por um novo import.
"""

import csv
import json
import logging
import unicodedata
import uuid
from datetime import UTC, date, datetime
from pathlib import Path

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.upsert import upsert as _upsert
from novelo.domain.geo import point_in_geometry
from novelo.domain.parish_area import geometry_area_km2
from novelo.features.datasets.models import DataAlert, DataSource
from novelo.features.municipal import importer as municipal_importer
from novelo.features.municipal.importer import MUNICIPAL_SOURCE
from novelo.features.network.models import (
    Circuit,
    CircuitDay,
    CircuitLocality,
    Container,
    FleetCapacity,
    Locality,
    Parish,
    ShiftAssignment,
    Vehicle,
)
from novelo.features.planning.service import ensure_default_parameters
from novelo.features.textile.models import TextileEntity, TextileFlow, WasteShare

log = logging.getLogger(__name__)

GEO_SOURCES = ("ine_census_2021", "osm_nominatim")
TEXTILE_SOURCE = "vitrus_textile_2025"
CIRCUITS_SOURCE = "vitrus_circuits_2026_09"
CONTAINERS_SOURCE = "vitrus_containers"  # só existe se scripts/etl/containers.py encontrou ficheiro em data/raw/
NO_CIRCUIT = "SEM CIRCUITO"


def _read(data_dir: Path, name: str) -> list[dict[str, str]]:
    with (data_dir / name).open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def _date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


MIN_PLAUSIBLE_PARISH_KM2 = (
    0.1  # abaixo disto o contorno do OSM é um engano (ex.: Briteiros: 0,004 km²), não uma freguesia
)


def parish_area_km2(geometry_json: str) -> float | None:
    """Área geodésica da freguesia (km², 3 casas) a partir do contorno do OpenStreetMap; None se não for fiável."""
    area = geometry_area_km2(json.loads(geometry_json)) if geometry_json else None
    return round(area, 3) if area is not None and area >= MIN_PLAUSIBLE_PARISH_KM2 else None


async def seed(db: AsyncSession, data_dir: Path) -> dict[str, int]:
    counts: dict[str, int] = {}

    # --- Fontes -------------------------------------------------------------------------------------------
    manifest = json.loads((data_dir / "sources.json").read_text(encoding="utf-8"))
    source_rows = [
        {
            **{k: v for k, v in m.items() if k not in {"received_on", "period_start", "period_end"}},
            "received_on": _date(m.get("received_on")),
            "period_start": _date(m.get("period_start")),
            "period_end": _date(m.get("period_end")),
            "imported_at": datetime.now(UTC),
        }
        for m in manifest
    ]
    sources = await _upsert(
        db,
        DataSource,
        source_rows,
        ["key"],
        [
            "title",
            "provider",
            "file_name",
            "file_sha256",
            "received_on",
            "period_start",
            "period_end",
            "notes",
            "imported_at",
        ],
    )
    textile_src, circuits_src = sources[(TEXTILE_SOURCE,)], sources[(CIRCUITS_SOURCE,)]

    # --- Têxtil ---------------------------------------------------------------------------------------------
    flows = _read(data_dir, "textile_flows.csv")
    entities = await _upsert(
        db, TextileEntity, [{"name": n} for n in sorted({f["entity"] for f in flows})], ["name"], ["name"]
    )
    flow_rows = [
        {
            "entity_id": entities[(f["entity"],)],
            "source_id": textile_src,
            "year": int(f["year"]),
            "destination": f["destination"],
            "tonnes": f["tonnes"],
            "method": f["method"],
            "provenance": f["provenance"],
        }
        for f in flows
    ]
    await _upsert(
        db,
        TextileFlow,
        flow_rows,
        ["entity_id", "year", "destination"],
        ["tonnes", "method", "provenance", "source_id"],
    )
    counts["textile_flows"] = len(flow_rows)

    waste = [
        {"source_id": textile_src, "scope": r["scope"], "category": r["category_key"], "share_pct": r["share_pct"]}
        for r in _read(data_dir, "waste_composition.csv")
    ]
    await _upsert(db, WasteShare, waste, ["scope", "category"], ["share_pct", "source_id"])
    counts["waste_shares"] = len(waste)

    # --- Rede de recolha --------------------------------------------------------------------------------------
    circuits = _read(data_dir, "circuits.csv")
    locality_names = sorted({n for c in circuits for n in c["localities"].split("; ") if n})
    locality_ids = await _upsert(db, Locality, [{"name": n} for n in locality_names], ["name"], ["name"])
    counts["localities"] = len(locality_names)

    vehicle_ids = await _upsert(
        db,
        Vehicle,
        [{"plate": v["plate"], "note": v["note"] or None} for v in _read(data_dir, "vehicles.csv")],
        ["plate"],
        ["note"],
    )
    counts["vehicles"] = len(vehicle_ids)

    circuit_rows = [
        {
            "code": c["circuit"],
            "typology": c["typology_key"],
            "collection_type": c["collection_key"],
            "status": c["status_key"],
            "days_text": c["days_text"],
            "note": c["note"] or None,
            "source_id": circuits_src,
        }
        for c in circuits
    ]
    circuit_ids = await _upsert(
        db, Circuit, circuit_rows, ["code"], ["typology", "collection_type", "status", "days_text", "note", "source_id"]
    )
    counts["circuits"] = len(circuit_rows)

    ids = list(circuit_ids.values())
    await db.execute(delete(CircuitDay).where(CircuitDay.circuit_id.in_(ids)))
    await db.execute(delete(CircuitLocality).where(CircuitLocality.circuit_id.in_(ids)))
    # Conjuntos: o mesmo lugar pode aparecer duas vezes na mesma linha do Excel.
    db.add_all(
        CircuitDay(circuit_id=circuit_ids[(c["circuit"],)], weekday=d)
        for c in circuits
        for d in sorted({int(x) for x in c["days"].split()})
    )
    db.add_all(
        CircuitLocality(circuit_id=circuit_ids[(c["circuit"],)], locality_id=locality_ids[(n,)])
        for c in circuits
        for n in sorted({x for x in c["localities"].split("; ") if x})
    )

    # Retrato do planeamento: substitui os turnos desta fonte.
    await db.execute(delete(ShiftAssignment).where(ShiftAssignment.source_id == circuits_src))
    shifts = _read(data_dir, "shifts.csv")
    db.add_all(
        ShiftAssignment(
            source_id=circuits_src,
            day_group=s["day_group"],
            shift=s["shift"],
            typology=s["typology_key"],
            collection_type=s["collection_key"],
            circuit_id=None if s["circuit"] == NO_CIRCUIT else circuit_ids.get((s["circuit"],)),
            circuit_label=s["circuit"],
            vehicle_id=vehicle_ids[(s["plate"],)],
            crew_size=int(s["crew"]),
            note=s["note"] or None,
        )
        for s in shifts
    )
    counts["shift_assignments"] = len(shifts)

    capacity = [
        {"source_id": circuits_src, "typology": r["typology"], "vehicles": int(r["vehicles"]), "crew": int(r["crew"])}
        for r in _read(data_dir, "fleet_capacity.csv")
    ]
    await _upsert(db, FleetCapacity, capacity, ["source_id", "typology"], ["vehicles", "crew"])

    # --- Geografia (dados públicos: INE e OpenStreetMap) -------------------------------------------------------
    if (data_dir / "parishes.csv").exists() and (GEO_SOURCES[0],) in sources:
        parish_rows = [
            {
                "dicofre": r["dicofre"],
                "name": r["name"],
                "population": int(r["population"]),
                "population_year": int(r["population_year"]),
                "tipau": r.get("tipau") or None,
                "latitude": r["latitude"],
                "longitude": r["longitude"],
                "geometry": json.loads(r["geometry"]) if r["geometry"] else None,
                "area_km2": parish_area_km2(r["geometry"]),
                "source_id": sources[(GEO_SOURCES[0],)],
            }
            for r in _read(data_dir, "parishes.csv")
        ]
        parish_ids = await _upsert(
            db,
            Parish,
            parish_rows,
            ["dicofre"],
            [
                "name",
                "population",
                "population_year",
                "tipau",
                "latitude",
                "longitude",
                "geometry",
                "area_km2",
                "source_id",
            ],
        )
        counts["parishes"] = len(parish_rows)
        for r in _read(data_dir, "localities_geo.csv"):
            if not r["latitude"]:
                continue
            await db.execute(
                update(Locality)
                .where(Locality.name == r["locality"])
                .values(
                    latitude=r["latitude"],
                    longitude=r["longitude"],
                    parish_id=parish_ids.get((r["dicofre"],)) if r["dicofre"] else None,
                )
            )

    # --- Contentores (opcional: só depois de a Vitrus enviar as localizações) ------------------------------------
    if (CONTAINERS_SOURCE,) in sources and (data_dir / "containers.csv").exists():
        counts.update(await import_containers(db, data_dir, sources[(CONTAINERS_SOURCE,)]))

    # --- Rede MUNICIPAL (outras frações; tabelas próprias, nunca misturada com os têxteis) ---------------------
    if (MUNICIPAL_SOURCE,) in sources and municipal_importer.has_package(data_dir):
        counts.update(await municipal_importer.import_municipal(db, data_dir, sources[(MUNICIPAL_SOURCE,)]))

    # --- Pressupostos do simulador (conjunto ativo; nunca sobrescreve os editados) -------------------------------
    await ensure_default_parameters(db)

    # --- Alertas de qualidade (o estado de resolução não é tocado) ----------------------------------------------
    alerts = [
        {
            "source_id": circuits_src,
            "number": int(a["id"]),
            "kind": a["type_key"],
            "detail": a["detail"],
            "suggestion": a["suggestion"],
        }
        for a in _read(data_dir, "data_alerts.csv")
    ]
    await _upsert(db, DataAlert, alerts, ["source_id", "number"], ["kind", "detail", "suggestion"])
    counts["data_alerts"] = len(alerts)

    await db.commit()
    log.info("seed concluído: %s", counts)
    return counts


def _norm(text: str) -> str:
    plain = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    return " ".join("".join(ch if ch.isalnum() else " " for ch in plain.lower()).split())


async def import_containers(db: AsyncSession, data_dir: Path, source_id: uuid.UUID) -> dict[str, int]:
    """containers.csv -> tabela `containers`. Idempotente: upsert por (fonte, referência); remove o que saiu.

    Só entram linhas com coordenadas; as pendentes (só morada) ficam no CSV e no alerta de qualidade.
    A freguesia vem do polígono que contém o ponto (ou, se não cair em nenhum, do nome indicado no ficheiro).
    """
    rows = [r for r in _read(data_dir, "containers.csv") if r["coord_status"] == "ok"]
    parishes = (await db.execute(select(Parish.id, Parish.name, Parish.geometry))).all()
    parish_by_name = {_norm(name): pid for pid, name, _ in parishes}
    locality_by_name = {_norm(n): i for i, n in (await db.execute(select(Locality.id, Locality.name))).all()}
    operator_by_name = {_norm(n): i for i, n in (await db.execute(select(TextileEntity.id, TextileEntity.name))).all()}

    def parish_of(lat: float, lon: float, name: str) -> uuid.UUID | None:
        for pid, _, geometry in parishes:
            if geometry and point_in_geometry(lat, lon, geometry):
                return pid  # type: ignore[no-any-return]
        return parish_by_name.get(_norm(name)) if name else None

    values = [
        {
            "source_id": source_id,
            "external_ref": r["external_ref"],
            "kind": r["kind"],
            "status": r["status"],
            "operator_id": operator_by_name.get(_norm(r["operator"])) if r["operator"] else None,
            "locality_id": locality_by_name.get(_norm(r["locality"])) if r["locality"] else None,
            "parish_id": parish_of(float(r["latitude"]), float(r["longitude"]), r["parish"]),
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "address": r["address"] or None,
            "capacity_litres": int(r["capacity_litres"]) if r["capacity_litres"] else None,
            "installed_on": _date(r["installed_on"]),
        }
        for r in rows
    ]
    update_cols = [c for c in values[0] if c not in ("source_id", "external_ref")] if values else []
    for i in range(0, len(values), 500):
        await _upsert(db, Container, values[i : i + 500], ["source_id", "external_ref"], update_cols)
    await db.execute(
        delete(Container).where(
            Container.source_id == source_id, Container.external_ref.not_in([v["external_ref"] for v in values])
        )
    )

    alerts = [
        {
            "source_id": source_id,
            "number": int(a["id"]),
            "kind": a["type_key"],
            "detail": a["detail"],
            "suggestion": a["suggestion"],
        }
        for a in _read(data_dir, "containers_alerts.csv")
    ]
    await _upsert(db, DataAlert, alerts, ["source_id", "number"], ["kind", "detail", "suggestion"])
    await db.execute(
        delete(DataAlert).where(
            DataAlert.source_id == source_id, DataAlert.number.not_in([a["number"] for a in alerts])
        )
    )
    return {"containers": len(values), "container_alerts": len(alerts)}


async def is_seeded(db: AsyncSession) -> bool:
    return (await db.execute(select(DataSource.id).limit(1))).first() is not None
