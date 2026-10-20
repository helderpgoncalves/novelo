"""Ferramentas de INTERFACE e de AGÊNCIA do copiloto: artefactos, navegação, perguntas, plano, ações, memória e sessões.

O modelo escolhe o quê; o servidor valida, constrói os dados e emite eventos tipados. Nenhum número vem do modelo.
"""

import uuid
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from novelo.ai.verify import unsupported_rounded
from novelo.core.errors import ForbiddenError, NotFoundError
from novelo.features.copilot import actions, charts, memory_service, pages, sessions
from novelo.features.copilot import memory_store as mstore
from novelo.features.copilot.schemas import (
    CopilotActionResultEvent,
    CopilotClarifyEvent,
    CopilotConfirmEvent,
    CopilotNavigateEvent,
    CopilotPlanEvent,
)
from novelo.features.copilot.schemas_actions import ActionType
from novelo.features.copilot.schemas_artifacts import ArtifactSource, ChartKind, FormField, FormSpec
from novelo.features.copilot.schemas_memory import MemoryTarget
from novelo.features.planning import service as planning

if TYPE_CHECKING:
    from novelo.features.copilot.tools import CopilotTools


class _A(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ShowChartArgs(_A):
    result_id: str = Field(max_length=12, description="Id devolvido por uma ferramenta de dados")
    kind: ChartKind
    x: str | None = Field(default=None, max_length=60, description="Coluna do eixo x / origem / nome / etiqueta")
    y: list[str] = Field(default_factory=list, max_length=4, description="Colunas de valores")
    series: str | None = Field(
        default=None, max_length=60, description="Coluna que separa séries (ou destino / pai / categoria y)"
    )
    label: str | None = Field(default=None, max_length=60)
    size: str | None = Field(default=None, max_length=60)
    title: str = Field(min_length=3, max_length=120, description="Título-conclusão, sem números inventados")


class ShowTableArgs(_A):
    result_id: str = Field(max_length=12)
    columns: list[str] = Field(default_factory=list, max_length=12)
    sort_by: str | None = Field(default=None, max_length=60)
    sort_dir: Literal["asc", "desc"] = "desc"
    limit: int = Field(default=20, ge=1, le=50)
    title: str = Field(min_length=3, max_length=120)


class MapLayerArg(_A):
    kind: Literal["parishes", "containers", "localities"]
    result_id: str = Field(max_length=12)
    label_col: str = Field(max_length=60)
    value_col: str | None = Field(default=None, max_length=60)
    code_col: str | None = Field(default=None, max_length=60)
    lat_col: str = Field(default="lat", max_length=60)
    lon_col: str = Field(default="lon", max_length=60)
    detail_col: str | None = Field(default=None, max_length=60)


class ShowMapArgs(_A):
    layers: list[MapLayerArg] = Field(min_length=1, max_length=3)
    title: str = Field(min_length=3, max_length=120)


class ShowKpisArgs(_A):
    result_id: str = Field(max_length=12)
    keys: list[str] = Field(min_length=1, max_length=8)
    row: int = Field(default=0, ge=0, le=50)
    title: str = Field(min_length=3, max_length=120)


class ShowComparisonArgs(_A):
    result_id: str = Field(max_length=12, description="Resultado de compare_scenarios")
    title: str = Field(min_length=3, max_length=120)


class ShowTimelineArgs(_A):
    result_id: str = Field(max_length=12)
    at_col: str = Field(max_length=60)
    label_col: str = Field(max_length=60)
    detail_col: str | None = Field(default=None, max_length=60)
    title: str = Field(min_length=3, max_length=120)


class ShowScenarioCardArgs(_A):
    scenario_id: uuid.UUID


class ShowFormArgs(_A):
    action_type: ActionType


class OpenPageArgs(_A):
    route: str = Field(max_length=100, description="Rota conhecida, ex.: /scenarios/$scenarioId, /map, /coverage")
    params: dict[str, str] = Field(default_factory=dict)
    search: dict[str, str] = Field(default_factory=dict)
    label: str | None = Field(default=None, max_length=80)


class AskUserArgs(_A):
    question: str = Field(min_length=3, max_length=240)
    options: list[str] = Field(min_length=2, max_length=4, description="Respostas curtas clicáveis")


class MakePlanArgs(_A):
    steps: list[str] = Field(min_length=2, max_length=6, description="Passos curtos, por ordem")


class ProposeActionArgs(_A):
    type: ActionType
    params: dict[str, Any] = Field(default_factory=dict)


class MemoryOpArg(_A):
    action: Literal["add", "patch", "remove"]
    content: str = Field(default="", max_length=600)
    old_text: str = Field(default="", max_length=300)


class MemoryArgs(_A):
    target: MemoryTarget
    action: Literal["add", "patch", "remove"] | None = None
    content: str = Field(default="", max_length=600)
    old_text: str = Field(default="", max_length=300)
    operations: list[MemoryOpArg] = Field(default_factory=list, max_length=8)


class SessionSearchArgs(_A):
    query: str | None = Field(default=None, max_length=120)
    thread_id: uuid.UUID | None = None
    around_message_id: uuid.UUID | None = None
    limit: int = Field(default=6, ge=1, le=10)


def _err(message: str, **extra: Any) -> dict[str, Any]:
    return {"error": "invalid_request", "message": message, **extra}


def _find(box: "CopilotTools", result_id: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    found = box.find_result(result_id)
    if found is None:
        return None, {
            "error": "unknown_result_id",
            "message": f"No data result '{result_id}' in this conversation",
            "available": box.result_ids(),
        }
    return found, None


def _title(box: "CopilotTools", title: str, fallback: str) -> str:
    """O título é texto do modelo: se citar números que não estão nos dados, usa o título da própria tabela."""
    return fallback if unsupported_rounded(title, box.facts) else title


def _source(tool: str, result_id: str, label: str) -> list[ArtifactSource]:
    return [ArtifactSource(tool=tool, label=label, result_id=result_id)]


async def _emit(
    box: "CopilotTools",
    artifact_type: str,
    spec: Any,
    title: str,
    sources: list[ArtifactSource],
    refresh: dict[str, Any] | None,
) -> dict[str, Any]:
    event = await box.emit_artifact(artifact_type, spec, title, sources, refresh)
    return {
        "artifact_id": str(event.id),
        "type": artifact_type,
        "title": title,
        "shown_to_user": True,
        "_summary": f"{artifact_type}: {title}"[:120],
    }


async def show_chart(box: "CopilotTools", a: ShowChartArgs) -> dict[str, Any]:
    found, err = _find(box, a.result_id)
    if err is not None or found is None:
        return err or {}
    table = found["table"]
    try:
        spec = charts.build_chart(
            table, a.kind, a.x, a.y, a.series, a.label, a.size, _title(box, a.title, table["title"])
        )
    except charts.ArtifactError as exc:
        return _err(exc.message, columns=exc.columns)
    refresh = {
        "tool": found["tool"],
        "args": found["args"],
        "builder": "chart",
        "builder_args": a.model_dump(mode="json"),
    }
    return await _emit(
        box,
        "chart",
        spec.model_dump(mode="json"),
        spec.title,
        _source(str(found["tool"]), a.result_id, table["source"]),
        refresh,
    )


async def show_table(box: "CopilotTools", a: ShowTableArgs) -> dict[str, Any]:
    found, err = _find(box, a.result_id)
    if err is not None or found is None:
        return err or {}
    table = found["table"]
    try:
        spec = charts.build_table(
            table, a.columns, a.sort_by, a.sort_dir, a.limit, _title(box, a.title, table["title"])
        )
    except charts.ArtifactError as exc:
        return _err(exc.message, columns=exc.columns)
    refresh = {
        "tool": found["tool"],
        "args": found["args"],
        "builder": "table",
        "builder_args": a.model_dump(mode="json"),
    }
    return await _emit(
        box,
        "table",
        spec.model_dump(mode="json"),
        spec.title,
        _source(str(found["tool"]), a.result_id, table["source"]),
        refresh,
    )


async def show_map(box: "CopilotTools", a: ShowMapArgs) -> dict[str, Any]:
    tables: dict[str, dict[str, Any]] = {}
    for lay in a.layers:
        found, err = _find(box, lay.result_id)
        if err is not None or found is None:
            return err or {}
        tables[lay.result_id] = found["table"]
    try:
        spec = charts.build_map([lay.model_dump() for lay in a.layers], tables, _title(box, a.title, "Mapa"))
    except charts.ArtifactError as exc:
        return _err(exc.message, columns=exc.columns)
    sources = [
        ArtifactSource(tool=str((box.find_result(r) or {}).get("tool", "")), label=t["source"], result_id=r)
        for r, t in tables.items()
    ]
    return await _emit(box, "map", spec.model_dump(mode="json"), spec.title, sources, None)


async def show_kpis(box: "CopilotTools", a: ShowKpisArgs) -> dict[str, Any]:
    found, err = _find(box, a.result_id)
    if err is not None or found is None:
        return err or {}
    table = found["table"]
    try:
        spec = charts.build_kpis(table, a.keys, _title(box, a.title, table["title"]), a.row)
    except charts.ArtifactError as exc:
        return _err(exc.message, columns=exc.columns)
    refresh = {
        "tool": found["tool"],
        "args": found["args"],
        "builder": "kpis",
        "builder_args": a.model_dump(mode="json"),
    }
    return await _emit(
        box,
        "kpis",
        spec.model_dump(mode="json"),
        spec.title,
        _source(str(found["tool"]), a.result_id, table["source"]),
        refresh,
    )


async def show_comparison(box: "CopilotTools", a: ShowComparisonArgs) -> dict[str, Any]:
    found, err = _find(box, a.result_id)
    if err is not None or found is None:
        return err or {}
    table = found["table"]
    try:
        spec = charts.build_comparison(table, _title(box, a.title, table["title"]))
    except charts.ArtifactError as exc:
        return _err(
            "This result is not a scenario comparison (needs scenario_id and label columns)", columns=exc.columns
        )
    refresh = {
        "tool": found["tool"],
        "args": found["args"],
        "builder": "comparison",
        "builder_args": a.model_dump(mode="json"),
    }
    return await _emit(
        box,
        "comparison",
        spec.model_dump(mode="json"),
        spec.title,
        _source(str(found["tool"]), a.result_id, table["source"]),
        refresh,
    )


async def show_timeline(box: "CopilotTools", a: ShowTimelineArgs) -> dict[str, Any]:
    found, err = _find(box, a.result_id)
    if err is not None or found is None:
        return err or {}
    table = found["table"]
    try:
        spec = charts.build_timeline(table, a.at_col, a.label_col, a.detail_col, _title(box, a.title, table["title"]))
    except charts.ArtifactError as exc:
        return _err(exc.message, columns=exc.columns)
    refresh = {
        "tool": found["tool"],
        "args": found["args"],
        "builder": "timeline",
        "builder_args": a.model_dump(mode="json"),
    }
    return await _emit(
        box,
        "timeline",
        spec.model_dump(mode="json"),
        spec.title,
        _source(str(found["tool"]), a.result_id, table["source"]),
        refresh,
    )


async def show_scenario_card(box: "CopilotTools", a: ShowScenarioCardArgs) -> dict[str, Any]:
    s = await planning.get_scenario(box.db, a.scenario_id)
    spec = {"scenario_id": str(s.id), "label": s.label, "objective": s.objective.value, "tonnes_year": s.tonnes_year, "annual_cost_eur": s.annual_cost_eur,
            "eur_per_tonne": s.eur_per_tonne, "capex_eur": s.capex_eur, "coverage_pct": s.coverage_pct}  # fmt: skip
    box.facts.append(
        {
            "scenario_id": str(s.id),
            "label": s.label,
            **{k: v for k, v in spec.items() if k not in {"scenario_id", "label", "objective"}},
        }
    )
    return await _emit(
        box, "scenario_card", spec, s.label, [ArtifactSource(tool="get_scenario", label=f"Cenário «{s.label}»")], None
    )


async def show_form(box: "CopilotTools", a: ShowFormArgs) -> dict[str, Any]:
    d = actions.ACTIONS[a.action_type]
    if d.admin_only and box.user.role != "admin":
        raise ForbiddenError("Only administrators can do this")
    schema = d.params.model_json_schema()
    required = set(schema.get("required", []))
    fields = []
    for name, prop in schema.get("properties", {}).items():
        typ = prop.get("type") or ("select" if "enum" in prop or "$ref" in prop else "text")
        kind = {"number": "number", "integer": "number", "boolean": "boolean", "string": "text"}.get(str(typ), "text")
        if "enum" in prop:
            kind = "select"
        if name.endswith("scenario_id"):
            kind = "scenario"
        fields.append(
            FormField(
                name=name,
                label=prop.get("title", name),
                type=kind,
                required=name in required,
                options=[str(o) for o in prop.get("enum", [])],
            )
        )
    spec = FormSpec(title=d.kind.value, action_type=d.kind.value, fields=fields)
    return await _emit(
        box,
        "form",
        spec.model_dump(mode="json"),
        spec.title,
        [ArtifactSource(tool="show_form", label=d.kind.value)],
        None,
    )


def _fill_route(route: str, params: dict[str, str]) -> str:
    out = route
    for key, value in params.items():
        out = out.replace(f"${key}", value)
    return out


async def open_page(box: "CopilotTools", a: OpenPageArgs) -> dict[str, Any]:
    page = pages.page_for_route(a.route)
    if page is None:
        return _err(
            "Unknown route", routes=[p.route for p in pages.PAGES if not p.admin_only or box.user.role == "admin"]
        )
    if page.admin_only and box.user.role != "admin":
        raise ForbiddenError("This screen is only available to administrators")
    needed = {seg[1:] for seg in page.route.split("/") if seg.startswith("$")}
    if set(a.params) != needed:
        return _err(f"This route needs exactly the params {sorted(needed)}")
    if "scenarioId" in a.params:
        try:
            await planning.get_scenario(box.db, uuid.UUID(a.params["scenarioId"]))
        except (ValueError, NotFoundError):
            return {"error": "not_found", "message": "That scenario does not exist"}
    path = _fill_route(page.route, a.params)
    label = a.label or page.label(box.locale)
    box.events.append(
        CopilotNavigateEvent(
            route=page.route, label=label, params=a.params, search={k: v for k, v in a.search.items() if len(v) <= 80}
        )
    )
    return {"ok": True, "path": path, "shown_to_user": True, "_summary": f"Abrir {label}"}


async def ask_user(box: "CopilotTools", a: AskUserArgs) -> dict[str, Any]:
    box.events.append(CopilotClarifyEvent(question=a.question, options=a.options))
    box.end_turn_text = a.question
    return {"asked": True, "_summary": "pergunta ao utilizador"}


async def make_plan(box: "CopilotTools", a: MakePlanArgs) -> dict[str, Any]:
    box.events.append(CopilotPlanEvent(steps=a.steps))
    return {"ok": True, "steps": len(a.steps), "_summary": f"plano de {len(a.steps)} passos"}


async def propose_action(box: "CopilotTools", a: ProposeActionArgs) -> dict[str, Any]:
    ctx = actions.Ctx(box.db, box.user, box.locale, box.llm)
    row = await actions.propose(ctx, a.type, a.params, box.thread_id, auto_approve=box.settings.auto_approve_low_risk)
    out = actions.to_out(row, box.locale)
    if row.status == "proposed":
        box.events.append(CopilotConfirmEvent(action=out))
        return {"status": "awaiting_user_confirmation", "action_id": str(row.id), "summary": row.summary, "risk": row.risk, "_summary": f"a aguardar confirmação: {row.summary}"[:160],
                "instruction": "Nothing was done yet. Tell the user to confirm or reject the proposal shown in the chat. Do not call propose_action again for it."}  # fmt: skip
    box.events.append(CopilotActionResultEvent(action=out))
    return {
        "status": row.status,
        "action_id": str(row.id),
        "result": row.result,
        "_summary": f"{row.status}: {row.summary}"[:160],
    }


async def memory_tool(box: "CopilotTools", a: MemoryArgs) -> dict[str, Any]:
    if a.operations:
        if a.action or a.content or a.old_text:
            return _err("Use either a single action or an operations batch, not both")
        ops = [mstore.MemoryOp(o.action, o.content, o.old_text) for o in a.operations]
    elif a.action:
        ops = [mstore.MemoryOp(a.action, a.content, a.old_text)]
    else:
        return _err(
            "Missing action: use add, patch or remove (there is no replace or read; memory is already in your prompt)"
        )
    result = await memory_service.apply(
        box.db, box.user.id, box.settings, a.target, ops, origin="tool", thread_id=box.thread_id
    )
    box.memory_events.extend(result.events)
    if not result.ok:
        return {"error": "memory_rejected", **result.payload}
    return {
        **result.payload,
        "_summary": "memória atualizada" if not result.payload.get("staged") else "memória em fila de aprovação",
    }


async def session_search(box: "CopilotTools", a: SessionSearchArgs) -> dict[str, Any]:
    if a.around_message_id and a.thread_id:
        ctx = await sessions.around(box.db, box.user.id, a.thread_id, a.around_message_id)
        return (
            {"messages": ctx, "_summary": f"{len(ctx)} mensagens à volta"}
            if ctx
            else {"error": "not_found", "message": "Message not found"}
        )
    if not a.query:
        return _err("Provide a query, or thread_id with around_message_id")
    found = await sessions.search(box.db, box.user.id, a.query, a.limit, exclude_thread=box.thread_id)
    hits = [
        {
            "thread_id": str(h.thread_id),
            "thread": h.thread_title,
            "message_id": str(h.message_id),
            "role": h.role,
            "at": h.occurred_at.date().isoformat(),
            "snippet": h.snippet,
        }
        for h in found.hits
    ]
    return {"total": found.total, "hits": hits, "_summary": f"{found.total} resultados"}


UI_TOOLS: dict[str, tuple[type[BaseModel], str, Callable[[Any, Any], Awaitable[dict[str, Any]]]]] = {
    "show_chart": (
        ShowChartArgs,
        "Draw a chart from a previous data result (result_id). Choose kind and columns; never write numbers. Kinds: bar, stacked_bar, line, area, scatter, pareto, waterfall, sankey (x=source, series=target, y=[value]), treemap, heatmap, tornado (y=[low,high,base]), range (y=[p10,p50,p90]), gauge.",
        show_chart,
    ),
    "show_table": (ShowTableArgs, "Show a sortable table built from a data result (result_id).", show_table),
    "show_map": (
        ShowMapArgs,
        "Show a map with layers built from data results with lat/lon columns (parishes with a metric, containers, localities).",
        show_map,
    ),
    "show_kpis": (ShowKpisArgs, "Show KPI tiles from a row of a data result.", show_kpis),
    "show_comparison": (
        ShowComparisonArgs,
        "Show a side-by-side scenario comparison from a compare_scenarios result.",
        show_comparison,
    ),
    "show_timeline": (
        ShowTimelineArgs,
        "Show a timeline from a data result with a date column (e.g. get_lot_history).",
        show_timeline,
    ),
    "show_scenario_card": (ShowScenarioCardArgs, "Show the KPI card of one saved scenario.", show_scenario_card),
    "show_form": (ShowFormArgs, "Show a form so the user fills the parameters of an action themselves.", show_form),
    "open_page": (
        OpenPageArgs,
        "Offer the user a button to open a screen of the app (known routes only). The user decides whether to navigate.",
        open_page,
    ),
    "ask_user": (
        AskUserArgs,
        "Ask ONE clarifying question with 2 to 4 clickable options when a critical parameter is missing. Ends your turn.",
        ask_user,
    ),
    "make_plan": (
        MakePlanArgs,
        "For composite requests, show a short numbered plan BEFORE acting. Then execute the steps.",
        make_plan,
    ),
    "propose_action": (
        ProposeActionArgs,
        "Propose a write action (scenario, alert, lot, parameter, user, AI setting, data deletion). It runs only after the user confirms in the UI.",
        propose_action,
    ),
    "memory": (
        MemoryArgs,
        "Save durable knowledge across conversations. target=user: the user's preferences, style, what they follow. target=memory: your notes (conventions, lessons). Actions add/patch/remove (substring must be unique); on a 'limit' error send ONE operations batch that frees space and adds the entry. Never save trivial facts, tables, session ephemera, volatile numbers or personal data.",
        memory_tool,
    ),
    "session_search": (
        SessionSearchArgs,
        "Search the user's past conversations (accent-insensitive, prefix match), or open the messages around a result.",
        session_search,
    ),
}
