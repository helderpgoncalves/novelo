# ruff: noqa: E501
"""Relatório RAP em PDF: junta os dados do concelho, os cenários e a evidência por marca num documento HTML → PDF."""

import hashlib
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from novelo.core.errors import NotFoundError
from novelo.features.datasets.models import DataSource
from novelo.features.lots import service as lots
from novelo.features.network.models import Parish
from novelo.features.planning import service as planning
from novelo.features.planning.params import params_meta
from novelo.features.planning.schemas import ScenarioOut
from novelo.features.reports.texts import PARAM_LABELS, TEXTS
from novelo.features.textile import service as textile

_DIR = Path(__file__).parent
_ENV = Environment(loader=FileSystemLoader(_DIR / "templates"), autoescape=select_autoescape(["html"]))

_FIBRES = {
    "pt-PT": {"cotton": "Algodão", "wool": "Lã", "polyester": "Poliéster", "nylon": "Nylon", "viscose": "Viscose", "linen": "Linho",
              "acrylic": "Acrílico", "elastane": "Elastano", "silk": "Seda", "other": "Outra", "unknown": "Desconhecida"},
    "en": {"cotton": "Cotton", "wool": "Wool", "polyester": "Polyester", "nylon": "Nylon", "viscose": "Viscose", "linen": "Linen",
           "acrylic": "Acrylic", "elastane": "Elastane", "silk": "Silk", "other": "Other", "unknown": "Unknown"},
}  # fmt: skip


class Formatter:
    """Números no formato do idioma do relatório (vírgula decimal em pt-PT, sem dependências extra)."""

    def __init__(self, locale: str) -> None:
        self.pt = locale == "pt-PT"

    def num(self, value: float, digits: int = 0) -> str:
        text = f"{value:,.{digits}f}"  # 1,234.5
        if self.pt:
            text = text.replace(",", " ").replace(".", ",")
        return text

    def eur(self, value: float) -> str:
        return f"{self.num(value)} €"

    def pct(self, value: float, digits: int = 1) -> str:
        return f"{self.num(value, digits)}%"


def _territory_rows(
    scenario: ScenarioOut, tipau_by_code: dict[str, str | None], t: dict[str, str], f: Formatter
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    groups: dict[str, dict[str, float]] = defaultdict(
        lambda: dict.fromkeys(("parishes", "population", "demand", "tonnes", "cost"), 0.0)
    )
    for a in scenario.result.allocations:
        key = tipau_by_code.get(a.parish_code) or "unknown"
        g = groups[key]
        g["parishes"] += 1
        g["population"] += a.population
        g["demand"] += a.demand_t
        g["tonnes"] += a.tonnes
        g["cost"] += a.annual_cost_eur
    order = ["apu", "amu", "apr", "unknown"]

    def row(name: str, g: dict[str, float]) -> dict[str, Any]:
        return {
            "name": name,
            "parishes": int(g["parishes"]),
            "population": f.num(g["population"]),
            "demand": f.num(g["demand"], 1),
            "tonnes": f.num(g["tonnes"], 1),
            "cost": f.eur(g["cost"]),
            "eur_t": f"{f.num(g['cost'] / g['tonnes'])} €/t" if g["tonnes"] > 0 else "-",
        }

    rows = [row(t[f"tipau_{k}"], groups[k]) for k in order if k in groups]
    total = {k: sum(g[k] for g in groups.values()) for k in ("parishes", "population", "demand", "tonnes", "cost")}
    return rows, row(t["total"], total)


async def build_rap(db: AsyncSession, scenario_ids: list[Any], locale: str) -> tuple[str, bytes, dict[str, Any]]:
    t = TEXTS.get(locale, TEXTS["pt-PT"])
    f = Formatter(locale)
    scenarios = [await planning.get_scenario(db, sid) for sid in scenario_ids]
    if not scenarios:
        raise NotFoundError("No scenarios selected")
    baseline = await textile.get_baseline(db)
    parishes = (await db.execute(select(Parish.dicofre, Parish.tipau))).all()
    tipau_by_code = {code: (tipau.value if tipau else None) for code, tipau in parishes}

    scenario_views = []
    for s in scenarios:
        rows, total = _territory_rows(s, tipau_by_code, t, f)
        scenario_views.append(
            {"label": s.label, "objective": t[f"obj_{s.objective.value}"], "territory": rows, "territory_total": total}
        )

    def metrics(s: ScenarioOut) -> list[str]:
        k = s.result.kpis
        return [
            t[f"obj_{s.objective.value}"],
            f.num(k.tonnes_year, 1),
            f"{f.num(k.eur_per_tonne)} €/t" if k.eur_per_tonne is not None else "-",
            f.eur(k.annual_cost_eur),
            f.eur(k.capex_eur),
            f.pct(k.coverage_pct),
            f.num(k.points),
            f.num(k.km_year),
        ]

    labels = [
        t[k] for k in ("m_objective", "m_tonnes", "m_eur_t", "m_annual", "m_capex", "m_coverage", "m_points", "m_km")
    ]
    per_scenario = [metrics(s) for s in scenarios]
    comparison = [{"label": lab, "cells": [col[i] for col in per_scenario]} for i, lab in enumerate(labels)]
    best = min((s.result.kpis.eur_per_tonne for s in scenarios if s.result.kpis.eur_per_tonne), default=None)

    entities = [
        {
            "entity": e.entity, "total": f.num(e.total_t, 1), "method": e.method.value,
            "reuse_pct": f.pct(e.reuse_pct), "recycle_pct": f.pct(e.recycle_pct), "reject_pct": f.pct(e.reject_pct),
            "reuse_pct_raw": e.reuse_pct, "recycle_pct_raw": e.recycle_pct, "reject_pct_raw": e.reject_pct,
        }
        for e in baseline.entities
    ]  # fmt: skip
    totals = {k: f.pct(getattr(baseline, f"{k}_t") / baseline.total_t * 100) for k in ("reuse", "recycle", "reject")}

    market = await lots.market(db, None)
    fibres = [{"fibre": _FIBRES[locale][m.fibre.value], "lots": m.lots, "kg": f.num(m.weight_kg, 1)} for m in market]
    brands = await lots.brands(db)

    first = scenarios[0]
    origin = {m.key: t[f"src_{m.source.value}"] for m in params_meta()}
    flat = _flatten(first.params.model_dump(mode="json"))
    labels_map = PARAM_LABELS.get(locale, PARAM_LABELS["pt-PT"])
    assumptions = [
        {
            "label": labels_map[k],
            "value": f.pct(v * 100) if "rate" in k or "coverage" in k else f.num(v, 2),
            "origin": origin.get(k, ""),
        }
        for k, v in flat.items()
        if k in labels_map
    ]
    sources = [
        {
            "title": s.title, "file": s.file_name, "provider": s.provider,
            "period": f"{s.period_start} – {s.period_end}" if s.period_start and s.period_end else "-",
        }
        for s in (await db.execute(select(DataSource).order_by(DataSource.received_on))).scalars()
    ]  # fmt: skip

    html = _ENV.get_template("rap.html").render(
        t=t, locale=locale, fonts=(_DIR / "fonts").as_uri(), date=datetime.now(UTC).strftime("%d/%m/%Y" if f.pt else "%Y-%m-%d"),
        scenarios=scenario_views, comparison=comparison, entities=entities, totals=totals, fibres=fibres,
        potential_t=f.num(first.result.kpis.potential_t), collected_t=f.num(baseline.total_t, 1),
        capture_pct=f.num(baseline.capture_of_demand_pct, 1),
        best_eur_t=f"{f.num(best)} €/t" if best else "-",
        brands=[
            {"brand": b.brand, "items": b.items, "kg": f.num(b.weight_kg, 2), "share": f.pct(b.share_pct), "fibre": _FIBRES[locale][b.top_fibre.value]}
            for b in brands.brands[:12]
        ],
        brand_sample=brands.sample_items, assumptions=assumptions, sources=sources,
    )  # fmt: skip
    pdf = await run_in_threadpool(_render_pdf, html)
    summary = {
        "best_eur_per_tonne": best,
        "scenarios": [s.label for s in scenarios],
        "sha256": hashlib.sha256(pdf).hexdigest(),
    }
    return t["title"], pdf, summary


def _flatten(data: dict[str, Any], prefix: str = "") -> dict[str, float]:
    out: dict[str, float] = {}
    for key, value in data.items():
        path = f"{prefix}{key}"
        if isinstance(value, dict):
            out.update(_flatten(value, f"{path}."))
        elif isinstance(value, (int, float)):
            out[path] = float(value)
    return out


def _render_pdf(html: str) -> bytes:
    from weasyprint import HTML  # noqa: PLC0415  (importa tarde: precisa de bibliotecas do sistema)

    pdf: bytes = HTML(string=html, base_url=str(_DIR)).write_pdf()
    return pdf
