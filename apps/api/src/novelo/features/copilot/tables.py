"""Motor determinístico de consulta a tabelas e textos anexados: o modelo pede, isto calcula (nunca o modelo)."""

import re
import unicodedata
from collections import Counter
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

MAX_RESULT_ROWS = 20

Op = Literal["eq", "ne", "gt", "ge", "lt", "le", "contains", "in"]
Agg = Literal["count", "sum", "mean", "min", "max", "distinct"]


class Condition(BaseModel):
    model_config = ConfigDict(extra="forbid")
    column: str = Field(max_length=80)
    op: Op
    value: str | float | list[str] = Field(description="Número, texto ou lista (op `in`)")


class AnalyzeArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    attachment_id: str = Field(max_length=40)
    operation: Literal["describe", "head", "filter", "aggregate", "search"]
    columns: list[str] = Field(default_factory=list, max_length=12, description="Colunas a devolver")
    where: list[Condition] = Field(default_factory=list, max_length=5)
    agg: Agg | None = Field(default=None, description="Para operation=aggregate")
    agg_column: str | None = Field(default=None, max_length=80)
    group_by: str | None = Field(default=None, max_length=80)
    query: str | None = Field(default=None, max_length=120, description="Para operation=search (texto)")
    limit: int = Field(default=10, ge=1, le=MAX_RESULT_ROWS)


def fold(text: str) -> str:
    plain = "".join(c for c in unicodedata.normalize("NFD", text.lower()) if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", plain).strip()


def parse_number(raw: object) -> float | None:
    """Aceita 1234.5, 1 234,5, 1.234,5 e 1,234.5."""
    if isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    if not isinstance(raw, str):
        return None
    text = raw.strip().replace(" ", "").replace(" ", "").replace("€", "").replace("%", "")
    if not text or not re.fullmatch(r"[-+]?[\d.,]+", text):
        return None
    if "," in text and "." in text:
        decimal = "," if text.rfind(",") > text.rfind(".") else "."
        text = text.replace("." if decimal == "," else ",", "").replace(decimal, ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def _column_index(columns: list[str], name: str) -> int | None:
    folded = [fold(c) for c in columns]
    target = fold(name)
    if target in folded:
        return folded.index(target)
    matches = [i for i, c in enumerate(folded) if target and target in c]
    return matches[0] if len(matches) == 1 else None


def _matches(row: list[Any], idx: int, cond: Condition, numeric: bool) -> bool:
    cell = row[idx]
    if cell is None or cell == "":
        return False
    if cond.op == "contains":
        return fold(str(cond.value)) in fold(str(cell))
    if cond.op == "in":
        wanted = cond.value if isinstance(cond.value, list) else [str(cond.value)]
        return fold(str(cell)) in {fold(str(v)) for v in wanted}
    if numeric:
        left, right = parse_number(cell), parse_number(cond.value)
        if left is None or right is None:
            return False
    else:
        left, right = fold(str(cell)), fold(str(cond.value))  # type: ignore[assignment]
    return {
        "eq": left == right,
        "ne": left != right,
        "gt": left > right,  # type: ignore[operator]
        "ge": left >= right,  # type: ignore[operator]
        "lt": left < right,  # type: ignore[operator]
        "le": left <= right,  # type: ignore[operator]
    }[cond.op]


def _round(v: float) -> float:
    return round(v, 4)


def _aggregate(values: list[float], agg: Agg) -> float:
    if agg == "sum":
        return _round(sum(values))
    if agg == "mean":
        return _round(sum(values) / len(values)) if values else 0.0
    if agg == "min":
        return _round(min(values)) if values else 0.0
    if agg == "max":
        return _round(max(values)) if values else 0.0
    return float(len(values))


def analyze_table(data: dict[str, Any], args: AnalyzeArgs) -> dict[str, Any]:
    columns: list[str] = data["columns"]
    types: list[str] = data["types"]
    rows: list[list[Any]] = data["rows"]
    if args.operation == "describe":
        return {"rows": len(rows), "columns": [{"name": c, "type": t} for c, t in zip(columns, types, strict=True)]}
    wanted = []
    for name in args.columns:
        i = _column_index(columns, name)
        if i is None:
            return {"error": "unknown_column", "message": f"No column matches '{name}'", "columns": columns}
        wanted.append(i)
    selected = rows
    for cond in args.where:
        i = _column_index(columns, cond.column)
        if i is None:
            return {"error": "unknown_column", "message": f"No column matches '{cond.column}'", "columns": columns}
        selected = [r for r in selected if _matches(r, i, cond, types[i] == "number")]
    if args.operation in {"head", "filter"}:
        picked = wanted or list(range(len(columns)))
        shown = selected[: args.limit]
        return {
            "matching_rows": len(selected),
            "columns": [columns[i] for i in picked],
            "rows": [[r[i] for i in picked] for r in shown],
            "truncated": len(selected) > len(shown),
        }
    return _aggregate_rows(columns, types, selected, args)


def _aggregate_rows(
    columns: list[str], types: list[str], selected: list[list[Any]], args: AnalyzeArgs
) -> dict[str, Any]:
    agg: Agg = args.agg or "count"
    value_idx = None
    if args.agg_column:
        value_idx = _column_index(columns, args.agg_column)
        if value_idx is None:
            return {"error": "unknown_column", "message": f"No column matches '{args.agg_column}'", "columns": columns}
    if agg not in {"count", "distinct"} and (value_idx is None or types[value_idx] != "number"):
        return {"error": "not_numeric", "message": f"{agg} needs a numeric agg_column", "columns": columns}

    def measure(rows: list[list[Any]]) -> float:
        if value_idx is None:
            return float(len(rows))
        cells = [r[value_idx] for r in rows if r[value_idx] not in (None, "")]
        if agg == "distinct":
            return float(len({str(c) for c in cells}))
        if agg == "count":
            return float(len(cells))
        return _aggregate([float(c) for c in cells if isinstance(c, (int, float))], agg)

    if args.group_by:
        g = _column_index(columns, args.group_by)
        if g is None:
            return {"error": "unknown_column", "message": f"No column matches '{args.group_by}'", "columns": columns}
        buckets: dict[str, list[list[Any]]] = {}
        for r in selected:
            buckets.setdefault(str(r[g]), []).append(r)
        groups = sorted(((k, measure(v)) for k, v in buckets.items()), key=lambda kv: -kv[1])
        return {
            "agg": agg,
            "matching_rows": len(selected),
            "groups_total": len(groups),
            "groups": [{"group": k, "value": v} for k, v in groups[: args.limit]],
        }
    return {"agg": agg, "agg_column": args.agg_column, "matching_rows": len(selected), "value": measure(selected)}


def search_text(text: str, query: str, limit: int) -> dict[str, Any]:
    needle = fold(query)
    hits = [
        {"line": n, "text": line.strip()[:240]}
        for n, line in enumerate(text.splitlines(), start=1)
        if needle and needle in fold(line)
    ]
    return {"matches": len(hits), "lines": hits[:limit], "truncated": len(hits) > limit}


def column_stats(columns: list[str], types: list[str], rows: list[list[Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i, (name, kind) in enumerate(zip(columns, types, strict=True)):
        cells = [r[i] for r in rows if r[i] not in (None, "")]
        info: dict[str, Any] = {"name": name, "type": kind, "filled": len(cells), "missing": len(rows) - len(cells)}
        if kind == "number" and cells:
            nums = [float(c) for c in cells]
            info |= {
                "min": _round(min(nums)),
                "max": _round(max(nums)),
                "mean": _round(sum(nums) / len(nums)),
                "sum": _round(sum(nums)),
            }
        elif cells:
            counts = Counter(str(c) for c in cells)
            info |= {"distinct": len(counts), "top": [{"value": v, "count": n} for v, n in counts.most_common(5)]}
        out.append(info)
    return out
