"""Lê os ficheiros de data/processed/ (gerados por `just etl`) e calcula o ponto de partida."""

import csv
import json
from functools import lru_cache
from pathlib import Path

from novelo.core.config import get_settings
from novelo.domain.demand import Baseline
from novelo.features.baseline.schemas import (
    Circuit,
    CircuitsSummary,
    EntityBaseline,
    FlowLink,
    FlowNode,
    Flows,
    TextileBaseline,
    WasteComposition,
    WasteShare,
)

POPULATION = 156_277
KG_PER_INHAB_MONTH_PLAN = 0.7


def _rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


@lru_cache
def _entities(data_dir: Path) -> tuple[EntityBaseline, ...]:
    return tuple(
        EntityBaseline(
            entity=r["entity"],
            total_t=float(r["total_t"]),
            reuse_t=float(r["reuse_t"]),
            recycle_t=float(r["recycle_t"]),
            reject_t=float(r["reject_t"]),
            reuse_pct=float(r["reuse_pct"]),
            recycle_pct=float(r["recycle_pct"]),
            reject_pct=float(r["reject_pct"]),
            source=r["source"],
            exact_weights=r["exact_weights"] == "True",
        )
        for r in _rows(data_dir / "textile_baseline_2025.csv")
    )


def get_textile_baseline() -> TextileBaseline:
    entities = list(_entities(get_settings().data_dir))
    total = sum(e.total_t for e in entities)
    base = Baseline(total, POPULATION, KG_PER_INHAB_MONTH_PLAN)
    return TextileBaseline(
        population=POPULATION,
        entities=entities,
        total_t=round(total, 3),
        reuse_t=round(sum(e.reuse_t for e in entities), 3),
        recycle_t=round(sum(e.recycle_t for e in entities), 3),
        reject_t=round(sum(e.reject_t for e in entities), 3),
        kg_per_inhab_month=round(base.observed_kg_per_inhab_month, 3),
        estimated_demand_t=round(base.demand_t, 1),
        capture_of_demand_pct=round(base.observed_capture_rate * 100, 1),
        gap_t=round(base.demand_t - total, 1),
    )


def get_circuits() -> CircuitsSummary:
    data_dir = get_settings().data_dir
    circuits = [
        Circuit(
            typology=r["typology"],
            circuit=r["circuit"],
            collection_type=r["collection_type"],
            localities=[x for x in r["localities"].split("; ") if x],
            days=r["days"],
            status=r["status"],
            note=r["note"],
        )
        for r in _rows(data_dir / "circuits.csv")
    ]
    summary = json.loads((data_dir / "summary.json").read_text(encoding="utf-8"))["circuits"]
    return CircuitsSummary(
        circuits=circuits,
        total=len(circuits),
        without_vehicle=summary["circuits_without_vehicle"],
        vehicles=summary["vehicles"],
        vehicles_never_assigned=summary["vehicles_never_assigned"],
        localities=summary["localities"],
    )


def get_observed_flows() -> Flows:
    """Fluxo observado em 2025: entidade → destino, em toneladas (dados reais da Vitrus)."""
    nodes = [
        FlowNode(id="reuse", label="Reutilização / doação", column=1),
        FlowNode(id="recycle", label="Reciclagem", column=1),
        FlowNode(id="reject", label="Aterro / rejeito", column=1),
    ]
    links: list[FlowLink] = []
    for e in _entities(get_settings().data_dir):
        nodes.append(FlowNode(id=e.entity, label=e.entity, column=0))
        links += [
            FlowLink(source=e.entity, target="reuse", tonnes=e.reuse_t),
            FlowLink(source=e.entity, target="recycle", tonnes=e.recycle_t),
            FlowLink(source=e.entity, target="reject", tonnes=e.reject_t),
        ]
    return Flows(observed=True, nodes=nodes, links=links)


def get_waste_composition() -> WasteComposition:
    rows = _rows(get_settings().data_dir / "waste_composition.csv")
    shares = [WasteShare(scope=r["scope"], category=r["category"], share_pct=float(r["share_pct"])) for r in rows]
    return WasteComposition(shares=shares, kg_per_inhab_year_pt=517)
