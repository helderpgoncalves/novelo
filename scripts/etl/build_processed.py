# /// script
# requires-python = ">=3.12"
# dependencies = ["openpyxl>=3.1"]
# ///
"""Converte os Excel recebidos da Vitrus em ficheiros limpos em data/processed/.

Uso: `just etl` (ou `uv run scripts/etl/build_processed.py`).
Os ficheiros em data/raw/ nunca se editam à mão; tudo o que é derivado sai daqui.
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"

# Habitantes do concelho (Plano de Ação para a Circularidade Têxtil de Guimarães).
POPULATION = 156_277
MONTHS = 12
KG_PER_INHAB_MONTH = 0.7  # Plano de Ação: 0,7 kg/hab/mês de têxtil no indiferenciado

CIRCUIT_SHEETS = ["Orgânicos", "Indiferenciados", "Recicláveis", "Volumosos", "Outros serviços"]


def _clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value)).strip() if value is not None else ""


def _write_csv(name: str, rows: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / name).open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def textile_baseline() -> dict:
    ws = openpyxl.load_workbook(RAW / "dados_textil.xlsx", data_only=True)["têxtil"]
    rows = []
    for entity, total, reuse, recycle, reject, source, *_ in ws.iter_rows(min_row=4, values_only=True):
        if not entity or str(entity).startswith(("TOTAL", "%")):
            continue
        rows.append(
            {
                "entity": entity,
                "total_t": round(total, 4),
                "reuse_t": round(reuse, 4),
                "recycle_t": round(recycle, 4),
                "reject_t": round(reject, 4),
                "reuse_pct": round(reuse / total * 100, 1),
                "recycle_pct": round(recycle / total * 100, 1),
                "reject_pct": round(reject / total * 100, 1),
                "source": _clean(source),
                "exact_weights": "kg exatos" in (source or ""),
            }
        )
    _write_csv("textile_baseline_2025.csv", rows)

    total = sum(r["total_t"] for r in rows)
    demand_t = POPULATION * KG_PER_INHAB_MONTH * MONTHS / 1000
    return {
        "total_t": round(total, 3),
        "reuse_t": round(sum(r["reuse_t"] for r in rows), 3),
        "recycle_t": round(sum(r["recycle_t"] for r in rows), 3),
        "reject_t": round(sum(r["reject_t"] for r in rows), 3),
        "kg_per_inhab_month": round(total * 1000 / POPULATION / MONTHS, 3),
        "estimated_demand_t": round(demand_t, 1),
        "capture_of_demand_pct": round(total / demand_t * 100, 1),
        "gap_t": round(demand_t - total, 1),
    }


def waste_composition() -> None:
    """Composição dos RSU: colunas L:M da folha RSU, Europa primeiro e Portugal a seguir."""
    ws = openpyxl.load_workbook(RAW / "dados_textil.xlsx", data_only=True)["RSU"]
    rows: list[dict] = []
    scope = "Europa"
    for row in ws.iter_rows(min_row=3, values_only=True):
        label, value = _clean(row[11]).replace("Biorrsesíduos", "Biorresíduos"), row[12]
        if not label or not isinstance(value, (int, float)):
            continue
        if label == "Biorresíduos" and rows:  # a segunda tabela (Portugal) recomeça em Biorresíduos
            scope = "Portugal"
        rows.append({"scope": scope, "category": label.replace("Compositos", "Compósitos"), "share_pct": value})
    _write_csv("waste_composition.csv", rows)


def circuits() -> dict:
    wb = openpyxl.load_workbook(RAW / "Circuitos_Viaturas_Guimaraes.xlsx", data_only=True)

    circuit_rows = []
    for sheet in CIRCUIT_SHEETS:
        for row in wb[sheet].iter_rows(min_row=5, values_only=True):
            typology, circuit, kind, places, days, *_rest, status, note = row[:1] + row[1:5] + row[5:13] + row[13:15]
            if not circuit or circuit == "SEM CIRCUITO":
                continue
            localities = [p.strip() for p in re.split(r"[\n,]| e ", str(places or "")) if p.strip()]
            circuit_rows.append(
                {
                    "typology": typology,
                    "circuit": circuit,
                    "collection_type": kind or "",
                    "localities": "; ".join(localities),
                    "days": _clean(days),
                    "status": status or "",
                    "note": _clean(note),
                }
            )
    _write_csv("circuits.csv", circuit_rows)

    shifts = []
    ws = wb["Base_Dados"]
    for row in list(ws.iter_rows(values_only=True))[1:]:
        day, shift, circuit, typology, plate, crew, kind, places, written, sheet, note = row[:11]
        if not circuit:
            continue
        shifts.append(
            {
                "day": day,
                "shift": shift,
                "circuit": circuit,
                "typology": typology,
                "plate": plate,
                "crew": crew or 0,
                "collection_type": kind or "",
                "localities": _clean(places),
                "note": _clean(note),
            }
        )
    _write_csv("shifts.csv", shifts)

    alerts = []
    for row in list(wb["Alertas"].iter_rows(min_row=4, values_only=True)):
        if row[0]:
            alerts.append({"id": row[0], "type": row[1], "detail": _clean(row[2]), "suggestion": _clean(row[3])})
    _write_csv("data_alerts.csv", alerts)

    plates = {s["plate"] for s in shifts}
    no_circuit = {s["plate"] for s in shifts if s["circuit"] == "SEM CIRCUITO"}
    with_circuit = {s["plate"] for s in shifts if s["circuit"] != "SEM CIRCUITO"}
    fixed_kinds = {"Moloks", "PAP", "Contentores"}
    return {
        "circuits": len(circuit_rows),
        "circuits_without_vehicle": sum(1 for c in circuit_rows if c["status"] == "Sem viatura atribuída"),
        "vehicles": len(plates),
        "vehicles_never_assigned": sorted(no_circuit - with_circuit),
        "shifts": len(shifts),
        "crew_shifts_all_days": sum(int(s["crew"]) for s in shifts),
        "circuits_by_kind": {
            k: sum(1 for c in circuit_rows if c["collection_type"] == k) for k in sorted(fixed_kinds)
        },
        "localities": sorted(
            {loc for c in circuit_rows for loc in c["localities"].split("; ") if loc}
        ),
    }


def main() -> None:
    summary = {"textile": textile_baseline(), "circuits": circuits()}
    waste_composition()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in summary.items() if k != "circuits"}, ensure_ascii=False, indent=2))
    c = summary["circuits"]
    print({k: v for k, v in c.items() if k != "localities"}, "localidades:", len(c["localities"]))


if __name__ == "__main__":
    main()
