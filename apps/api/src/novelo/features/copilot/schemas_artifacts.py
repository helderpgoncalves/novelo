"""Artefactos gerados pelo copiloto (generative UI): contrato tipado que o web desenha (echarts, tabelas, mapa...).

O modelo nunca escreve números: escolhe a ferramenta de dados, o tipo e os campos; o servidor constrói a especificação
a partir dos dados reais dessa ferramenta e embute os valores com unidades e fonte.
"""

import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

ChartKind = Literal[
    "bar",
    "stacked_bar",
    "line",
    "area",
    "scatter",
    "pareto",
    "waterfall",
    "sankey",
    "treemap",
    "heatmap",
    "tornado",
    "range",
    "gauge",
    "pie",
]
ColumnType = Literal["text", "number", "percent", "currency", "date", "category"]


class _Spec(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ChartBase(_Spec):
    title: str = Field(description="Título-conclusão (sem números inventados)")
    subtitle: str | None = None
    source: str = Field(description="Ferramenta e dados de origem")
    estimate: bool = Field(default=False, description="Valores previstos (estimativa)")


class Point(_Spec):
    x: float | str
    y: float | None
    label: str | None = None
    size: float | None = None


class Series(_Spec):
    name: str
    unit: str | None = None
    points: list[Point]


class CartesianChart(ChartBase):
    """bar, stacked_bar, line, area, scatter, pareto, pie: séries de pontos (x categoria ou número).

    `pie` (circular/donut): uma só série; cada ponto é uma fatia (x = nome, y = valor, só positivos).
    """

    kind: Literal["bar", "stacked_bar", "line", "area", "scatter", "pareto", "pie"]
    x_label: str
    y_label: str
    x_unit: str | None = None
    y_unit: str | None = None
    series: list[Series]
    highlight: list[str] = Field(
        default_factory=list, description="Pontos a destacar (fronteira de Pareto, recomendado)"
    )


class WaterfallStep(_Spec):
    label: str
    value: float
    kind: Literal["start", "delta", "total"] = "delta"


class WaterfallChart(ChartBase):
    kind: Literal["waterfall"]
    unit: str | None = None
    steps: list[WaterfallStep]


class SankeyNode(_Spec):
    id: str
    label: str


class SankeyLink(_Spec):
    source: str
    target: str
    value: float


class SankeyChart(ChartBase):
    kind: Literal["sankey"]
    unit: str | None = None
    nodes: list[SankeyNode]
    links: list[SankeyLink]


class TreemapItem(_Spec):
    name: str
    parent: str | None = None
    value: float


class TreemapChart(ChartBase):
    kind: Literal["treemap"]
    unit: str | None = None
    items: list[TreemapItem]


class HeatCell(_Spec):
    x: str
    y: str
    value: float


class HeatmapChart(ChartBase):
    kind: Literal["heatmap"]
    unit: str | None = None
    x_categories: list[str]
    y_categories: list[str]
    cells: list[HeatCell]


class TornadoBar(_Spec):
    label: str
    low: float
    high: float
    base: float


class TornadoChart(ChartBase):
    kind: Literal["tornado"]
    unit: str | None = None
    bars: list[TornadoBar]


class RangeItem(_Spec):
    label: str
    p10: float
    p50: float
    p90: float


class RangeChart(ChartBase):
    kind: Literal["range"]
    unit: str | None = None
    items: list[RangeItem]


class GaugeChart(ChartBase):
    kind: Literal["gauge"]
    unit: str | None = None
    value: float
    min: float
    max: float
    target: float | None = None


ChartSpec = Annotated[
    CartesianChart
    | WaterfallChart
    | SankeyChart
    | TreemapChart
    | HeatmapChart
    | TornadoChart
    | RangeChart
    | GaugeChart,
    Field(discriminator="kind"),
]


class TableColumn(_Spec):
    key: str
    label: str
    type: ColumnType = "text"
    unit: str | None = None


class TableSpec(_Spec):
    title: str
    source: str
    estimate: bool = False
    columns: list[TableColumn]
    rows: list[dict[str, str | float | None]]
    total_rows: int
    sort_by: str | None = None
    sort_dir: Literal["asc", "desc"] = "desc"


class MapItem(_Spec):
    code: str
    label: str
    value: float | None = None
    lat: float | None = None
    lon: float | None = None
    detail: str | None = None


class MapLayer(_Spec):
    kind: Literal["parishes", "containers", "localities"]
    label: str
    metric: str | None = None
    unit: str | None = None
    items: list[MapItem]


class MapSpec(_Spec):
    title: str
    source: str
    estimate: bool = False
    center: list[float] = Field(default_factory=lambda: [41.4425, -8.2918], description="[lat, lon]")
    layers: list[MapLayer]


class KpiItem(_Spec):
    label: str
    value: float | str | None
    unit: str | None = None
    hint: str | None = None


class KpisSpec(_Spec):
    title: str
    source: str
    estimate: bool = False
    items: list[KpiItem]


class ComparisonColumn(_Spec):
    scenario_id: uuid.UUID
    label: str
    values: dict[str, float | str | None]


class ComparisonSpec(_Spec):
    title: str
    source: str
    estimate: bool = True
    metrics: list[TableColumn]
    columns: list[ComparisonColumn]


class TimelineItem(_Spec):
    at: str
    label: str
    detail: str | None = None


class TimelineSpec(_Spec):
    title: str
    source: str
    items: list[TimelineItem]


class ScenarioCardSpec(_Spec):
    scenario_id: uuid.UUID
    label: str
    objective: str
    tonnes_year: float
    annual_cost_eur: float
    eur_per_tonne: float | None
    capex_eur: float
    coverage_pct: float
    created_now: bool = False


class ReportSpec(_Spec):
    report_id: uuid.UUID
    title: str
    download_path: str
    size_kb: int


class FormField(_Spec):
    name: str
    label: str
    type: Literal["text", "number", "select", "boolean", "scenario", "textarea"]
    required: bool = True
    options: list[str] = Field(default_factory=list)
    default: str | float | bool | None = None


class FormSpec(_Spec):
    """Formulário para completar os parâmetros de uma ação; ao enviar, o web chama `propose_copilot_action`."""

    title: str
    action_type: str
    fields: list[FormField]


class _ArtifactBase(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ChartArtifact(_ArtifactBase):
    artifact_type: Literal["chart"] = "chart"
    spec: ChartSpec


class TableArtifact(_ArtifactBase):
    artifact_type: Literal["table"] = "table"
    spec: TableSpec


class MapArtifact(_ArtifactBase):
    artifact_type: Literal["map"] = "map"
    spec: MapSpec


class KpisArtifact(_ArtifactBase):
    artifact_type: Literal["kpis"] = "kpis"
    spec: KpisSpec


class ComparisonArtifact(_ArtifactBase):
    artifact_type: Literal["comparison"] = "comparison"
    spec: ComparisonSpec


class TimelineArtifact(_ArtifactBase):
    artifact_type: Literal["timeline"] = "timeline"
    spec: TimelineSpec


class ScenarioCardArtifact(_ArtifactBase):
    artifact_type: Literal["scenario_card"] = "scenario_card"
    spec: ScenarioCardSpec


class ReportArtifact(_ArtifactBase):
    artifact_type: Literal["report"] = "report"
    spec: ReportSpec


class FormArtifact(_ArtifactBase):
    artifact_type: Literal["form"] = "form"
    spec: FormSpec


Artifact = Annotated[
    ChartArtifact
    | TableArtifact
    | MapArtifact
    | KpisArtifact
    | ComparisonArtifact
    | TimelineArtifact
    | ScenarioCardArtifact
    | ReportArtifact
    | FormArtifact,
    Field(discriminator="artifact_type"),
]


class ArtifactSource(_Spec):
    tool: str
    label: str
    result_id: str | None = None
