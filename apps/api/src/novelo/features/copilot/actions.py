"""Ações de escrita do copiloto: duas etapas, executadas COMO o utilizador e auditadas.

O modelo só PROPÕE (`propose_action`). Nada se executa sem `confirm` do próprio utilizador (HTTP com a sua sessão),
exceto ações de baixo risco e reversíveis se ele ativar a auto-aprovação. Cada ação usa os mesmos services e roles da app.
"""

import builtins
import hashlib
import json
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.catalog import ModelCatalog
from novelo.ai.catalog import catalog as default_catalog
from novelo.ai.tasks import CONFIGURABLE_TASKS, AiTask
from novelo.core.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from novelo.domain.vocab import AlertStatus, LotState, ScenarioObjective
from novelo.features.copilot.models import CopilotAction
from novelo.features.copilot.schemas_actions import ActionOut, ActionType
from novelo.features.copilot.tables import fold
from novelo.features.datasets import service as datasets
from novelo.features.datasets.schemas import AlertUpdate
from novelo.features.lots import service as lots
from novelo.features.lots.schemas import ReserveRequest
from novelo.features.planning import benchmark_service
from novelo.features.planning import service as planning
from novelo.features.planning.benchmark_schemas import BenchmarkScenarioRequest
from novelo.features.planning.schemas import PlanningParams, ScenarioRequest
from novelo.features.planning.whatif_schemas import ModeRestriction
from novelo.features.planning.whatif_service import resolve_parishes
from novelo.features.reports import service as report_service
from novelo.features.reports.models import Report
from novelo.features.reports.schemas import ReportRequest
from novelo.features.users.models import User

EXPIRES_MIN = 10
CONFIRM_WORD = {"pt-PT": "APAGAR", "en": "DELETE"}
COPILOT_PREFIX = "Copilot · "


class ActionError(AppError):
    status_code = 400
    code = "bad_request"


class _P(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateScenarioP(_P):
    label: str = Field(min_length=1, max_length=60)
    objective: ScenarioObjective
    budget_eur_year: float | None = Field(default=None, ge=0, le=5_000_000)
    target_pct: float | None = Field(default=None, ge=1, le=100)
    restrictions: list[ModeRestriction] = Field(default_factory=list, max_length=12)
    siting: Literal["parish", "sites"] = "parish"
    site_radius_m: int = Field(default=300, ge=100, le=1000)


class DuplicateP(_P):
    scenario_id: uuid.UUID
    label: str | None = Field(default=None, max_length=60)


class ScenarioIdP(_P):
    scenario_id: uuid.UUID


class BenchmarkP(_P):
    key: str = Field(max_length=60)
    objective: ScenarioObjective = ScenarioObjective.MIN_COST
    budget_eur_year: float | None = Field(default=None, ge=0, le=5_000_000)


class ReportP(_P):
    scenario_ids: list[uuid.UUID] = Field(min_length=1, max_length=3)
    locale: str = Field(default="pt-PT", pattern="^(pt-PT|en)$")


class AlertP(_P):
    alert_id: uuid.UUID
    note: str | None = Field(default=None, max_length=1000)


class OpenLotP(_P):
    parish_code: str | None = Field(default=None, max_length=6)


class LotStateP(_P):
    code: str = Field(max_length=16)
    state: LotState


class ReserveP(_P):
    code: str = Field(max_length=16)
    recycler_name: str = Field(min_length=2, max_length=120)
    contact: str = Field(min_length=3, max_length=160)
    note: str | None = Field(default=None, max_length=500)


class ParameterP(_P):
    key: str = Field(max_length=80, description="Caminho, ex.: modes.street.capture_rate")
    value: float


class UserActiveP(_P):
    user_id: uuid.UUID
    is_active: bool


class UserRoleP(_P):
    user_id: uuid.UUID
    role: str = Field(pattern="^(admin|operator)$")


class AiModelP(_P):
    task: str
    model: str | None = Field(default=None, max_length=120, description="Nulo = herdar o global")


class NoP(_P):
    pass


@dataclass
class Ctx:
    db: AsyncSession
    user: User
    locale: str = "pt-PT"
    llm: OpenRouterClient | None = None
    catalog: ModelCatalog | None = None


Executor = Callable[[Ctx, Any], Awaitable[tuple[dict[str, Any], dict[str, Any] | None]]]
Undoer = Callable[[Ctx, dict[str, Any]], Awaitable[dict[str, Any]]]
Describer = Callable[[Ctx, Any], Awaitable[tuple[str, str]]]


@dataclass(frozen=True)
class ActionDef:
    kind: ActionType
    params: "builtins.type[BaseModel]"
    risk: str
    reversible: bool
    admin_only: bool
    describe: Describer
    execute: Executor
    undo: Undoer | None = None
    critical: bool = False


def forbidden_for(d: ActionDef, role: str, impersonating: bool = False) -> bool:
    """Admin-only para quem não é admin; convidados também não fazem ações de risco alto ou crítico (apagar, reservar).
    Numa impersonação, um administrador nunca executa ações críticas (apagar dados) em nome de outra pessoa."""
    if impersonating and d.critical:
        return True
    if d.admin_only and role != "admin":
        return True
    return role == "guest" and (d.critical or d.risk in {"high", "critical"})


def _t(ctx: Ctx, pt: str, en: str) -> str:
    return en if ctx.locale == "en" else pt


async def _label(ctx: Ctx, scenario_id: uuid.UUID) -> str:
    try:
        return (await planning.get_scenario(ctx.db, scenario_id)).label
    except AppError:
        return str(scenario_id)[:8]


async def _restrictions(ctx: Ctx, restrictions: list[ModeRestriction]) -> dict[str, Any]:
    zones = {z.code: z.name for z in await planning.list_zones(ctx.db)}
    resolved, unknown, suggestions = resolve_parishes([r.parish for r in restrictions], zones)
    if unknown:
        raise ActionError(f"Unknown parishes: {unknown}. Did you mean: {suggestions[:3]}?")
    return {resolved[r.parish]: list(r.allowed_modes) for r in restrictions if r.allowed_modes}


# --- descrições (resumo + impacto, na língua do utilizador) --------------------------------------------


async def d_create(ctx: Ctx, p: CreateScenarioP) -> tuple[str, str]:
    what = (
        f"{p.budget_eur_year:,.0f} €/ano".replace(",", " ")
        if p.budget_eur_year is not None
        else f"{p.target_pct}% do potencial"
    )
    return (
        _t(
            ctx,
            f"Criar o cenário «{p.label}» ({p.objective.value}, {what})",
            f"Create scenario «{p.label}» ({p.objective.value}, {what})",
        ),
        _t(
            ctx,
            "Corre o otimizador e guarda um cenário novo; não altera os existentes.",
            "Runs the optimiser and saves a new scenario; existing ones are untouched.",
        ),
    )


async def d_duplicate(ctx: Ctx, p: DuplicateP) -> tuple[str, str]:
    name = await _label(ctx, p.scenario_id)
    return (
        _t(ctx, f"Duplicar o cenário «{name}»", f"Duplicate scenario «{name}»"),
        _t(ctx, "Cria uma cópia recalculada.", "Creates a recalculated copy."),
    )


async def d_delete(ctx: Ctx, p: ScenarioIdP) -> tuple[str, str]:
    name = await _label(ctx, p.scenario_id)
    return (
        _t(ctx, f"Apagar o cenário «{name}»", f"Delete scenario «{name}»"),
        _t(
            ctx,
            "Irreversível: o cenário e os seus resultados desaparecem; relatórios já gerados mantêm-se.",
            "Irreversible: the scenario and its results disappear; reports already generated stay.",
        ),
    )


async def d_benchmark(ctx: Ctx, p: BenchmarkP) -> tuple[str, str]:
    return (
        _t(
            ctx,
            f"Criar um cenário que segue o benchmark «{p.key}»",
            f"Create a scenario that follows benchmark «{p.key}»",
        ),
        _t(ctx, "Guarda um cenário novo.", "Saves a new scenario."),
    )


async def d_report(ctx: Ctx, p: ReportP) -> tuple[str, str]:
    names = ", ".join([await _label(ctx, s) for s in p.scenario_ids])
    return (
        _t(ctx, f"Gerar o relatório RAP para: {names}", f"Generate the EPR report for: {names}"),
        _t(ctx, "Cria um PDF guardado na lista de relatórios.", "Creates a PDF saved in the reports list."),
    )


async def d_alert(ctx: Ctx, p: AlertP) -> tuple[str, str]:
    return (
        _t(ctx, "Alterar o estado de um alerta de qualidade dos dados", "Change the status of a data-quality alert"),
        _t(ctx, "Fica registado quem e quando; pode ser reaberto.", "Who and when are recorded; it can be reopened."),
    )


async def d_open_lot(ctx: Ctx, p: OpenLotP) -> tuple[str, str]:
    return (
        _t(ctx, "Abrir um lote novo no ponto de recolha", "Open a new lot at the collection point"),
        _t(ctx, "Gera um código de lote (QR).", "Generates a lot code (QR)."),
    )


async def d_lot_state(ctx: Ctx, p: LotStateP) -> tuple[str, str]:
    return (
        _t(ctx, f"Mudar o lote {p.code} para «{p.state.value}»", f"Move lot {p.code} to «{p.state.value}»"),
        _t(ctx, "Irreversível: o estado do lote só avança.", "Irreversible: a lot's state only moves forward."),
    )


async def d_reserve(ctx: Ctx, p: ReserveP) -> tuple[str, str]:
    return (
        _t(ctx, f"Reservar o lote {p.code} para {p.recycler_name}", f"Reserve lot {p.code} for {p.recycler_name}"),
        _t(
            ctx,
            "Fica na bolsa de fibra como reservado, com o contacto indicado.",
            "It shows as reserved in the fibre market with the contact given.",
        ),
    )


async def d_parameter(ctx: Ctx, p: ParameterP) -> tuple[str, str]:
    return (
        _t(ctx, f"Alterar o pressuposto {p.key} para {p.value}", f"Change assumption {p.key} to {p.value}"),
        _t(
            ctx,
            "Afeta os cenários novos; os já gravados mantêm os seus pressupostos.",
            "Affects new scenarios; saved ones keep their assumptions.",
        ),
    )


async def d_user_active(ctx: Ctx, p: UserActiveP) -> tuple[str, str]:
    return (
        _t(
            ctx,
            ("Ativar" if p.is_active else "Desativar") + " uma conta de utilizador",
            ("Activate" if p.is_active else "Deactivate") + " a user account",
        ),
        _t(ctx, "Desativar termina as sessões dessa conta.", "Deactivating ends that account's sessions."),
    )


async def d_user_role(ctx: Ctx, p: UserRoleP) -> tuple[str, str]:
    return (
        _t(ctx, f"Mudar o papel de um utilizador para «{p.role}»", f"Change a user's role to «{p.role}»"),
        _t(ctx, "Muda as permissões dessa conta.", "Changes that account's permissions."),
    )


async def d_ai_model(ctx: Ctx, p: AiModelP) -> tuple[str, str]:
    return (
        _t(
            ctx,
            f"Mudar o modelo da tarefa «{p.task}» para {p.model or 'o modelo global'}",
            f"Set the model of task «{p.task}» to {p.model or 'the global model'}",
        ),
        _t(
            ctx,
            "Vale já no pedido seguinte e altera o custo de IA.",
            "Takes effect on the next request and changes AI cost.",
        ),
    )


async def d_export(ctx: Ctx, p: NoP) -> tuple[str, str]:
    return (
        _t(ctx, "Exportar os meus dados do copiloto (JSON)", "Export my copilot data (JSON)"),
        _t(ctx, "Só leitura.", "Read-only."),
    )


async def d_delete_data(ctx: Ctx, p: NoP) -> tuple[str, str]:
    return (
        _t(ctx, "Apagar TODOS os meus dados do copiloto", "Delete ALL my copilot data"),
        _t(
            ctx,
            "Irreversível: conversas, memória, anexos, artefactos, definições e ações desaparecem. Fica apenas o registo desta eliminação.",
            "Irreversible: conversations, memory, attachments, artifacts, settings and actions disappear. Only the record of this deletion stays.",
        ),
    )


# --- execução -------------------------------------------------------------------------------------------


async def e_create(ctx: Ctx, p: CreateScenarioP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    constraints = await _restrictions(ctx, p.restrictions)
    target = None
    if p.target_pct is not None:
        target = p.target_pct / 100 * await planning.potential_t(ctx.db)  # % do têxtil por desviar do lixo
    req = ScenarioRequest(
        label=f"{COPILOT_PREFIX}{p.label}"[:80], objective=p.objective,
        budget_eur_year=p.budget_eur_year if p.objective == ScenarioObjective.MAX_TONNES else None,
        target_tonnes=target if p.objective == ScenarioObjective.MIN_COST else None, constraints=constraints,
        siting=p.siting, site_radius_m=p.site_radius_m,
    )  # fmt: skip
    s = await planning.run_scenario(ctx.db, req, ctx.user)
    return _scenario_result(s), {"kind": "delete_scenario", "scenario_id": str(s.id)}


def _scenario_result(s: Any) -> dict[str, Any]:
    return {
        "scenario_id": str(s.id),
        "label": s.label,
        "tonnes_per_year": s.tonnes_year,
        "eur_per_tonne": s.eur_per_tonne,
        "annual_cost_eur": s.annual_cost_eur,
        "route": f"/scenarios/{s.id}",
    }


async def e_duplicate(ctx: Ctx, p: DuplicateP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    base = await planning.get_scenario(ctx.db, p.scenario_id)
    req = ScenarioRequest(
        label=f"{COPILOT_PREFIX}{p.label or base.label}"[:80], objective=base.objective, budget_eur_year=base.budget_eur_year,
        target_tonnes=base.target_tonnes, params=base.params, constraints=base.constraints, parent_id=base.id,
        **base.siting_options(),
    )  # fmt: skip
    s = await planning.run_scenario(ctx.db, req, ctx.user)
    return _scenario_result(s), {"kind": "delete_scenario", "scenario_id": str(s.id)}


async def e_delete(ctx: Ctx, p: ScenarioIdP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    name = await _label(ctx, p.scenario_id)
    await planning.delete_scenario(ctx.db, p.scenario_id)
    return {"deleted": name}, None


async def e_benchmark(ctx: Ctx, p: BenchmarkP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    body = BenchmarkScenarioRequest(label=None, objective=p.objective, budget_eur_year=p.budget_eur_year)
    s = await benchmark_service.create_benchmark_scenario(ctx.db, p.key, body, ctx.user)
    return _scenario_result(s), {"kind": "delete_scenario", "scenario_id": str(s.id)}


async def e_report(ctx: Ctx, p: ReportP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    out = await report_service.create_rap(
        ctx.db, ReportRequest(scenario_ids=p.scenario_ids, locale=p.locale), ctx.user, ctx.llm
    )
    return {"report_id": str(out.id), "title": out.title, "download_path": f"/api/v1/reports/{out.id}/pdf"}, {
        "kind": "delete_report",
        "report_id": str(out.id),
    }


async def e_alert(status: AlertStatus, ctx: Ctx, p: AlertP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    before = next((a for a in (await datasets.get_quality(ctx.db)).alerts if a.id == p.alert_id), None)
    if before is None:
        raise NotFoundError("Data alert not found")
    after = await datasets.update_alert(
        ctx.db, p.alert_id, AlertUpdate(status=status, resolution_note=p.note), ctx.user
    )
    undo = {
        "kind": "restore_alert",
        "alert_id": str(p.alert_id),
        "status": before.status.value,
        "note": before.resolution_note,
    }
    return {"alert_id": str(after.id), "number": after.number, "status": after.status.value}, undo


async def e_open_lot(ctx: Ctx, p: OpenLotP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    lot = await lots.open_lot(ctx.db, ctx.user, p.parish_code)
    return {"code": lot.code, "state": lot.state.value, "route": f"/lots/{lot.code}"}, None


async def e_lot_state(ctx: Ctx, p: LotStateP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    lot = await lots.change_state(ctx.db, ctx.user, p.code, p.state)
    return {"code": lot.code, "state": lot.state.value}, None


async def e_reserve(ctx: Ctx, p: ReserveP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    lot = await lots.reserve(
        ctx.db, ctx.user, p.code, ReserveRequest(recycler_name=p.recycler_name, contact=p.contact, note=p.note)
    )
    return {"code": lot.code, "state": lot.state.value}, None


def _nested_get(data: dict[str, Any], key: str) -> Any:
    cur: Any = data
    for part in key.split("."):
        if not isinstance(cur, dict) or part not in cur:
            raise ActionError(f"Unknown assumption '{key}'")
        cur = cur[part]
    return cur


def _nested_set(data: dict[str, Any], key: str, value: float) -> None:
    cur = data
    parts = key.split(".")
    for part in parts[:-1]:
        cur = cur[part]
    cur[parts[-1]] = value


async def e_parameter(ctx: Ctx, p: ParameterP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    current = (await planning.get_parameters(ctx.db)).values.model_dump(mode="json")
    old = _nested_get(current, p.key)
    if isinstance(old, (dict, list, bool)) or not isinstance(old, (int, float)):
        raise ActionError(f"'{p.key}' is not a single numeric assumption")
    _nested_set(current, p.key, p.value)
    try:
        params = PlanningParams.model_validate(current)
    except ValidationError as exc:
        raise ActionError("Invalid value: " + exc.errors()[0]["msg"]) from exc
    await planning.update_parameters(ctx.db, params, ctx.user)
    return {"key": p.key, "old": old, "new": p.value}, {"kind": "restore_parameter", "key": p.key, "value": old}


async def e_user_active(ctx: Ctx, p: UserActiveP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    from novelo.features.users import accounts  # noqa: PLC0415

    if p.user_id == ctx.user.id:
        raise ActionError("You cannot change your own account")
    target = await ctx.db.get(User, p.user_id)
    if target is None:
        raise NotFoundError("User not found")
    before = target.is_active
    await accounts.set_active(ctx.db, ctx.user, target, p.is_active, None)
    await ctx.db.commit()
    return {"user_id": str(target.id), "is_active": p.is_active}, {
        "kind": "restore_user_active",
        "user_id": str(target.id),
        "value": before,
    }


async def e_user_role(ctx: Ctx, p: UserRoleP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    from novelo.features.users import accounts  # noqa: PLC0415

    if p.user_id == ctx.user.id:
        raise ActionError("You cannot change your own account")
    target = await ctx.db.get(User, p.user_id)
    if target is None:
        raise NotFoundError("User not found")
    before = target.role
    # A confirmação em duas etapas do copiloto (proposta + confirmar) já é a confirmação reforçada.
    await accounts.change_role(ctx.db, ctx.user, target, p.role, confirm_admin=True, meta=None)
    await ctx.db.commit()
    return {"user_id": str(target.id), "role": p.role}, {
        "kind": "restore_user_role",
        "user_id": str(target.id),
        "value": before,
    }


async def e_ai_model(ctx: Ctx, p: AiModelP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    from novelo.features.ai_admin import service as ai_admin  # noqa: PLC0415
    from novelo.features.ai_admin.schemas import AiSettingsUpdate, GlobalDefaults, TaskConfigIn  # noqa: PLC0415

    task = AiTask(p.task) if p.task in {t.value for t in CONFIGURABLE_TASKS} else None
    if task is None:
        raise ActionError(f"'{p.task}' is not a configurable AI task")
    cur = await ai_admin.get_settings_out(ctx.db)
    previous = next(t.override.model for t in cur.tasks if t.task == task)
    tasks = [
        TaskConfigIn(
            task=t.task,
            **t.override.model_dump(exclude={"model"}),
            model=p.model if t.task == task else t.override.model,
        )
        for t in cur.tasks
    ]
    body = AiSettingsUpdate(
        defaults=GlobalDefaults(**cur.defaults.model_dump()),
        monthly_budget_usd=cur.budget.monthly_budget_usd,
        tasks=tasks,
    )
    await ai_admin.update_settings(ctx.db, body, ctx.user, ctx.catalog or default_catalog)
    return {"task": p.task, "model": p.model}, {"kind": "restore_ai_model", "task": p.task, "value": previous}


async def e_export(ctx: Ctx, p: NoP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    return {"download_path": "/api/v1/copilot/data/export"}, None


async def e_delete_data(ctx: Ctx, p: NoP) -> tuple[dict[str, Any], dict[str, Any] | None]:
    from novelo.features.copilot.privacy import delete_all  # noqa: PLC0415

    counts = await delete_all(ctx.db, ctx.user.id, keep_action=None)
    return {"deleted": counts}, None


# --- desfazer ----------------------------------------------------------------------------------------


async def u_generic(ctx: Ctx, undo: dict[str, Any]) -> dict[str, Any]:
    kind = undo["kind"]
    if kind == "delete_scenario":
        await planning.delete_scenario(ctx.db, uuid.UUID(undo["scenario_id"]))
    elif kind == "delete_report":
        row = await ctx.db.get(Report, uuid.UUID(undo["report_id"]))
        if row is not None:
            await ctx.db.delete(row)
            await ctx.db.commit()
    elif kind == "restore_alert":
        await datasets.update_alert(
            ctx.db,
            uuid.UUID(undo["alert_id"]),
            AlertUpdate(status=AlertStatus(undo["status"]), resolution_note=undo.get("note")),
            ctx.user,
        )
    elif kind == "restore_parameter":
        await e_parameter(ctx, ParameterP(key=undo["key"], value=undo["value"]))
    elif kind in {"restore_user_active", "restore_user_role"}:
        target = await ctx.db.get(User, uuid.UUID(undo["user_id"]))
        if target is None:
            raise NotFoundError("User not found")
        if kind == "restore_user_active":
            target.is_active = bool(undo["value"])
        else:
            target.role = str(undo["value"])
        await ctx.db.commit()
    elif kind == "restore_ai_model":
        await e_ai_model(ctx, AiModelP(task=undo["task"], model=undo["value"]))
    else:
        raise ActionError("This action cannot be undone")
    return {"undone": kind}


def _def(
    t: ActionType,
    p: type[BaseModel],
    risk: str,
    rev: bool,
    admin: bool,
    d: Describer,
    e: Executor,
    critical: bool = False,
) -> ActionDef:
    return ActionDef(t, p, risk, rev, admin, d, e, u_generic if rev else None, critical)


def _alert(status: AlertStatus) -> Executor:
    async def run(ctx: Ctx, p: AlertP) -> tuple[dict[str, Any], dict[str, Any] | None]:
        return await e_alert(status, ctx, p)

    return run


ACTIONS: dict[ActionType, ActionDef] = {
    d.kind: d
    for d in [
        _def(ActionType.CREATE_SCENARIO, CreateScenarioP, "low", True, False, d_create, e_create),
        _def(ActionType.DUPLICATE_SCENARIO, DuplicateP, "low", True, False, d_duplicate, e_duplicate),
        _def(ActionType.DELETE_SCENARIO, ScenarioIdP, "high", False, False, d_delete, e_delete),
        _def(ActionType.RUN_BENCHMARK, BenchmarkP, "low", True, False, d_benchmark, e_benchmark),
        _def(ActionType.GENERATE_REPORT, ReportP, "low", True, False, d_report, e_report),
        _def(ActionType.RESOLVE_ALERT, AlertP, "medium", True, False, d_alert, _alert(AlertStatus.RESOLVED)),
        _def(ActionType.IGNORE_ALERT, AlertP, "medium", True, False, d_alert, _alert(AlertStatus.WONT_FIX)),
        _def(ActionType.REOPEN_ALERT, AlertP, "medium", True, False, d_alert, _alert(AlertStatus.OPEN)),
        _def(ActionType.OPEN_LOT, OpenLotP, "medium", False, False, d_open_lot, e_open_lot),
        _def(ActionType.SET_LOT_STATE, LotStateP, "medium", False, False, d_lot_state, e_lot_state),
        _def(ActionType.RESERVE_LOT, ReserveP, "high", False, False, d_reserve, e_reserve),
        _def(ActionType.UPDATE_PARAMETER, ParameterP, "high", True, True, d_parameter, e_parameter),
        _def(ActionType.SET_USER_ACTIVE, UserActiveP, "high", True, True, d_user_active, e_user_active),
        _def(ActionType.SET_USER_ROLE, UserRoleP, "high", True, True, d_user_role, e_user_role),
        _def(ActionType.CHANGE_AI_TASK_MODEL, AiModelP, "high", True, True, d_ai_model, e_ai_model),
        _def(ActionType.EXPORT_MY_DATA, NoP, "low", True, False, d_export, e_export),
        _def(
            ActionType.DELETE_MY_COPILOT_DATA,
            NoP,
            "critical",
            False,
            False,
            d_delete_data,
            e_delete_data,
            critical=True,
        ),
    ]
}


# --- ciclo de vida -------------------------------------------------------------------------------------


def to_out(row: CopilotAction, locale: str = "pt-PT", email: str | None = None) -> ActionOut:
    d = ACTIONS.get(ActionType(row.type))
    critical = bool(d and d.critical)
    return ActionOut(
        id=row.id, type=ActionType(row.type), params=row.params, summary=row.summary, impact=row.impact,
        risk=row.risk, reversible=row.reversible, status=row.status, auto_approved=row.auto_approved,
        requires_text=critical, confirm_word=CONFIRM_WORD.get(locale, "APAGAR") if critical else None, result=row.result,
        thread_id=row.thread_id, user_id=row.user_id, user_email=email,
        can_undo=row.status == "executed" and row.reversible and bool(row.undo), expires_at=row.expires_at,
        decided_at=row.decided_at, created_at=row.created_at,
    )  # fmt: skip


def idem_key(user_id: uuid.UUID, thread_id: uuid.UUID | None, type_: str, params: dict[str, Any]) -> str:
    raw = json.dumps([str(user_id), str(thread_id), type_, params], sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:40]


async def propose(
    ctx: Ctx, type_: ActionType, raw_params: dict[str, Any], thread_id: uuid.UUID | None, *, auto_approve: bool = False
) -> CopilotAction:
    """Valida o tipo, os parâmetros e o role. Cria a proposta (e executa-a só se for auto-aprovada)."""
    d = ACTIONS[type_]
    if forbidden_for(d, ctx.user.role, ctx.user.impersonation is not None):
        raise ForbiddenError("Only administrators can do this")
    # O modelo copia os argumentos de run_scenario (ex.: `param_changes: []`): campos vazios que a ação não tem
    # não mudam nada e não devem fazer falhar a proposta; um campo desconhecido com valor continua a ser erro.
    raw_params = {k: v for k, v in raw_params.items() if k in d.params.model_fields or v not in (None, "", [], {})}
    try:
        params = d.params.model_validate(raw_params)
    except ValidationError as exc:
        raise ActionError(
            "Invalid parameters: " + "; ".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors()[:4])
        ) from exc
    clean = json.loads(params.model_dump_json())
    await _precheck(ctx, d, params)
    key = idem_key(ctx.user.id, thread_id, type_.value, clean)
    existing = (
        await ctx.db.execute(
            select(CopilotAction).where(CopilotAction.user_id == ctx.user.id, CopilotAction.idempotency_key == key)
        )
    ).scalar_one_or_none()
    if existing is not None and existing.status in {"proposed", "executed", "running"}:
        return existing  # a mesma proposta (modelo a repetir) não cria duplicados
    if existing is not None:
        existing.idempotency_key = None  # libertar a chave de propostas terminadas (rejeitada/expirada/desfeita)
        await ctx.db.flush()
    summary, impact = await d.describe(ctx, params)
    row = CopilotAction(
        user_id=ctx.user.id, thread_id=thread_id, type=type_.value, params=clean, summary=summary, impact=impact, risk=d.risk,
        reversible=d.reversible, status="proposed", expires_at=datetime.now(UTC) + timedelta(minutes=EXPIRES_MIN),
        idempotency_key=key, search_text=fold(f"{type_.value} {summary}"),
    )  # fmt: skip
    ctx.db.add(row)
    await ctx.db.commit()
    if auto_approve and d.risk == "low" and d.reversible and not d.critical:
        row.auto_approved = True
        await ctx.db.commit()
        return await _run(ctx, row.id)
    return row


async def _precheck(ctx: Ctx, d: ActionDef, params: Any) -> None:
    """Falhas previsíveis antes de pedir confirmação (freguesia desconhecida, alerta inexistente...)."""
    if d.kind in {ActionType.CREATE_SCENARIO}:
        await _restrictions(ctx, params.restrictions)
    if d.kind in {ActionType.DUPLICATE_SCENARIO, ActionType.DELETE_SCENARIO}:
        await planning.get_scenario(ctx.db, params.scenario_id)
    alert_types = {ActionType.RESOLVE_ALERT, ActionType.IGNORE_ALERT, ActionType.REOPEN_ALERT}
    if d.kind in alert_types and all(a.id != params.alert_id for a in (await datasets.get_quality(ctx.db)).alerts):
        raise NotFoundError("Data alert not found")


async def _load_owned(ctx: Ctx, action_id: uuid.UUID) -> CopilotAction:
    row = await ctx.db.get(CopilotAction, action_id)
    if row is None or row.user_id != ctx.user.id:
        raise NotFoundError("Action not found")
    if row.status == "proposed" and row.expires_at < datetime.now(UTC):
        row.status, row.decided_at = "expired", datetime.now(UTC)
        await ctx.db.commit()
    return row


async def confirm(ctx: Ctx, action_id: uuid.UUID, confirmation_text: str | None) -> CopilotAction:
    row = await _load_owned(ctx, action_id)
    if row.status in {"executed", "failed", "undone"}:
        return row  # idempotente: confirmar de novo devolve o resultado guardado, sem executar outra vez
    if row.status == "expired":
        raise ConflictError("This proposal expired; ask for it again")
    if row.status == "rejected":
        raise ConflictError("This proposal was rejected")
    if row.status == "running":
        raise ConflictError("This action is already running")
    d = ACTIONS[ActionType(row.type)]
    if d.critical and (confirmation_text or "").strip().upper() != CONFIRM_WORD.get(ctx.locale, "APAGAR"):
        raise ActionError(f"Type {CONFIRM_WORD.get(ctx.locale, 'APAGAR')} to confirm this irreversible action")
    return await _run(ctx, action_id)


async def _run(ctx: Ctx, action_id: uuid.UUID) -> CopilotAction:
    # reivindica a execução de forma atómica: duas confirmações em simultâneo só executam uma vez
    claimed = await ctx.db.execute(
        update(CopilotAction)
        .where(CopilotAction.id == action_id, CopilotAction.status == "proposed")
        .values(status="running")
        .returning(CopilotAction.id)
    )
    if claimed.first() is None:
        await ctx.db.rollback()
        row = await ctx.db.get(CopilotAction, action_id)
        assert row is not None
        await ctx.db.refresh(row)
        return row
    await ctx.db.commit()
    row = await ctx.db.get(CopilotAction, action_id)
    assert row is not None
    d = ACTIONS[ActionType(row.type)]
    if forbidden_for(
        d, ctx.user.role, ctx.user.impersonation is not None
    ):  # o role pode ter mudado entre a proposta e a confirmação
        row.status, row.result, row.decided_at = (
            "failed",
            {"error": "forbidden", "message": "Insufficient permissions"},
            datetime.now(UTC),
        )
        await ctx.db.commit()
        return row
    try:
        result, undo = await d.execute(ctx, d.params.model_validate(row.params))
        row.status, row.result, row.undo = "executed", result, undo
    except AppError as exc:
        await ctx.db.rollback()
        row = await ctx.db.get(CopilotAction, action_id)
        assert row is not None
        row.status, row.result = "failed", {"error": exc.code, "message": exc.message}
    row.decided_at = datetime.now(UTC)
    await ctx.db.commit()
    return row


async def reject(ctx: Ctx, action_id: uuid.UUID) -> CopilotAction:
    row = await _load_owned(ctx, action_id)
    if row.status != "proposed":
        raise ConflictError(f"The action is already {row.status}")
    row.status, row.decided_at = "rejected", datetime.now(UTC)
    row.idempotency_key = None
    await ctx.db.commit()
    return row


async def undo(ctx: Ctx, action_id: uuid.UUID) -> CopilotAction:
    row = await _load_owned(ctx, action_id)
    if row.status != "executed" or not row.reversible or not row.undo:
        raise ConflictError("This action cannot be undone")
    d = ACTIONS[ActionType(row.type)]
    if forbidden_for(d, ctx.user.role, ctx.user.impersonation is not None):
        raise ForbiddenError("Only administrators can undo this")
    assert d.undo is not None
    row.result = {**row.result, **await d.undo(ctx, row.undo)}
    row.status, row.decided_at, row.idempotency_key = "undone", datetime.now(UTC), None
    await ctx.db.commit()
    return row
