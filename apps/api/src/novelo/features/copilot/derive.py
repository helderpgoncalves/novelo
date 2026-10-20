"""Tabelas derivadas de um resultado de ferramenta: agrupar, somar, ordenar, filtrar, quota. Determinístico, sem modelo.

Serve para o copiloto desenhar gráficos de qualquer consulta: o modelo escolhe a operação e as colunas; as contas
(soma, média, percentagem do total) fazem-se aqui e o resultado volta como nova `table` com `result_id`.
Também é reaplicado no «Atualizar» de um artefacto derivado (`post` no `refresh`).
"""

from collections import defaultdict
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from novelo.features.copilot.tables import Agg, Condition, _matches, fold, parse_number

NUMERIC = {"number", "percent", "currency"}
Operation = Literal["group", "top", "filter", "share"]


class DeriveArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    result_id: str = Field(max_length=12, description="Id de um resultado anterior (r1, r2...)")
    operation: Literal["group", "top", "filter", "share"] = Field(
        description="group: agrupa por uma coluna e agrega; top: ordena e corta; filter: linhas que cumprem condições; "
        "share: acrescenta a percentagem do total de uma coluna numérica"
    )
    group_by: str | None = Field(default=None, max_length=60, description="Coluna a agrupar (operation=group)")
    agg: Agg = Field(default="sum", description="count, sum, mean, min, max ou distinct (operation=group)")
    value: str | None = Field(default=None, max_length=60, description="Coluna numérica a agregar, ordenar ou repartir")
    where: list[Condition] = Field(default_factory=list, max_length=5)
    sort_dir: Literal["asc", "desc"] = "desc"
    columns: list[str] = Field(default_factory=list, max_length=12, description="Colunas a manter (filter/top)")
    limit: int = Field(default=15, ge=1, le=50)
    title: str | None = Field(default=None, max_length=120)


class DeriveError(Exception):
    def __init__(self, message: str, columns: list[str] | None = None) -> None:
        super().__init__(message)
        self.message, self.columns = message, columns or []


def _resolve(table: dict[str, Any], name: str | None) -> str | None:
    """Chave da coluna a partir da chave, do rótulo ou de um pedaço único do rótulo (sem acentos nem maiúsculas)."""
    if name is None:
        return None
    cols = table["columns"]
    target = fold(name)
    for c in cols:
        if fold(c["key"]) == target or fold(c["label"]) == target:
            return str(c["key"])
    hits = [c for c in cols if target and (target in fold(c["key"]) or target in fold(c["label"]))]
    if len(hits) == 1:
        return str(hits[0]["key"])
    raise DeriveError(f"No column matches '{name}'", [str(c["key"]) for c in cols])


def _col(table: dict[str, Any], key: str) -> dict[str, Any]:
    return next(c for c in table["columns"] if c["key"] == key)


def _numeric(table: dict[str, Any], name: str | None, what: str) -> str:
    key = _resolve(table, name)
    if key is None or _col(table, key)["type"] not in NUMERIC:
        raise DeriveError(f"{what} needs a numeric column", [str(c["key"]) for c in table["columns"]])
    return key


def _filtered(table: dict[str, Any], where: list[Condition]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = list(table["rows"])
    for cond in where:
        key = _resolve(table, cond.column)
        assert key is not None
        numeric = _col(table, key)["type"] in NUMERIC
        rows = [r for r in rows if _matches([r.get(key)], 0, cond, numeric)]
    return rows


def _values(rows: list[dict[str, Any]], key: str) -> list[float]:
    out: list[float] = []
    for r in rows:
        n = parse_number(r.get(key))
        if n is not None:
            out.append(n)
    return out


def _reduce(values: list[float], agg: Agg) -> float:
    if agg == "sum":
        return round(sum(values), 4)
    if agg == "mean":
        return round(sum(values) / len(values), 4) if values else 0.0
    if agg == "min":
        return round(min(values), 4) if values else 0.0
    if agg == "max":
        return round(max(values), 4) if values else 0.0
    return float(len(values))


def _base(table: dict[str, Any], args: DeriveArgs, suffix: str) -> dict[str, Any]:
    return {
        "title": args.title or f"{table['title']} · {suffix}",
        "source": table["source"],
        "estimate": bool(table.get("estimate")),
    }


def derive_table(table: dict[str, Any], args: DeriveArgs) -> dict[str, Any]:
    """Nova tabela (mesmo formato `make_table`). Levanta `DeriveError` com a lista de colunas se algo não existir."""
    rows = _filtered(table, args.where)
    if args.operation == "filter":
        keys = [k for name in args.columns if (k := _resolve(table, name))] or [str(c["key"]) for c in table["columns"]]
        return {
            **_base(table, args, "filtrado"),
            "columns": [_col(table, k) for k in keys],
            "rows": [{k: r.get(k) for k in keys} for r in rows[: args.limit]],
            "total_rows": len(rows),
        }
    if args.operation == "top":
        value = _numeric(table, args.value, "top")
        present = [r for r in rows if parse_number(r.get(value)) is not None]
        present.sort(key=lambda r: parse_number(r.get(value)) or 0.0, reverse=args.sort_dir == "desc")
        keys = [k for name in args.columns if (k := _resolve(table, name))] or [str(c["key"]) for c in table["columns"]]
        return {
            **_base(table, args, "ordenado"),
            "columns": [_col(table, k) for k in keys],
            "rows": [{k: r.get(k) for k in keys} for r in present[: args.limit]],
            "total_rows": len(present),
        }
    if args.operation == "share":
        value = _numeric(table, args.value, "share")
        total = sum(_values(rows, value))
        if total == 0:
            raise DeriveError("The column sums to zero: no shares to compute")
        shown = sorted(
            (r for r in rows if parse_number(r.get(value)) is not None),
            key=lambda r: parse_number(r.get(value)) or 0.0,
            reverse=True,
        )[: args.limit]
        keys = [str(c["key"]) for c in table["columns"]]
        out_rows = [
            {**{k: r.get(k) for k in keys}, "share_pct": round((parse_number(r.get(value)) or 0.0) / total * 100, 1)}
            for r in shown
        ]
        return {
            **_base(table, args, "quota do total"),
            "columns": [*table["columns"], {"key": "share_pct", "label": "Do total", "type": "percent", "unit": "%"}],
            "rows": out_rows,
            "total_rows": len(rows),
            "total_value": round(total, 4),
        }
    # group
    group = _resolve(table, args.group_by)
    if group is None:
        raise DeriveError("group needs group_by", [str(c["key"]) for c in table["columns"]])
    if args.agg in {"count", "distinct"}:
        vcol: str | None = _resolve(table, args.value) if args.value else None
    else:
        vcol = _numeric(table, args.value, args.agg)
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        buckets[str(r.get(group))].append(r)

    def measure(bucket: list[dict[str, Any]]) -> float:
        if args.agg == "distinct" and vcol:
            return float(len({str(r.get(vcol)) for r in bucket if r.get(vcol) not in (None, "")}))
        if args.agg in {"count", "distinct"}:
            return float(len(bucket))
        assert vcol is not None
        return _reduce(_values(bucket, vcol), args.agg)

    grouped = sorted(
        ((k, measure(v)) for k, v in buckets.items()), key=lambda kv: kv[1], reverse=args.sort_dir == "desc"
    )
    unit = None if args.agg in {"count", "distinct"} or vcol is None else _col(table, vcol).get("unit")
    vtype = "number" if args.agg in {"count", "distinct"} or vcol is None else _col(table, vcol)["type"]
    label = {
        "sum": "Soma",
        "mean": "Média",
        "min": "Mínimo",
        "max": "Máximo",
        "count": "Contagem",
        "distinct": "Distintos",
    }[args.agg]
    gcol = _col(table, group)
    return {
        **_base(table, args, f"por {gcol['label'].lower()}"),
        "columns": [
            dict(gcol),
            {
                "key": "value",
                "label": label + (f" de {_col(table, vcol)['label']}" if vcol else ""),
                "type": vtype,
                "unit": unit,
            },
        ],
        "rows": [{group: k, "value": v} for k, v in grouped[: args.limit]],
        "total_rows": len(grouped),
    }
