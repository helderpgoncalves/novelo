"""E se...? A IA descreve a alteração; o otimizador corre os números; um verificador valida a explicação."""

import difflib
import json
import re
import unicodedata
import uuid
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.prompts import load
from novelo.ai.verify import unsupported_numbers
from novelo.core.config import get_settings
from novelo.core.errors import ConflictError, NotFoundError
from novelo.domain.vocab import CollectionMode, ScenarioObjective, WhatIfStatus
from novelo.features.planning import service as planning
from novelo.features.planning.schemas import PlanningParams, ScenarioOut, ScenarioRequest
from novelo.features.planning.whatif_models import WhatIfRun
from novelo.features.planning.whatif_schemas import (
    CaptureScale,
    ResolvedChange,
    ScenarioDelta,
    WhatIfOut,
    WhatIfRequest,
)
from novelo.features.users.models import User


class _Explanation(BaseModel):
    text: str = Field(min_length=10, max_length=900)


def _norm(text: str) -> str:
    """Minúsculas, sem acentos nem pontuação: "Selho (São Jorge)" e "selho sao jorge" ficam iguais."""
    plain = "".join(c for c in unicodedata.normalize("NFD", text.lower()) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", plain).strip()


def resolve_parishes(names: list[str], zones: dict[str, str]) -> tuple[dict[str, str], list[str], list[str]]:
    """Casa os nomes do utilizador com a lista oficial. Devolve (código por nome, desconhecidas, sugestões)."""
    by_norm = {_norm(name): code for code, name in zones.items()}
    resolved: dict[str, str] = {}
    unknown: list[str] = []
    suggestions: list[str] = []
    for raw in names:
        key = _norm(raw)
        code = by_norm.get(key)
        if code is None:  # "Selho" também serve para "Selho (São Jorge)" se for único
            partial = [c for k, c in by_norm.items() if key and (k.startswith(key) or key in k.split(" "))]
            code = partial[0] if len(partial) == 1 else None
        if code is None:
            unknown.append(raw)
            suggestions += [zones[by_norm[k]] for k in difflib.get_close_matches(key, list(by_norm), n=3, cutoff=0.5)]
        else:
            resolved[raw] = code
    return resolved, unknown, list(dict.fromkeys(suggestions))


def _to_out(run: WhatIfRun) -> WhatIfOut:
    d = run.delta
    return WhatIfOut(
        id=run.id,
        status=run.status,
        question=run.question,
        understood=run.understood,
        clarification=d.get("clarification"),
        changes=[ResolvedChange(**c) for c in d.get("changes", [])],
        budget_eur_year=d.get("budget_eur_year"),
        target_pct=d.get("target_pct"),
        objective=ScenarioObjective(d["objective"]) if d.get("objective") else None,
        capture_scale=CaptureScale(**d["capture_scale"]) if d.get("capture_scale") else None,
        unknown_parishes=d.get("unknown_parishes", []),
        suggestions=d.get("suggestions", []),
        base_scenario_id=run.base_scenario_id,
        new_scenario_id=run.new_scenario_id,
        explanation=run.explanation,
        explanation_verified=run.explanation_verified,
        prompt_version=run.prompt_version,
        created_at=run.created_at,
    )


async def propose(db: AsyncSession, llm: OpenRouterClient, user: User, req: WhatIfRequest) -> WhatIfOut:
    base = await planning.get_scenario(db, req.scenario_id)
    zones = {z.code: z.name for z in await planning.list_zones(db)}
    system, version = load("whatif")
    context = {
        "question": req.question,
        "language": req.locale,
        "current_scenario": {
            "objective": base.objective.value,
            "budget_eur_year": base.budget_eur_year,
            "target_tonnes": base.target_tonnes,
            "restricted_parishes": {zones.get(c, c): [m.value for m in modes] for c, modes in base.constraints.items()},
        },
        "parishes": sorted(zones.values()),
    }
    delta = await llm.structured(system=system, user=json.dumps(context, ensure_ascii=False), schema=ScenarioDelta)

    resolved, unknown, suggestions = resolve_parishes([r.parish for r in delta.set_modes], zones)
    changes = [
        {
            "parish_code": resolved[r.parish],
            "parish_name": zones[resolved[r.parish]],
            "allowed_modes": [m.value for m in r.allowed_modes],
        }
        for r in delta.set_modes
        if r.parish in resolved and r.allowed_modes
    ]
    objective = (
        ScenarioObjective.MAX_TONNES
        if delta.budget_eur_year is not None
        else ScenarioObjective.MIN_COST
        if delta.target_pct is not None
        else None
    )
    has_change = bool(
        changes or delta.budget_eur_year is not None or delta.target_pct is not None or delta.capture_scale
    )
    rejected = delta.intent != "change" or bool(unknown) or not has_change
    clarification = delta.clarification
    if unknown and not clarification:
        clarification = None  # a UI mostra as freguesias desconhecidas e as sugestões
    run = WhatIfRun(
        base_scenario_id=base.id,
        question=req.question,
        status=WhatIfStatus.REJECTED if rejected else WhatIfStatus.PROPOSED,
        delta={
            "intent": delta.intent,
            "clarification": clarification,
            "changes": changes,
            "budget_eur_year": delta.budget_eur_year,
            "target_pct": delta.target_pct,
            "objective": objective.value if objective else None,
            "capture_scale": delta.capture_scale.model_dump(mode="json") if delta.capture_scale else None,
            "unknown_parishes": unknown,
            "suggestions": suggestions,
        },
        understood=delta.understood,
        prompt_version=version,
        model=get_settings().llm_model_text,
        created_by_id=user.id,
    )
    db.add(run)
    await db.commit()
    return _to_out(run)


def _facts(
    base: ScenarioOut, new: ScenarioOut, question: str, changes: list[dict[str, Any]], locale: str
) -> dict[str, Any]:
    comma = locale == "pt-PT"

    def fmt(value: float | None, digits: int = 1) -> str | None:
        if value is None:
            return None
        text = f"{value:.{digits}f}"
        return text.replace(".", ",") if comma else text

    def kpis(s: ScenarioOut) -> dict[str, Any]:
        k = s.result.kpis
        return {
            "tonnes_per_year": fmt(k.tonnes_year),
            "eur_per_tonne": fmt(k.eur_per_tonne, 0),
            "annual_cost_eur": fmt(k.annual_cost_eur, 0),
            "investment_eur": fmt(k.capex_eur, 0),
            "coverage_pct": fmt(k.coverage_pct),
            "points": str(k.points),
        }

    return {
        "language": locale,
        "question": question,
        "change_applied": [{"parish": c["parish_name"], "allowed_modes": c["allowed_modes"]} for c in changes],
        "base_scenario": {"name": base.label, **kpis(base)},
        "new_scenario": {"name": new.label, **kpis(new)},
        "difference": {
            "tonnes_per_year": fmt(new.result.kpis.tonnes_year - base.result.kpis.tonnes_year),
            "annual_cost_eur": fmt(new.result.kpis.annual_cost_eur - base.result.kpis.annual_cost_eur, 0),
        },
    }


def _fallback(facts: dict[str, Any]) -> str:
    """Explicação determinística: só usa os factos. É o que se mostra quando o modelo falha na verificação."""
    b, n = facts["base_scenario"], facts["new_scenario"]
    if facts["language"] == "en":
        return (
            f"Result: {n['tonnes_per_year']} t per year (before: {b['tonnes_per_year']} t), "
            f"{n['eur_per_tonne']} €/t (before: {b['eur_per_tonne']} €/t) and {n['annual_cost_eur']} € per year "
            f"(before: {b['annual_cost_eur']} €). Values are estimates."
        )
    return (
        f"Resultado: {n['tonnes_per_year']} t por ano (antes: {b['tonnes_per_year']} t), "
        f"{n['eur_per_tonne']} €/t (antes: {b['eur_per_tonne']} €/t) e {n['annual_cost_eur']} € por ano "
        f"(antes: {b['annual_cost_eur']} €). Os valores são estimativas."
    )


async def apply(db: AsyncSession, llm: OpenRouterClient, user: User, run_id: uuid.UUID, locale: str) -> WhatIfOut:
    run = await db.get(WhatIfRun, run_id)
    if run is None:
        raise NotFoundError("What-if run not found")
    if run.status != WhatIfStatus.PROPOSED:
        raise ConflictError("This question was already applied or could not be applied")

    base = await planning.get_scenario(db, run.base_scenario_id)
    d = run.delta
    params: PlanningParams = base.params.model_copy(deep=True)
    if d.get("capture_scale"):
        scale = CaptureScale(**d["capture_scale"])
        mp = params.modes[scale.mode]
        mp.capture_rate = min(1.0, mp.capture_rate * scale.factor)

    constraints = {c: list(modes) for c, modes in base.constraints.items()}
    for change in d.get("changes", []):
        constraints[change["parish_code"]] = [CollectionMode(m) for m in change["allowed_modes"]]

    objective = ScenarioObjective(d["objective"]) if d.get("objective") else base.objective
    potential = base.result.kpis.potential_t
    budget = d["budget_eur_year"] if d.get("budget_eur_year") is not None else base.budget_eur_year
    target = d["target_pct"] / 100 * potential if d.get("target_pct") is not None else base.target_tonnes
    request = ScenarioRequest(
        label=f"{base.label} · E se...?"[:80],
        objective=objective,
        budget_eur_year=budget if objective == ScenarioObjective.MAX_TONNES else None,
        target_tonnes=target if objective == ScenarioObjective.MIN_COST else None,
        params=params,
        constraints=constraints,
        parent_id=base.id,
    )

    new = await planning.run_scenario(db, request, user)

    facts = _facts(base, new, run.question, d.get("changes", []), locale)
    system, _ = load("explain")
    explanation: str | None = None
    verified = False
    for _attempt in range(2):
        try:
            text = await llm.structured(system=system, user=json.dumps(facts, ensure_ascii=False), schema=_Explanation)
        except Exception:  # falha do modelo: cai para o texto determinístico
            break
        if not unsupported_numbers(text.text, facts):
            explanation, verified = text.text, True
            break
    if explanation is None:
        explanation, verified = _fallback(facts), False

    run.status = WhatIfStatus.APPLIED
    run.new_scenario_id = new.id
    run.explanation = explanation
    run.explanation_verified = verified
    await db.commit()
    return _to_out(run)


async def list_runs(db: AsyncSession, scenario_id: uuid.UUID) -> list[WhatIfOut]:
    runs = (
        (
            await db.execute(
                select(WhatIfRun).where(WhatIfRun.base_scenario_id == scenario_id).order_by(WhatIfRun.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [_to_out(r) for r in runs]
