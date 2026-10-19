"""Resolvedor de alertas de qualidade: a IA propõe, uma pessoa confirma. Nunca escreve na base de dados."""

import json
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.prompts import load
from novelo.ai.tasks import AiTask
from novelo.ai.verify import unsupported_rounded
from novelo.core.errors import AiBudgetExceededError, FeatureDisabledError, NotFoundError
from novelo.domain.vocab import AlertKind, AlertStatus
from novelo.features.datasets.models import DataAlert, DataSource
from novelo.features.datasets.schemas import AlertAction, AlertSuggestion, AlertSuggestionOut

_STATUS: dict[AlertAction, AlertStatus] = {
    "confirm_with_vitrus": AlertStatus.OPEN,
    "correct_data": AlertStatus.RESOLVED,
    "accept_as_is": AlertStatus.RESOLVED,
    "ignore": AlertStatus.WONT_FIX,
}
# Regra sem IA: o que se faz por omissão com cada tipo de alerta.
_DEFAULT_ACTION: dict[AlertKind, AlertAction] = {AlertKind.NORMALIZED_SPELLING: "accept_as_is"}


def _alert_json(alert: DataAlert, source_key: str) -> dict[str, object]:
    return {
        "number": alert.number,
        "kind": alert.kind.value,
        "detail": alert.detail,
        "suggestion": alert.suggestion,
        "source": source_key,
    }


def _fallback(alert: DataAlert) -> AlertSuggestion:
    action = _DEFAULT_ACTION.get(alert.kind, "confirm_with_vitrus")
    hint = alert.suggestion.strip() or alert.detail.strip()
    if action == "accept_as_is":
        note = "Normalização já aplicada; sem impacto nos modelos."
    else:
        note = f"A confirmar com a Vitrus: {hint}"[:300]
    return AlertSuggestion(
        action=action,
        suggested_status=_STATUS[action],
        justification="Rule-based proposal (no AI): the original hint is kept for the steward to review.",
        fields_to_fix=[],
        question_for_vitrus=hint[:400] if action == "confirm_with_vitrus" else None,
        resolution_note=note,
        confidence=0.3,
    )


def _is_grounded(s: AlertSuggestion, alert: DataAlert, facts: dict[str, object]) -> bool:
    """Os números vêm do alerta e todo o valor proposto está escrito no texto do alerta."""
    text = " ".join([s.justification, s.resolution_note, s.question_for_vitrus or ""])
    if unsupported_rounded(text, facts):
        return False
    source = f"{alert.detail} {alert.suggestion}".lower()
    for fix in s.fields_to_fix:
        if fix.proposed_value and fix.proposed_value.lower() not in source:
            return False
        if fix.current_value and unsupported_rounded(fix.current_value, facts):
            return False
    return not (s.action == "correct_data" and not s.fields_to_fix)


async def suggest(db: AsyncSession, llm: OpenRouterClient, alert_id: uuid.UUID) -> AlertSuggestionOut:
    alert = await db.get(DataAlert, alert_id)
    if alert is None:
        raise NotFoundError("Data alert not found")
    source = await db.get(DataSource, alert.source_id)
    facts = _alert_json(alert, source.key if source else "")
    system, version = load("alert_resolution")
    proposal: AlertSuggestion | None = None
    for _ in range(2):  # uma repetição se a proposta inventar valores
        try:
            candidate = await llm.structured(
                system=system,
                user=json.dumps(facts, ensure_ascii=False),
                schema=AlertSuggestion,
                task=AiTask.ALERT_RESOLUTION,
            )
        except (AiBudgetExceededError, FeatureDisabledError):
            raise
        except Exception:  # falha do modelo: cai para a regra determinística
            break
        candidate.suggested_status = _STATUS[candidate.action]  # o estado decorre sempre da ação
        if _is_grounded(candidate, alert, facts):
            proposal = candidate
            break
    verified = proposal is not None
    final = proposal or _fallback(alert)
    return AlertSuggestionOut(
        **final.model_dump(),
        alert_id=alert.id,
        source="model" if verified else "fallback",
        verified=verified,
        prompt_version=version if verified else None,
        model=llm.model_for(AiTask.ALERT_RESOLUTION) if verified else None,
    )
