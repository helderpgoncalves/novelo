"""Importa data/processed/ (gerado por `just etl`) para a base de dados. Idempotente: pode correr sempre.

- Dados de referência (entidades, fluxos, circuitos, viaturas...) fazem upsert pela chave natural.
- Os turnos são um retrato do planeamento: substituem-se por completo por fonte.
- O estado dos alertas de dados (aberto/resolvido) nunca é sobrescrito por um novo import.
"""

import csv
import json
import logging
import uuid
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.datasets.models import DataAlert, DataSource
from novelo.features.network.models import (
    Circuit,
    CircuitDay,
    CircuitLocality,
    FleetCapacity,
    Locality,
    ShiftAssignment,
    Vehicle,
)
from novelo.features.textile.models import TextileEntity, TextileFlow, WasteShare

log = logging.getLogger(__name__)

TEXTILE_SOURCE = "vitrus_textile_2025"
CIRCUITS_SOURCE = "vitrus_circuits_2026_09"
NO_CIRCUIT = "SEM CIRCUITO"


def _read(data_dir: Path, name: str) -> list[dict[str, str]]:
    with (data_dir / name).open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def _date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


async def _upsert(
    db: AsyncSession, model: Any, rows: list[dict[str, Any]], keys: list[str], update: list[str]
) -> dict[tuple[Any, ...], uuid.UUID]:
    """INSERT .. ON CONFLICT DO UPDATE; devolve {chave natural: id}."""
    if not rows:
        return {}
    stmt = insert(model).values(rows)
    stmt = stmt.on_conflict_do_update(index_elements=keys, set_={c: stmt.excluded[c] for c in update})
    ids = (await db.execute(stmt.returning(*(getattr(model, k) for k in keys), model.id))).all()
    return {tuple(r[:-1]): r[-1] for r in ids}


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


async def is_seeded(db: AsyncSession) -> bool:
    return (await db.execute(select(DataSource.id).limit(1))).first() is not None
