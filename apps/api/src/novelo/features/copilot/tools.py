"""Ferramentas do copiloto: tipadas, determinísticas e atrás dos services existentes.

O modelo escolhe a ferramenta e os argumentos (validados por Pydantic); quem calcula é o otimizador ou a base de dados.
`get_coverage` e `get_sensitivity` são ligadas por `register_provider` ou, por omissão, aos services que existirem;
se não existirem, respondem `available: false` e o copiloto di-lo ao utilizador.
"""

import json
import logging
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from pydantic import BaseModel, Field, ValidationError, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import ToolSpec
from novelo.core.errors import AiBudgetExceededError, AppError, FeatureDisabledError
from novelo.domain.vocab import CollectionMode, ContainerKind, ScenarioObjective
from novelo.features.copilot.schemas import CardKpis, ScenarioCard, ToolTrace
from novelo.features.planning import service as planning
from novelo.features.planning.schemas import PlanningParams, ScenarioOut, ScenarioRequest, ScenarioSummary
from novelo.features.planning.whatif_schemas import CaptureScale, ModeRestriction, ScenarioDelta
from novelo.features.planning.whatif_service import resolve_parishes
from novelo.features.textile import service as textile
from novelo.features.users.models import User

log = logging.getLogger("novelo.copilot")

COPILOT_PREFIX = "Copilot · "  # origem "copilot": os cenários criados aqui levam este prefixo no nome
MAX_CREATIONS_PER_TURN = 2
Provider = Callable[[AsyncSession, dict[str, Any]], Awaitable[Any]]


# --- Argumentos ------------------------------------------------------------------------------------


class NoArgs(BaseModel):
    pass


class ListScenariosArgs(BaseModel):
    limit: int = Field(default=10, ge=1, le=15)


class RunScenarioArgs(BaseModel):
    label: str = Field(min_length=1, max_length=60, description="Nome curto do cenário")
    objective: ScenarioObjective
    budget_eur_year: float | None = Field(default=None, ge=0, le=5_000_000, description="Para max_tonnes")
    target_pct: float | None = Field(default=None, ge=1, le=100, description="Para min_cost: % do potencial")
    restrictions: list[ModeRestriction] = Field(default_factory=list, max_length=12)

    @model_validator(mode="after")
    def _inputs(self) -> "RunScenarioArgs":
        if self.objective == ScenarioObjective.MAX_TONNES and self.budget_eur_year is None:
            raise ValueError("budget_eur_year is required for max_tonnes")
        if self.objective == ScenarioObjective.MIN_COST and self.target_pct is None:
            raise ValueError("target_pct is required for min_cost")
        return self


class CompareArgs(BaseModel):
    scenario_ids: list[uuid.UUID] = Field(min_length=2, max_length=4)


class WhatIfArgs(BaseModel):
    scenario_id: uuid.UUID
    label: str | None = Field(default=None, max_length=60)
    set_modes: list[ModeRestriction] = Field(default_factory=list, max_length=12)
    budget_eur_year: float | None = Field(default=None, ge=0, le=5_000_000)
    target_pct: float | None = Field(default=None, ge=1, le=100)
    capture_scale: CaptureScale | None = None


class CoverageArgs(BaseModel):
    radius_m: int = Field(default=500, ge=100, le=2000)
    kind: ContainerKind = ContainerKind.TEXTILE


class SensitivityArgs(BaseModel):
    scenario_id: uuid.UUID
    swing: float = Field(default=0.3, ge=0.05, le=0.9)


# --- Ligação a services de outras features ---------------------------------------------------------


async def _coverage_provider(db: AsyncSession, args: dict[str, Any]) -> Any:
    from novelo.features.network import coverage_service  # noqa: PLC0415

    summary = await coverage_service.get_coverage(db, int(args["radius_m"]), ContainerKind(args["kind"]))
    data = summary.model_dump(mode="json", exclude={"parishes"})
    worst = sorted((p for p in summary.parishes if p.covered_pct is not None), key=lambda p: p.covered_pct or 0)[:5]
    data["least_covered_parishes"] = [p.model_dump(mode="json") for p in worst]
    return data


async def _sensitivity_provider(db: AsyncSession, args: dict[str, Any]) -> Any:
    from novelo.features.planning import sensitivity_service  # noqa: PLC0415
    from novelo.features.planning.sensitivity_schemas import SensitivityRequest  # noqa: PLC0415

    out = await sensitivity_service.scenario_sensitivity(
        db, uuid.UUID(str(args["scenario_id"])), SensitivityRequest(swing=args["swing"], n_samples=300)
    )
    data = out.model_dump(mode="json", exclude={"tornado"})
    data["top_drivers"] = [
        {"parameter": b.key, "source": b.source, "swing_eur_per_tonne": b.swing_eur_per_tonne} for b in out.tornado[:5]
    ]
    return data


# Para ligar outro service: `register_provider("get_coverage", fn)`; fn(db, args) devolve um BaseModel ou um dict.
PROVIDERS: dict[str, Provider] = {"get_coverage": _coverage_provider, "get_sensitivity": _sensitivity_provider}


def register_provider(name: str, provider: Provider) -> None:
    PROVIDERS[name] = provider


UNAVAILABLE = {"available": False, "message": "indisponível: this analysis is not connected yet"}


# --- Resultados ------------------------------------------------------------------------------------


def scenario_facts(s: ScenarioOut | ScenarioSummary) -> dict[str, Any]:
    return {
        "scenario_id": str(s.id),
        "label": s.label,
        "objective": s.objective.value,
        "budget_eur_year": s.budget_eur_year,
        "target_tonnes": s.target_tonnes,
        "tonnes_per_year": s.tonnes_year,
        "annual_cost_eur": s.annual_cost_eur,
        "eur_per_tonne": s.eur_per_tonne,
        "investment_eur": s.capex_eur,
        "coverage_pct": s.coverage_pct,
    }


def _card(s: ScenarioOut | ScenarioSummary, created_now: bool) -> ScenarioCard:
    return ScenarioCard(
        scenario_id=s.id,
        label=s.label,
        objective=s.objective,
        kpis=CardKpis(
            tonnes_year=s.tonnes_year,
            annual_cost_eur=s.annual_cost_eur,
            eur_per_tonne=s.eur_per_tonne,
            capex_eur=s.capex_eur,
            coverage_pct=s.coverage_pct,
        ),
        created_now=created_now,
        parent_id=s.parent_id,
    )


def _diff(a: float | None, b: float | None) -> float | None:
    return None if a is None or b is None else round(b - a, 2)


class CopilotTools:
    """Caixa de ferramentas de UM pedido: guarda os factos (para o verificador), os cartões e o rasto."""

    def __init__(self, db: AsyncSession, user: User) -> None:
        self.db, self.user = db, user
        self.facts: list[Any] = []
        self.cards: dict[uuid.UUID, ScenarioCard] = {}
        self.trace: list[ToolTrace] = []
        self._created = 0
        self._memo: dict[tuple[str, str], Any] = {}
        self._handlers: dict[str, tuple[type[BaseModel], str, Callable[[Any], Awaitable[Any]]]] = {
            "get_baseline": (
                NoArgs,
                "Observed 2025 textile collection, destinations and capture vs. potential.",
                self._baseline,
            ),
            "list_scenarios": (ListScenariosArgs, "List saved scenarios with their KPIs (newest first).", self._list),
            "run_scenario": (
                RunScenarioArgs,
                "Create a NEW scenario (optimiser). max_tonnes needs budget_eur_year; min_cost needs target_pct.",
                self._run,
            ),
            "compare_scenarios": (
                CompareArgs,
                "Compare 2 to 4 saved scenarios side by side, with precomputed differences.",
                self._compare,
            ),
            "what_if": (
                WhatIfArgs,
                "Create a NEW scenario from an existing one: restrict modes by parish, change budget, target, capture.",
                self._what_if,
            ),
            "get_coverage": (
                CoverageArgs,
                "Population coverage of the container network within a walking radius.",
                self._provider("get_coverage"),
            ),
            "get_sensitivity": (
                SensitivityArgs,
                "Sensitivity (tornado) and Monte Carlo ranges (P10/P50/P90) of a scenario's key results.",
                self._provider("get_sensitivity"),
            ),
        }

    def specs(self) -> list[ToolSpec]:
        return [
            ToolSpec(name=name, description=desc, parameters=model.model_json_schema())
            for name, (model, desc, _) in self._handlers.items()
        ]

    async def execute(self, name: str, raw_arguments: str) -> Any:
        """Valida os argumentos, corre a ferramenta e devolve sempre um dict (erros incluídos) ao modelo."""
        entry = self._handlers.get(name)
        if entry is None:
            self.trace.append(ToolTrace(name=name, ok=False))
            return {"error": "unknown_tool", "message": f"Tool '{name}' does not exist"}
        model, _, handler = entry
        try:
            args = model.model_validate(json.loads(raw_arguments or "{}"))
            key = (name, args.model_dump_json())
            if key in self._memo:  # a mesma chamada no mesmo pedido não repete efeitos (nem cria dois cenários)
                return self._memo[key]
            result = await handler(args)
        except (ValidationError, json.JSONDecodeError) as exc:
            self.trace.append(ToolTrace(name=name, ok=False))
            details = [e["msg"] for e in exc.errors()] if isinstance(exc, ValidationError) else ["invalid JSON"]
            return {"error": "invalid_arguments", "details": details[:5]}
        except (AiBudgetExceededError, FeatureDisabledError):
            raise
        except AppError as exc:
            self.trace.append(ToolTrace(name=name, ok=False))
            return {"error": exc.code, "message": exc.message}
        except Exception:
            log.exception("copilot tool failed tool=%s", name)
            self.trace.append(ToolTrace(name=name, ok=False))
            return {"error": "tool_failed", "message": "The tool failed unexpectedly"}
        ok = not (isinstance(result, dict) and "error" in result)
        self.trace.append(ToolTrace(name=name, ok=ok))
        if ok:
            self._memo[key] = result
            self.facts.append(result)
        return result

    # --- ferramentas ---

    async def _baseline(self, _: NoArgs) -> dict[str, Any]:
        b = await textile.get_baseline(self.db)
        return {
            "year": b.year,
            "population": b.population,
            "collected_t": b.total_t,
            "reuse_t": b.reuse_t,
            "recycle_t": b.recycle_t,
            "reject_t": b.reject_t,
            "kg_per_inhab_month": b.kg_per_inhab_month,
            "estimated_potential_t": b.estimated_demand_t,
            "current_capture_pct": b.capture_of_demand_pct,
            "gap_t": b.gap_t,
            "entities": [{"name": e.entity, "collected_t": e.total_t} for e in b.entities],
        }

    async def _list(self, args: ListScenariosArgs) -> dict[str, Any]:
        rows = (await planning.list_scenarios(self.db))[: args.limit]
        return {"count": len(rows), "scenarios": [scenario_facts(r) for r in rows]}

    async def _zones(self) -> dict[str, str]:
        return {z.code: z.name for z in await planning.list_zones(self.db)}

    def _constraints(
        self, base: dict[str, list[CollectionMode]], restrictions: list[ModeRestriction], zones: dict[str, str]
    ) -> tuple[dict[str, list[CollectionMode]], dict[str, Any] | None]:
        resolved, unknown, suggestions = resolve_parishes([r.parish for r in restrictions], zones)
        if unknown:
            return base, {"error": "unknown_parish", "unknown": unknown, "suggestions": suggestions[:5]}
        out = {c: list(m) for c, m in base.items()}
        for r in restrictions:
            if r.allowed_modes:
                out[resolved[r.parish]] = list(r.allowed_modes)
        return out, None

    def _check_quota(self) -> dict[str, Any] | None:
        if self._created >= MAX_CREATIONS_PER_TURN:
            return {"error": "limit_reached", "message": f"At most {MAX_CREATIONS_PER_TURN} scenarios per turn"}
        return None

    def _register(self, s: ScenarioOut, created: bool) -> dict[str, Any]:
        self.cards[s.id] = _card(s, created)
        return {**scenario_facts(s), "created_by_copilot": created, "solver_status": s.solver_status}

    async def _run(self, args: RunScenarioArgs) -> dict[str, Any]:
        if (quota := self._check_quota()) is not None:
            return quota
        constraints, error = self._constraints({}, args.restrictions, await self._zones())
        if error:
            return error
        target = None
        if args.target_pct is not None:
            target = args.target_pct / 100 * (await textile.get_baseline(self.db)).estimated_demand_t
        request = ScenarioRequest(
            label=f"{COPILOT_PREFIX}{args.label}"[:80],
            objective=args.objective,
            budget_eur_year=args.budget_eur_year if args.objective == ScenarioObjective.MAX_TONNES else None,
            target_tonnes=target if args.objective == ScenarioObjective.MIN_COST else None,
            constraints=constraints,
        )
        self._created += 1
        return self._register(await planning.run_scenario(self.db, request, self.user), created=True)

    async def _compare(self, args: CompareArgs) -> dict[str, Any]:
        scenarios = [await planning.get_scenario(self.db, sid) for sid in args.scenario_ids]
        first = scenarios[0]
        for s in scenarios:
            self.cards[s.id] = _card(s, created_now=False)
        cheapest = min(
            (s for s in scenarios if s.eur_per_tonne is not None), key=lambda s: s.eur_per_tonne or 0, default=None
        )
        most = max(scenarios, key=lambda s: s.tonnes_year)
        return {
            "count": len(scenarios),
            "scenarios": [scenario_facts(s) for s in scenarios],
            "differences_vs_first": [
                {
                    "label": s.label,
                    "tonnes_per_year": _diff(first.tonnes_year, s.tonnes_year),
                    "annual_cost_eur": _diff(first.annual_cost_eur, s.annual_cost_eur),
                    "eur_per_tonne": _diff(first.eur_per_tonne, s.eur_per_tonne),
                }
                for s in scenarios[1:]
            ],
            "lowest_eur_per_tonne": cheapest.label if cheapest else None,
            "most_tonnes": most.label,
        }

    async def _what_if(self, args: WhatIfArgs) -> dict[str, Any]:
        if (quota := self._check_quota()) is not None:
            return quota
        # ScenarioDelta valida os mesmos limites que o "E se...?" do planeamento (uma só definição de alteração).
        delta = ScenarioDelta(
            intent="change",
            understood="Entendi: alteração pedida ao copiloto.",
            set_modes=args.set_modes,
            budget_eur_year=args.budget_eur_year,
            target_pct=args.target_pct,
            capture_scale=args.capture_scale,
        )
        if not (
            delta.set_modes or delta.budget_eur_year is not None or delta.target_pct is not None or delta.capture_scale
        ):
            return {"error": "no_change", "message": "Nothing to change was specified"}
        base = await planning.get_scenario(self.db, args.scenario_id)
        constraints, error = self._constraints(base.constraints, delta.set_modes, await self._zones())
        if error:
            return error
        params: PlanningParams = base.params.model_copy(deep=True)
        if delta.capture_scale:
            mp = params.modes[delta.capture_scale.mode]
            mp.capture_rate = min(1.0, mp.capture_rate * delta.capture_scale.factor)
        objective = base.objective
        if delta.budget_eur_year is not None:
            objective = ScenarioObjective.MAX_TONNES
        elif delta.target_pct is not None:
            objective = ScenarioObjective.MIN_COST
        budget = delta.budget_eur_year if delta.budget_eur_year is not None else base.budget_eur_year
        target = (
            delta.target_pct / 100 * base.result.kpis.potential_t
            if delta.target_pct is not None
            else base.target_tonnes
        )
        request = ScenarioRequest(
            label=f"{COPILOT_PREFIX}{args.label or base.label}"[:80],
            objective=objective,
            budget_eur_year=budget if objective == ScenarioObjective.MAX_TONNES else None,
            target_tonnes=target if objective == ScenarioObjective.MIN_COST else None,
            params=params,
            constraints=constraints,
            parent_id=base.id,
        )
        self._created += 1
        new = await planning.run_scenario(self.db, request, self.user)
        self.cards[base.id] = _card(base, created_now=False)
        return {
            **self._register(new, created=True),
            "base_scenario_id": str(base.id),
            "base_label": base.label,
            "difference_tonnes_per_year": _diff(base.tonnes_year, new.tonnes_year),
            "difference_annual_cost_eur": _diff(base.annual_cost_eur, new.annual_cost_eur),
            "difference_eur_per_tonne": _diff(base.eur_per_tonne, new.eur_per_tonne),
        }

    def _provider(self, name: str) -> Callable[[Any], Awaitable[Any]]:
        async def call(args: BaseModel) -> Any:
            provider = PROVIDERS.get(name)
            if provider is None:
                return dict(UNAVAILABLE)
            try:
                data = await provider(self.db, json.loads(args.model_dump_json()))
            except (ImportError, AttributeError, NotImplementedError):
                return dict(UNAVAILABLE)
            if isinstance(data, BaseModel):
                data = data.model_dump(mode="json")
            return {"available": True, **data} if isinstance(data, dict) else {"available": True, "result": data}

        return call
