"""Linha de contexto do ecrã: construída no servidor a partir de ids reais, nunca do texto que o cliente envia."""

import re
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import AppError
from novelo.features.copilot import pages
from novelo.features.copilot.mentions import _num
from novelo.features.copilot.schemas import PageContext
from novelo.features.lots import service as lots
from novelo.features.planning import service as planning
from novelo.features.users.models import User

_SAFE = re.compile(r"^[\w .,\-/%]{1,40}$")
_FILTER_KEYS = frozenset({"fibre", "state", "parish", "mode", "objective", "typology", "status", "kind", "radius"})


def _uuid(value: str | None) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None


async def _scenario_line(db: AsyncSession, scenario_id: uuid.UUID, pt: bool) -> tuple[str, dict[str, Any]] | None:
    try:
        s = await planning.get_scenario(db, scenario_id)
    except AppError:
        return None
    k = s.result.kpis
    eur = f"{_num(k.eur_per_tonne, 1, pt)} €/t"
    unit = "t/ano" if pt else "t/yr"
    label = re.sub(r"\s+", " ", s.label)[:60]  # nomes são dados do utilizador: uma linha, curtos
    cost = f"{_num(k.annual_cost_eur, 0, pt)} €/{'ano' if pt else 'yr'}"
    line = f"«{label}» (scenario_id={s.id}) with {eur}, {_num(k.tonnes_year, 1, pt)} {unit}, {cost}, routing={s.result.routing}"
    facts = {
        "label": s.label,
        "eur_per_tonne": k.eur_per_tonne,
        "tonnes_per_year": k.tonnes_year,
        "annual_cost_eur": k.annual_cost_eur,
        "routing": s.result.routing,
    }
    return line, facts


async def page_context_line(
    db: AsyncSession, user: User, ctx: PageContext | None, locale: str
) -> tuple[str, list[dict[str, Any]]]:
    """('Screen: Scenario «A» with 122,7 €/t...', factos usados na linha). Vazio se não houver contexto válido."""
    if ctx is None:
        return "", []
    pt = locale != "en"
    page = pages.page_for_route(ctx.route)
    if page is None or (page.admin_only and user.role != "admin"):
        return "screen: (unrecognised screen)", []
    facts: list[dict[str, Any]] = []
    detail = ""
    if page.key == "scenario":
        found = await _scenario_line(db, _uuid(ctx.params.get("scenarioId")) or uuid.UUID(int=0), pt)
        if found:
            detail, f = found[0], found[1]
            facts.append(f)
    elif page.key == "lot":
        try:
            lot = await lots.get_lot(db, ctx.params.get("code", "")[:16])
            detail = f"lot {lot.code} ({lot.state.value}, {lot.dominant_fibre.value})"
            facts.append({"lot": lot.code, "items": lot.items, "weight_kg": lot.weight_kg})
        except AppError:
            detail = ""
    elif page.key in {"compare", "scenarios", "simulator"}:
        ids = [_uuid(v) for v in [*ctx.search.get("ids", "").split(","), *ctx.visible_entity_ids][:8]]
        names = []
        for sid in [i for i in dict.fromkeys(ids) if i][:4]:
            found = await _scenario_line(db, sid, pt)
            if found:
                names.append(found[0])
                facts.append(found[1])
        detail = "; ".join(names)
    filters = [f"{k}={v}" for k, v in ctx.selected_filters.items() if k in _FILTER_KEYS and _SAFE.match(v)][:4]
    parts = [page.label(locale), detail] if detail else [page.label(locale)]
    if filters:
        parts.append("filters: " + ", ".join(filters))
    return "screen: " + " — ".join(parts), facts
