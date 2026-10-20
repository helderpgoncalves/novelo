"""Constrói a especificação de cada artefacto a partir de uma tabela de resultados REAL (nunca de números do modelo)."""

from collections.abc import Sequence
from typing import Any

from pydantic import TypeAdapter, ValidationError

from novelo.features.copilot.schemas_artifacts import (
    Artifact,
    ChartSpec,
    ComparisonSpec,
    KpiItem,
    KpisSpec,
    MapSpec,
    TableSpec,
    TimelineSpec,
)

_CHART = TypeAdapter(ChartSpec)
_ARTIFACT = TypeAdapter(Artifact)
NUMERIC = {"number", "percent", "currency"}


class ArtifactError(ValueError):
    """Pedido de artefacto inválido: a mensagem (e as colunas disponíveis) voltam ao modelo para ele corrigir."""

    def __init__(self, message: str, columns: list[str] | None = None) -> None:
        super().__init__(message)
        self.message, self.columns = message, columns or []


def validate_artifact(artifact_type: str, spec: dict[str, Any]) -> Any:
    try:
        return _ARTIFACT.validate_python({"artifact_type": artifact_type, "spec": spec})
    except ValidationError as exc:
        raise ArtifactError("The generated spec is invalid: " + exc.errors()[0]["msg"]) from exc


def _cols(table: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {c["key"]: c for c in table["columns"]}


def _need(
    table: dict[str, Any], keys: list[str | None], numeric: list[str | None] | None = None
) -> dict[str, dict[str, Any]]:
    cols = _cols(table)
    for k in keys:
        if k and k not in cols:
            raise ArtifactError(f"Unknown column '{k}'", list(cols))
    for k in numeric or []:
        if k and cols[k]["type"] not in NUMERIC:
            raise ArtifactError(f"Column '{k}' is not numeric", [c for c, m in cols.items() if m["type"] in NUMERIC])
    return cols


def _num(v: Any) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _x(v: Any) -> float | str:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else str(v)


_Cols = dict[str, dict[str, Any]]


def _unit(cols: _Cols, k: str | None) -> str | None:
    return cols[k].get("unit") if k else None


def _name(cols: _Cols, k: str | None) -> str:
    return str(cols[k]["label"]) if k else ""


def _cartesian(
    rows: list[dict[str, Any]],
    cols: _Cols,
    kind: str,
    x: str | None,
    y: list[str],
    series: str | None,
    label: str | None,
    size: str | None,
) -> dict[str, Any]:
    if not x or not y:
        raise ArtifactError("x and at least one y column are required")
    if kind == "pie" and (len(y) != 1 or series):
        raise ArtifactError("pie needs x (slice name) and exactly one y column, without series")
    if kind in {"scatter", "pareto"} and cols[x]["type"] not in NUMERIC:
        raise ArtifactError(f"{kind} needs a numeric x column", [c for c, m in cols.items() if m["type"] in NUMERIC])
    if series and len(y) == 1:
        groups: dict[str, list[dict[str, Any]]] = {}
        for r in rows:
            groups.setdefault(str(r.get(series)), []).append(r)
        built = [(g, y[0], rs) for g, rs in groups.items()]
    else:
        built = [(_name(cols, k), k, rows) for k in y]
    out_series = [
        {"name": g, "unit": _unit(cols, k), "points": [{"x": _x(r.get(x)), "y": _num(r.get(k)), "label": str(r[label]) if label and r.get(label) is not None else None,
                                                          "size": _num(r.get(size)) if size else None} for r in rs]}
        for g, k, rs in built
    ]  # fmt: skip
    if kind == "pie" and any((_num(r.get(k)) or 0) < 0 for _, k, rs in built for r in rs):
        raise ArtifactError("pie slices must be positive: use a bar chart for values that can be negative")
    return {
        "kind": kind, "x_label": _name(cols, x), "y_label": _name(cols, y[0]) if len(y) == 1 else "", "x_unit": _unit(cols, x),
        "y_unit": _unit(cols, y[0]) if len(y) == 1 else None, "series": out_series,
        "highlight": [str(r.get(label or "") or r.get(x or "")) for r in rows if r.get("frontier") == "sim"],
    }  # fmt: skip


def _special(
    rows: list[dict[str, Any]], cols: _Cols, kind: str, x: str | None, y: list[str], series: str | None
) -> dict[str, Any]:
    unit = _unit(cols, y[0]) if y else None
    if kind == "waterfall":
        if not x or len(y) != 1:
            raise ArtifactError("waterfall needs x (label) and one y (value)")
        last = len(rows) - 1
        steps = [
            {
                "label": str(r.get(x)),
                "value": _num(r.get(y[0])) or 0.0,
                "kind": "total" if i == last and r.get("step_kind") == "total" else "delta",
            }
            for i, r in enumerate(rows)
        ]
        return {"kind": kind, "unit": unit, "steps": steps}
    if kind == "sankey":
        if not x or not series or len(y) != 1:
            raise ArtifactError("sankey needs x (source), series (target) and one y (value)")
        ids = list(dict.fromkeys([str(r[x]) for r in rows] + [str(r[series]) for r in rows]))
        links = [
            {"source": str(r[x]), "target": str(r[series]), "value": _num(r.get(y[0])) or 0.0}
            for r in rows
            if (_num(r.get(y[0])) or 0) > 0
        ]
        return {"kind": kind, "unit": unit, "nodes": [{"id": i, "label": i} for i in ids], "links": links}
    if kind == "treemap":
        if not x or len(y) != 1:
            raise ArtifactError("treemap needs x (name), one y (value) and optionally series (parent)")
        items = [
            {
                "name": str(r.get(x)),
                "parent": str(r[series]) if series and r.get(series) else None,
                "value": _num(r.get(y[0])) or 0.0,
            }
            for r in rows
        ]
        return {"kind": kind, "unit": unit, "items": items}
    if kind == "heatmap":
        if not x or not series or len(y) != 1:
            raise ArtifactError("heatmap needs x, series (the y categories) and one y (value)")
        cells = [{"x": str(r[x]), "y": str(r[series]), "value": _num(r.get(y[0])) or 0.0} for r in rows]
        return {
            "kind": kind,
            "unit": unit,
            "x_categories": list(dict.fromkeys(c["x"] for c in cells)),
            "y_categories": list(dict.fromkeys(c["y"] for c in cells)),
            "cells": cells,
        }
    if kind in {"tornado", "range"}:
        if not x or len(y) != 3:
            raise ArtifactError(
                f"{kind} needs x (label) and 3 y columns ({'low, high, base' if kind == 'tornado' else 'p10, p50, p90'})"
            )
        k = ("low", "high", "base") if kind == "tornado" else ("p10", "p50", "p90")
        key = "bars" if kind == "tornado" else "items"
        return {
            "kind": kind,
            "unit": unit,
            key: [{"label": str(r.get(x)), **{k[i]: _num(r.get(y[i])) or 0.0 for i in range(3)}} for r in rows],
        }
    if len(y) != 1:
        raise ArtifactError("gauge needs exactly one y column")
    v = _num(rows[0].get(y[0])) or 0.0
    top = 100.0 if cols[y[0]]["type"] == "percent" else max(v * 1.5, 1.0)
    return {"kind": "gauge", "unit": unit, "value": v, "min": 0.0, "max": top, "target": None}


def build_chart(
    table: dict[str, Any],
    kind: str,
    x: str | None,
    y: list[str],
    series: str | None,
    label: str | None,
    size: str | None,
    title: str,
) -> Any:
    rows: list[dict[str, Any]] = table["rows"]
    if not rows:
        raise ArtifactError("The result has no rows to draw")
    cols = _need(table, [x, *y, series, label, size], numeric=list(y))
    base = {"title": title, "source": table["source"], "estimate": bool(table.get("estimate"))}
    if kind in {"bar", "stacked_bar", "line", "area", "scatter", "pareto", "pie"}:
        spec = {**base, **_cartesian(rows, cols, kind, x, y, series, label, size)}
    else:
        spec = {**base, **_special(rows, cols, kind, x, y, series)}
    try:
        return _CHART.validate_python(spec)
    except ValidationError as exc:
        raise ArtifactError("The chart could not be built: " + exc.errors()[0]["msg"]) from exc


def build_table(
    table: dict[str, Any], columns: list[str], sort_by: str | None, sort_dir: str, limit: int, title: str
) -> TableSpec:
    cols = _need(table, [*columns, sort_by])
    keys = columns or list(cols)
    rows = list(table["rows"])
    if sort_by:
        present = [r for r in rows if r.get(sort_by) is not None]
        missing = [r for r in rows if r.get(sort_by) is None]
        present.sort(
            key=lambda r: str(r[sort_by]) if not isinstance(r[sort_by], (int, float)) else r[sort_by],
            reverse=sort_dir == "desc",
        )
        rows = present + missing
    shown = [
        {k: (r.get(k) if isinstance(r.get(k), (int, float, str)) or r.get(k) is None else str(r.get(k))) for k in keys}
        for r in rows[:limit]
    ]
    return TableSpec(
        title=title, source=table["source"], estimate=bool(table.get("estimate")),
        columns=[{"key": k, "label": cols[k]["label"], "type": cols[k]["type"], "unit": cols[k].get("unit")} for k in keys],
        rows=shown, total_rows=len(table["rows"]), sort_by=sort_by, sort_dir="asc" if sort_dir == "asc" else "desc",
    )  # fmt: skip


def build_map(layers: list[dict[str, Any]], tables: dict[str, dict[str, Any]], title: str) -> MapSpec:
    out = []
    source = ""
    estimate = False
    for lay in layers:
        table = tables[lay["result_id"]]
        cols = _need(
            table,
            [
                lay.get("label_col"),
                lay.get("value_col"),
                lay.get("code_col"),
                lay.get("lat_col", "lat"),
                lay.get("lon_col", "lon"),
            ],
        )
        source, estimate = table["source"], estimate or bool(table.get("estimate"))
        lat, lon = lay.get("lat_col", "lat"), lay.get("lon_col", "lon")
        items = [
            {"code": str(r.get(lay.get("code_col") or lay["label_col"])), "label": str(r.get(lay["label_col"])),
             "value": _num(r.get(lay["value_col"])) if lay.get("value_col") else None, "lat": _num(r.get(lat)), "lon": _num(r.get(lon)),
             "detail": str(r[lay["detail_col"]]) if lay.get("detail_col") and r.get(lay["detail_col"]) is not None else None}
            for r in table["rows"]
        ]  # fmt: skip
        vc = lay.get("value_col")
        out.append(
            {
                "kind": lay["kind"],
                "label": table["title"],
                "metric": cols[vc]["label"] if vc else None,
                "unit": cols[vc].get("unit") if vc else None,
                "items": items,
            }
        )
    return MapSpec.model_validate({"title": title, "source": source, "estimate": estimate, "layers": out})


def build_kpis(table: dict[str, Any], keys: Sequence[str], title: str, row: int = 0) -> KpisSpec:
    cols = _need(table, list(keys))
    if row >= len(table["rows"]):
        raise ArtifactError("Row out of range")
    r = table["rows"][row]
    items = [KpiItem(label=cols[k]["label"], value=r.get(k), unit=cols[k].get("unit")) for k in keys]
    return KpisSpec(title=title, source=table["source"], estimate=bool(table.get("estimate")), items=items)


def build_timeline(table: dict[str, Any], at: str, label: str, detail: str | None, title: str) -> TimelineSpec:
    _need(table, [at, label, detail])
    items = [
        {
            "at": str(r.get(at)),
            "label": str(r.get(label)),
            "detail": str(r[detail]) if detail and r.get(detail) else None,
        }
        for r in table["rows"]
    ]
    return TimelineSpec.model_validate({"title": title, "source": table["source"], "items": items})


def build_comparison(table: dict[str, Any], title: str) -> ComparisonSpec:
    cols = _need(table, ["scenario_id", "label"])
    metric_keys = [k for k, c in cols.items() if c["type"] in NUMERIC]
    return ComparisonSpec.model_validate(
        {
            "title": title,
            "source": table["source"],
            "estimate": True,
            "metrics": [
                {"key": k, "label": cols[k]["label"], "type": cols[k]["type"], "unit": cols[k].get("unit")}
                for k in metric_keys
            ],
            "columns": [
                {
                    "scenario_id": r["scenario_id"],
                    "label": str(r["label"]),
                    "values": {k: r.get(k) for k in metric_keys},
                }
                for r in table["rows"]
            ],
        }
    )
