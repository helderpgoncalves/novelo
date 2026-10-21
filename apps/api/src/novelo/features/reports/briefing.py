"""Briefing executivo do relatório RAP: um parágrafo com números verificados e, sem IA, um texto determinístico."""

import json
import logging
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, Field

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.prompts import load
from novelo.ai.tasks import AiTask
from novelo.ai.verify import unsupported_rounded
from novelo.features.planning.schemas import ScenarioOut
from novelo.features.textile.schemas import TextileBaseline

log = logging.getLogger("novelo.briefing")


class _Briefing(BaseModel):
    text: str = Field(min_length=40, max_length=1200)


@dataclass(frozen=True)
class Briefing:
    text: str
    source: Literal["ai", "fallback"]
    prompt_version: str | None


def _num(value: float | None, digits: int, pt: bool) -> str | None:
    if value is None:
        return None
    text = f"{value:,.{digits}f}"
    return text.replace(",", " ").replace(".", ",") if pt else text


def build_facts(scenarios: list[ScenarioOut], baseline: TextileBaseline, locale: str) -> dict[str, Any]:
    """Factos já formatados no idioma do relatório: o modelo copia-os, não os calcula."""
    pt = locale == "pt-PT"

    def n(value: float | None, digits: int = 0) -> str | None:
        return _num(value, digits, pt)

    return {
        "language": locale,
        "baseline_2025": {
            "year": baseline.year,
            "collected_t": n(baseline.total_t, 1),
            "capture_of_potential_pct": n(baseline.capture_of_demand_pct, 1),
            "estimated_potential_t_per_year": n(baseline.estimated_demand_t, 0),
            "still_to_divert_t_per_year": n(baseline.gap_t, 0),
            "potential_source": "Vitrus 2025 RSU × APA textile share (estimate)"
            if not pt
            else "RSU da Vitrus em 2025 × percentagem de têxtil da APA (estimativa)",
            "reuse_t": n(baseline.reuse_t, 1),
            "recycle_t": n(baseline.recycle_t, 1),
            "reject_t": n(baseline.reject_t, 1),
        },
        "scenarios": [
            {
                "name": s.label,
                "tonnes_per_year": n(s.result.kpis.tonnes_year, 1),
                "eur_per_tonne": n(s.result.kpis.eur_per_tonne, 0),
                "annual_cost_eur": n(s.result.kpis.annual_cost_eur, 0),
                "investment_eur": n(s.result.kpis.capex_eur, 0),
                "coverage_pct": n(s.result.kpis.coverage_pct, 1),
            }
            for s in scenarios
        ],
    }


def fallback_text(facts: dict[str, Any]) -> str:
    """Sem IA: frases fixas preenchidas só com os factos."""
    b = facts["baseline_2025"]
    first = facts["scenarios"][0]
    collected, capture, potential = b["collected_t"], b["capture_of_potential_pct"], b["estimated_potential_t_per_year"]
    name, tonnes, eur_t, cost = (
        first["name"],
        first["tonnes_per_year"],
        first["eur_per_tonne"],
        first["annual_cost_eur"],
    )
    if facts["language"] == "en":
        return (
            f"In 2025, {collected} t of textiles were collected in Guimarães, {capture}% of the estimated "
            f"textile generated, {potential} t per year (Vitrus and APA). "
            f'Scenario "{name}" captures {tonnes} t per year at {eur_t} €/t, '
            f"with an annual cost of {cost} €. Projected values are estimates based on the stated assumptions."
        )
    return (
        f"Em 2025 recolheram-se {collected} t de têxtil em Guimarães, {capture}% do têxtil gerado, estimado em "
        f"{potential} t por ano (Vitrus e APA). "
        f'O cenário "{name}" capta {tonnes} t por ano a {eur_t} €/t, com um custo anual '
        f"de {cost} €. Os valores previstos são estimativas assentes nos pressupostos indicados."
    )


async def executive_briefing(llm: OpenRouterClient | None, facts: dict[str, Any]) -> Briefing:
    """Um parágrafo escrito pelo modelo e verificado contra os factos; qualquer falha cai para o texto fixo."""
    if llm is not None:
        system, version = load("briefing")
        for _ in range(2):
            try:
                out = await llm.structured(
                    system=system,
                    user=json.dumps(facts, ensure_ascii=False),
                    schema=_Briefing,
                    task=AiTask.BRIEFING,
                )
            except Exception as exc:  # sem chave, orçamento esgotado ou fornecedor em baixo: o relatório sai na mesma
                log.info("briefing falls back to the deterministic text reason=%s", type(exc).__name__)
                break
            if not unsupported_rounded(out.text, facts):
                return Briefing(" ".join(out.text.split()), "ai", version)
    return Briefing(fallback_text(facts), "fallback", None)
