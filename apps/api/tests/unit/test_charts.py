"""Artefactos: cada tipo de gráfico é construído a partir de uma tabela real; pedidos inválidos devolvem as colunas certas."""

from typing import Any

import pytest

from novelo.features.copilot import charts
from novelo.features.copilot.tools_data import make_table

TABLE = make_table(
    "Cenários",
    "Otimizador",
    [("label", "Cenário", "text", None), ("tonnes", "Captado", "number", "t/ano"), ("eur_t", "Custo por tonelada", "currency", "€/t"),
     ("lo", "Mín", "number", "€/t"), ("hi", "Máx", "number", "€/t"), ("base", "Base", "number", "€/t"), ("grp", "Grupo", "category", None),
     ("frontier", "Fronteira", "category", None), ("pct", "Cobertura", "percent", "%")],
    [
        {"label": "A", "tonnes": 100.0, "eur_t": 120.0, "lo": 100.0, "hi": 140.0, "base": 120.0, "grp": "g1", "frontier": "sim", "pct": 60.0},
        {"label": "B", "tonnes": 200.0, "eur_t": 150.0, "lo": 110.0, "hi": 190.0, "base": 150.0, "grp": "g2", "frontier": "não", "pct": 80.0},
        {"label": "C", "tonnes": 300.0, "eur_t": 130.0, "lo": 90.0, "hi": 170.0, "base": 130.0, "grp": "g1", "frontier": "sim", "pct": 90.0},
    ],
    estimate=True,
)  # fmt: skip


def chart(kind: str, **kw: Any) -> Any:
    args: dict[str, Any] = {
        "x": "label",
        "y": ["tonnes"],
        "series": None,
        "label": None,
        "size": None,
        "title": "Título",
    }
    return charts.build_chart(TABLE, kind, **{**args, **kw})


@pytest.mark.parametrize("kind", ["bar", "stacked_bar", "line", "area"])
def test_cartesian_charts_embed_the_real_values_units_and_source(kind: str) -> None:
    spec = chart(kind, y=["tonnes", "eur_t"])
    assert spec.kind == kind and spec.source == "Otimizador" and spec.estimate is True
    assert [s.name for s in spec.series] == ["Captado", "Custo por tonelada"]
    assert [p.y for p in spec.series[0].points] == [100.0, 200.0, 300.0] and spec.series[0].unit == "t/ano"


def test_series_column_splits_a_single_measure() -> None:
    spec = chart("bar", y=["tonnes"], series="grp")
    assert sorted(s.name for s in spec.series) == ["g1", "g2"]
    assert [p.y for p in next(s for s in spec.series if s.name == "g1").points] == [100.0, 300.0]


def test_scatter_and_pareto_highlight_the_frontier() -> None:
    spec = chart("pareto", x="tonnes", y=["eur_t"], label="label")
    assert spec.kind == "pareto" and spec.highlight == ["A", "C"] and spec.x_unit == "t/ano" and spec.y_unit == "€/t"
    assert chart("scatter", x="tonnes", y=["eur_t"], label="label", size="pct").series[0].points[0].size == 60.0


def test_special_kinds() -> None:
    assert [(s.label, s.value) for s in chart("waterfall", y=["tonnes"]).steps][:2] == [("A", 100.0), ("B", 200.0)]
    sankey = chart("sankey", x="label", series="grp", y=["tonnes"])
    assert {n.id for n in sankey.nodes} == {"A", "B", "C", "g1", "g2"} and sankey.links[0].value == 100.0
    assert [i.name for i in chart("treemap", x="label", y=["tonnes"], series="grp").items] == ["A", "B", "C"]
    heat = chart("heatmap", x="label", series="grp", y=["tonnes"])
    assert heat.x_categories == ["A", "B", "C"] and heat.y_categories == ["g1", "g2"] and len(heat.cells) == 3
    tornado = chart("tornado", y=["lo", "hi", "base"])
    assert (tornado.bars[0].low, tornado.bars[0].high, tornado.bars[0].base) == (100.0, 140.0, 120.0)
    rng = chart("range", y=["lo", "base", "hi"])
    assert (rng.items[1].p10, rng.items[1].p50, rng.items[1].p90) == (110.0, 150.0, 190.0)
    gauge = chart("gauge", x=None, y=["pct"])
    assert gauge.value == 60.0 and gauge.min == 0.0 and gauge.max == 100.0


def test_invalid_requests_say_what_columns_exist() -> None:
    with pytest.raises(charts.ArtifactError) as unknown:
        chart("bar", y=["nope"])
    assert "Unknown column" in unknown.value.message and "tonnes" in unknown.value.columns
    with pytest.raises(charts.ArtifactError) as text:
        chart("bar", y=["grp"])
    assert "not numeric" in text.value.message
    with pytest.raises(charts.ArtifactError):
        chart("tornado", y=["lo", "hi"])
    with pytest.raises(charts.ArtifactError):
        chart("sankey", y=["tonnes"])
    with pytest.raises(charts.ArtifactError):
        chart("scatter", x="label", y=["tonnes"])


def test_table_map_kpis_comparison_and_timeline_builders() -> None:
    table = charts.build_table(TABLE, ["label", "tonnes"], "tonnes", "desc", 2, "Top")
    assert [r["label"] for r in table.rows] == ["C", "B"] and table.total_rows == 3 and table.columns[1].unit == "t/ano"
    geo = make_table("Freguesias", "INE", [("name", "Nome", "text", None), ("pop", "Hab.", "number", "hab."), ("lat", "Lat", "number", None), ("lon", "Lon", "number", None)],
                     [{"name": "Selho", "pop": 5923, "lat": 41.4, "lon": -8.3}])  # fmt: skip
    spec = charts.build_map(
        [{"kind": "parishes", "result_id": "r1", "label_col": "name", "value_col": "pop"}], {"r1": geo}, "Mapa"
    )
    assert (
        spec.layers[0].items[0].value == 5923 and spec.layers[0].items[0].lat == 41.4 and spec.layers[0].unit == "hab."
    )
    kpis = charts.build_kpis(TABLE, ["tonnes", "pct"], "KPIs", 1)
    assert [(i.label, i.value, i.unit) for i in kpis.items] == [("Captado", 200.0, "t/ano"), ("Cobertura", 80.0, "%")]
    cmp_table = make_table("Cmp", "Otimizador", [("scenario_id", "Id", "text", None), ("label", "Cenário", "text", None), ("tonnes", "Captado", "number", "t/ano")],
                           [{"scenario_id": "6f1d3a7e-1b2c-4d5e-8f90-a1b2c3d4e5f6", "label": "A", "tonnes": 10.0}])  # fmt: skip
    comparison = charts.build_comparison(cmp_table, "Comparação")
    assert comparison.columns[0].values == {"tonnes": 10.0} and comparison.metrics[0].unit == "t/ano"
    events = make_table("Lote", "Histórico", [("at", "Quando", "date", None), ("label", "Evento", "category", None), ("detail", "Nota", "text", None)],
                        [{"at": "2026-10-01T10:00", "label": "opened", "detail": None}])  # fmt: skip
    assert charts.build_timeline(events, "at", "label", "detail", "Linha do tempo").items[0].label == "opened"
