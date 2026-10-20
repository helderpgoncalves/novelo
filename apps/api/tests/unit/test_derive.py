"""Tabelas derivadas: as contas (soma, média, quota) fazem-se no servidor, nunca no modelo."""

import pytest

from novelo.features.copilot.derive import DeriveArgs, DeriveError, derive_table
from novelo.features.copilot.tools_data import make_table

TABLE = make_table(
    "Alocações",
    "Otimizador",
    [
        ("name", "Freguesia", "text", None),
        ("mode", "Modo", "category", None),
        ("tonnes", "Captado", "number", "t/ano"),
        ("cost", "Custo", "currency", "€"),
    ],
    [
        {"name": "A", "mode": "street", "tonnes": 10.0, "cost": 100.0},
        {"name": "B", "mode": "street", "tonnes": 30.0, "cost": 300.0},
        {"name": "C", "mode": "on_demand", "tonnes": 60.0, "cost": 50.0},
    ],
    estimate=True,
)


def args(**kw: object) -> DeriveArgs:
    return DeriveArgs(result_id="r1", **kw)  # type: ignore[arg-type]


def test_group_sums_and_sorts_descending() -> None:
    out = derive_table(TABLE, args(operation="group", group_by="modo", agg="sum", value="captado"))
    assert out["rows"] == [{"mode": "on_demand", "value": 60.0}, {"mode": "street", "value": 40.0}]
    assert out["columns"][1]["unit"] == "t/ano" and out["estimate"] is True and out["source"] == "Otimizador"


def test_group_mean_count_and_distinct() -> None:
    mean = derive_table(TABLE, args(operation="group", group_by="mode", agg="mean", value="tonnes"))
    assert {r["mode"]: r["value"] for r in mean["rows"]} == {"street": 20.0, "on_demand": 60.0}
    count = derive_table(TABLE, args(operation="group", group_by="mode", agg="count"))
    assert {r["mode"]: r["value"] for r in count["rows"]} == {"street": 2.0, "on_demand": 1.0}
    assert (
        derive_table(TABLE, args(operation="group", group_by="mode", agg="distinct", value="name"))["rows"][0]["value"]
        == 2.0
    )


def test_share_adds_percent_of_total_rounded_to_one_decimal() -> None:
    out = derive_table(TABLE, args(operation="share", value="tonnes"))
    assert [r["share_pct"] for r in out["rows"]] == [60.0, 30.0, 10.0]
    assert out["total_value"] == 100.0 and out["columns"][-1]["unit"] == "%"


def test_top_and_filter() -> None:
    top = derive_table(TABLE, args(operation="top", value="cost", limit=2))
    assert [r["name"] for r in top["rows"]] == ["B", "A"]
    asc = derive_table(TABLE, args(operation="top", value="cost", sort_dir="asc", limit=1))
    assert asc["rows"][0]["name"] == "C"
    flt = derive_table(
        TABLE,
        args(operation="filter", where=[{"column": "tonnes", "op": "gt", "value": 20}], columns=["name", "tonnes"]),
    )
    assert flt["rows"] == [{"name": "B", "tonnes": 30.0}, {"name": "C", "tonnes": 60.0}]
    assert [c["key"] for c in flt["columns"]] == ["name", "tonnes"]


@pytest.mark.parametrize(
    "bad",
    [
        {"operation": "group", "group_by": "inexistente"},
        {"operation": "group", "group_by": "mode", "agg": "sum", "value": "name"},  # coluna não numérica
        {"operation": "share", "value": "mode"},
        {"operation": "group"},
    ],
)
def test_bad_columns_come_back_with_the_available_ones(bad: dict[str, object]) -> None:
    with pytest.raises(DeriveError) as exc:
        derive_table(TABLE, args(**bad))
    assert "tonnes" in exc.value.columns


def test_share_of_zero_total_is_refused() -> None:
    zero = make_table("Z", "S", [("n", "N", "text", None), ("v", "V", "number", None)], [{"n": "a", "v": 0.0}])
    with pytest.raises(DeriveError):
        derive_table(zero, args(operation="share", value="v"))
