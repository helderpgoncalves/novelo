"""Ferramentas de DADOS do copiloto: leem os services e devolvem factos + uma `table` tabular (base dos artefactos).

Convenção: cada resultado traz `table = {title, source, estimate, columns:[{key,label,type,unit}], rows:[{...}]}`. O servidor
dá-lhe um `result_id` e os gráficos/tabelas/mapas são construídos a partir dela, nunca a partir de números do modelo.
"""

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from novelo.core.errors import ForbiddenError
from novelo.domain.overview import pareto_ids
from novelo.domain.vocab import (
    Fibre,
    LotState,
    MunicipalKind,
    MunicipalStream,
    ProducerType,
    ScenarioObjective,
    Tipau,
    Typology,
)
from novelo.features.datasets import service as datasets
from novelo.features.lots import service as lots
from novelo.features.municipal import analytics as municipal_analytics
from novelo.features.municipal import service as municipal
from novelo.features.municipal.filters import SiteFilters
from novelo.features.network import service as network
from novelo.features.planning import service as planning
from novelo.features.planning.schemas import ScenarioRequest
from novelo.features.textile import service as textile

if TYPE_CHECKING:
    from novelo.features.copilot.tools import CopilotTools

Col = tuple[str, str, str, str | None]  # key, label, type, unit
WEEKDAY_NAMES = ("seg", "ter", "qua", "qui", "sex", "sáb", "dom")  # 1 = segunda ... 7 = domingo


class _A(BaseModel):
    model_config = ConfigDict(extra="forbid")


def make_table(
    title: str, source: str, cols: list[Col], rows: list[dict[str, Any]], estimate: bool = False
) -> dict[str, Any]:
    return {
        "title": title,
        "source": source,
        "estimate": estimate,
        "columns": [{"key": k, "label": lab, "type": t, "unit": u} for k, lab, t, u in cols],
        "rows": rows,
    }


# --- argumentos ------------------------------------------------------------------------------------


class Empty(_A):
    pass


class ParishesArgs(_A):
    tipau: Tipau | None = None
    limit: int = Field(default=60, ge=1, le=100)


class ScenarioDetailArgs(_A):
    scenario_id: uuid.UUID
    view: Literal["allocations", "modes", "routes"] = "allocations"


class CircuitsArgs(_A):
    typology: Typology | None = None
    limit: int = Field(default=60, ge=1, le=100)


class ParetoArgs(_A):
    budgets_eur_year: list[float] = Field(
        default_factory=lambda: [20000.0, 40000.0, 60000.0, 80000.0, 100000.0, 140000.0], min_length=3, max_length=8
    )


class LotsArgs(_A):
    state: LotState | None = None
    fibre: Fibre | None = None
    limit: int = Field(default=40, ge=1, le=100)


class LotHistoryArgs(_A):
    code: str = Field(max_length=16)


class AiUsageArgs(_A):
    days: int = Field(default=30, ge=1, le=365)
    group_by: Literal["day", "task", "model"] = "task"


class RobustnessArgs(_A):
    recommended_id: uuid.UUID
    alternative_id: uuid.UUID


class ParishMunicipalArgs(_A):
    parish: str | None = Field(
        default=None,
        min_length=1,
        max_length=80,
        description="Parish name (any accents/case) or its code. Omit to get the ranking of parishes by estimated textile gap.",
    )
    limit: int = Field(default=10, ge=1, le=48, description="Rows of the ranking when no parish is given")


class FindSitesArgs(_A):
    kind: MunicipalKind | None = None
    stream: MunicipalStream | None = None
    parish: str | None = Field(default=None, max_length=80, description="Parish name or code")
    producer_type: ProducerType | None = None
    textile_candidate: bool | None = None
    coord_suspect: bool | None = None
    query: str | None = Field(default=None, max_length=60, description="Street, parish or site id, no accents needed")
    limit: int = Field(default=15, ge=1, le=30)


class CandidatesArgs(_A):
    parish: str | None = Field(default=None, max_length=80, description="Parish name or code")
    precise_only: bool = False
    limit: int = Field(default=10, ge=1, le=30)


# --- ferramentas -----------------------------------------------------------------------------------


async def get_flows(box: "CopilotTools", _: Empty) -> dict[str, Any]:
    flows = await textile.get_observed_flows(box.db)
    labels = {n.id: n.label or n.destination or n.id for n in flows.nodes}
    rows = [
        {"source": str(labels[lk.source]), "target": str(labels[lk.target]), "tonnes": lk.tonnes} for lk in flows.links
    ]
    cols: list[Col] = [
        ("source", "Origem", "category", None),
        ("target", "Destino", "category", None),
        ("tonnes", "Toneladas", "number", "t"),
    ]
    return {
        "links": len(rows),
        "table": make_table("Fluxo observado 2025", "Dados da Vitrus", cols, rows),
        "_summary": f"{len(rows)} fluxos",
    }


async def list_parishes(box: "CopilotTools", args: ParishesArgs) -> dict[str, Any]:
    zones = [z for z in await planning.list_zones(box.db) if args.tipau is None or z.tipau == args.tipau]
    zones.sort(key=lambda z: -z.population)
    rows = [
        {"code": z.code, "name": z.name, "population": z.population, "demand_t": round(z.demand_t, 1), "tipau": z.tipau.value if z.tipau else None,
         "service_days": z.service_days, "lat": z.latitude, "lon": z.longitude}
        for z in zones[: args.limit]
    ]  # fmt: skip
    cols: list[Col] = [
        ("code", "Código", "text", None), ("name", "Freguesia", "text", None), ("population", "Habitantes", "number", "hab."),
        ("demand_t", "Potencial", "number", "t/ano"), ("tipau", "Tipologia", "category", None), ("service_days", "Dias com circuito", "number", "dias/sem."),
        ("lat", "Latitude", "number", None), ("lon", "Longitude", "number", None),
    ]  # fmt: skip
    return {
        "parishes": len(zones),
        "table": make_table("Freguesias", "INE (Censos 2021) e plano municipal", cols, rows, estimate=True),
        "_summary": f"{len(rows)} freguesias",
    }


async def get_scenario_detail(box: "CopilotTools", args: ScenarioDetailArgs) -> dict[str, Any]:
    s = await planning.get_scenario(box.db, args.scenario_id)
    rows: list[dict[str, Any]]
    if args.view == "modes":
        rows = [
            {
                "mode": m.mode.value,
                "zones": m.zones,
                "points": m.points,
                "tonnes": m.tonnes,
                "annual_cost_eur": m.annual_cost_eur,
            }
            for m in s.result.modes
        ]
        cols: list[Col] = [
            ("mode", "Modo", "category", None),
            ("zones", "Freguesias", "number", None),
            ("points", "Pontos", "number", None),
            ("tonnes", "Captado", "number", "t/ano"),
            ("annual_cost_eur", "Custo anual", "currency", "€"),
        ]
    elif args.view == "routes":
        rows = [
            {"vehicle": r.vehicle, "mode": r.mode.value, "stops": len(r.stops), "km": r.km, "load_t": r.load_t}
            for r in s.result.routes
        ]
        cols = [
            ("vehicle", "Viatura", "number", None),
            ("mode", "Modo", "category", None),
            ("stops", "Paragens", "number", None),
            ("km", "Distância", "number", "km"),
            ("load_t", "Carga", "number", "t"),
        ]
    else:
        rows = [
            {"code": a.parish_code, "name": a.parish_name, "mode": a.mode.value if a.mode else None, "tonnes": a.tonnes,
             "annual_cost_eur": a.annual_cost_eur, "demand_t": a.demand_t, "population": a.population}
            for a in sorted(s.result.allocations, key=lambda a: -a.tonnes)
        ]  # fmt: skip
        cols = [("code", "Código", "text", None), ("name", "Freguesia", "text", None), ("mode", "Modo", "category", None), ("tonnes", "Captado", "number", "t/ano"),
                ("annual_cost_eur", "Custo anual", "currency", "€"), ("demand_t", "Potencial", "number", "t/ano"), ("population", "Habitantes", "number", "hab.")]  # fmt: skip
    return {
        "scenario_id": str(s.id),
        "label": s.label,
        "view": args.view,
        "table": make_table(f"{s.label}: {args.view}", "Otimizador (cenário guardado)", cols, rows, estimate=True),
        "_summary": f"«{s.label}» · {args.view}",
    }


async def get_circuits(box: "CopilotTools", args: CircuitsArgs) -> dict[str, Any]:
    data = await network.list_circuits(box.db)
    items = [c for c in data.circuits if args.typology is None or c.typology == args.typology]
    rows = [{"code": c.code, "typology": c.typology.value, "collection_type": c.collection_type.value, "status": c.status.value,
             "localities": len(c.localities), "vehicles": len(c.vehicles), "days": len(c.weekdays),
             "weekdays": ", ".join(WEEKDAY_NAMES[d - 1] for d in sorted(c.weekdays) if 1 <= d <= 7)} for c in items[: args.limit]]  # fmt: skip
    cols: list[Col] = [("code", "Circuito", "text", None), ("typology", "Tipologia", "category", None), ("collection_type", "Tipo de recolha", "category", None),
                       ("status", "Estado", "category", None), ("localities", "Localidades", "number", None), ("vehicles", "Viaturas", "number", None), ("days", "Dias/semana", "number", None),
                       ("weekdays", "Dias em que passa", "text", None)]  # fmt: skip
    return {
        "total": data.total,
        "without_vehicle": data.without_vehicle,
        "vehicles": data.vehicles,
        "table": make_table("Circuitos", "Planeamento da Vitrus", cols, rows),
        "_summary": f"{len(rows)} circuitos",
    }


async def get_fleet(box: "CopilotTools", _: Empty) -> dict[str, Any]:
    fleet = await network.get_fleet(box.db)
    rows = [{"plate": v.plate, "assignments": v.assignments, "weekday_shifts": v.weekday_shifts, "circuits": len(v.circuits), "never_assigned": "sim" if v.never_assigned else "não"} for v in fleet.vehicles]  # fmt: skip
    cols: list[Col] = [("plate", "Matrícula", "text", None), ("assignments", "Atribuições", "number", None), ("weekday_shifts", "Turnos úteis", "number", None), ("circuits", "Circuitos", "number", None), ("never_assigned", "Nunca atribuída", "category", None)]  # fmt: skip
    return {
        "vehicles": len(rows),
        "table": make_table("Frota", "Planeamento da Vitrus", cols, rows),
        "_summary": f"{len(rows)} viaturas",
    }


async def get_localities(box: "CopilotTools", _: Empty) -> dict[str, Any]:
    items = await network.list_localities(box.db)
    rows = [{"code": x.name, "name": x.name, "parish_code": x.parish_code, "days_per_week": x.days_per_week, "circuits": len(x.circuits), "lat": x.latitude, "lon": x.longitude} for x in items]  # fmt: skip
    cols: list[Col] = [("name", "Localidade", "text", None), ("parish_code", "Freguesia", "text", None), ("days_per_week", "Dias/semana", "number", None), ("circuits", "Circuitos", "number", None), ("lat", "Latitude", "number", None), ("lon", "Longitude", "number", None)]  # fmt: skip
    return {
        "localities": len(rows),
        "table": make_table("Localidades", "Planeamento da Vitrus e OpenStreetMap", cols, rows),
        "_summary": f"{len(rows)} localidades",
    }


async def get_pareto_frontier(box: "CopilotTools", args: ParetoArgs) -> dict[str, Any]:
    """Cenários calculados em memória (não são guardados) a vários orçamentos; marca a fronteira de Pareto."""
    stored = await planning.ensure_default_parameters(box.db)
    from novelo.features.planning.schemas import PlanningParams  # noqa: PLC0415

    params = PlanningParams.model_validate(stored.values)
    zones = await planning.load_zone_rows(box.db, params.kg_per_inhab_month)
    baseline = await textile.get_baseline(box.db)

    def run() -> list[dict[str, Any]]:
        out = []
        for budget in sorted(set(args.budgets_eur_year)):
            req = ScenarioRequest(
                label="pareto", objective=ScenarioObjective.MAX_TONNES, budget_eur_year=budget, params=params
            )
            result, status = planning.compute(zones, params, req, baseline.total_t)
            k = result.kpis
            if status != "infeasible" and k.eur_per_tonne is not None:
                out.append(
                    {
                        "budget_eur_year": budget,
                        "tonnes": k.tonnes_year,
                        "annual_cost_eur": k.annual_cost_eur,
                        "eur_per_tonne": k.eur_per_tonne,
                    }
                )
        return out

    rows = await asyncio.to_thread(run)
    front = set(pareto_ids([(r["budget_eur_year"], r["eur_per_tonne"], r["tonnes"]) for r in rows]))
    for r in rows:
        r["frontier"] = "sim" if r["budget_eur_year"] in front else "não"
        r["label"] = f"{r['budget_eur_year']:.0f} €"
    cols: list[Col] = [("budget_eur_year", "Orçamento", "currency", "€/ano"), ("tonnes", "Captado", "number", "t/ano"), ("annual_cost_eur", "Custo anual", "currency", "€"),
                       ("eur_per_tonne", "Custo por tonelada", "currency", "€/t"), ("frontier", "Na fronteira", "category", None), ("label", "Etiqueta", "text", None)]  # fmt: skip
    return {
        "points": len(rows),
        "frontier_points": len(front),
        "table": make_table(
            "Fronteira de Pareto: €/t contra toneladas",
            "Otimizador (cenários calculados, não guardados)",
            cols,
            rows,
            estimate=True,
        ),
        "_summary": f"{len(rows)} pontos, {len(front)} na fronteira",
    }


async def get_robustness(box: "CopilotTools", args: RobustnessArgs) -> dict[str, Any]:
    from novelo.features.planning import sensitivity_service  # noqa: PLC0415

    out = await sensitivity_service.compare_robustness(
        box.db,
        args.recommended_id,
        args.alternative_id,
        n_samples=300,
        seed=7,
        swing=0.3,
        criterion="eur_per_tonne",
        min_share=0.8,
    )
    rows = [
        {"label": "Recomendado", "eur_per_tonne": out.base_recommended.eur_per_tonne},
        {"label": "Alternativo", "eur_per_tonne": out.base_alternative.eur_per_tonne},
    ]
    cols: list[Col] = [("label", "Cenário", "text", None), ("eur_per_tonne", "Custo por tonelada", "currency", "€/t")]
    data = out.model_dump(mode="json")
    return {
        **data,
        "share_recommended_better_pct": round(out.share_recommended_better * 100, 1),
        "swing_pct": round(out.swing * 100),
        "table": make_table("Robustez", "Monte Carlo (estimativa)", cols, rows, estimate=True),
        "_summary": f"melhor em {out.share_recommended_better * 100:.0f}% das amostras",
    }


async def get_lots(box: "CopilotTools", args: LotsArgs) -> dict[str, Any]:
    items = await lots.list_lots(box.db, args.fibre, args.state, None)
    rows = [{"code": x.code, "state": x.state.value, "fibre": x.dominant_fibre.value, "parish": x.parish_name, "items": x.items, "weight_kg": x.weight_kg} for x in items[: args.limit]]  # fmt: skip
    cols: list[Col] = [("code", "Lote", "text", None), ("state", "Estado", "category", None), ("fibre", "Fibra", "category", None), ("parish", "Freguesia", "text", None), ("items", "Peças", "number", None), ("weight_kg", "Peso", "number", "kg")]  # fmt: skip
    return {
        "lots": len(items),
        "table": make_table("Lotes", "Triagem Novelo", cols, rows),
        "_summary": f"{len(items)} lotes",
    }


async def get_fibre_market(box: "CopilotTools", _: Empty) -> dict[str, Any]:
    items = await lots.market(box.db, None)
    rows = [{"fibre": m.fibre.value, "lots": m.lots, "weight_kg": m.weight_kg} for m in items]
    cols: list[Col] = [
        ("fibre", "Fibra", "category", None),
        ("lots", "Lotes", "number", None),
        ("weight_kg", "Peso", "number", "kg"),
    ]
    return {
        "fibres": len(rows),
        "table": make_table("Bolsa de fibra", "Lotes triados", cols, rows),
        "_summary": f"{len(rows)} fibras",
    }


async def get_brands(box: "CopilotTools", _: Empty) -> dict[str, Any]:
    data = await lots.brands(box.db)
    rows = [
        {
            "brand": b.brand,
            "items": b.items,
            "weight_kg": b.weight_kg,
            "share_pct": b.share_pct,
            "top_fibre": b.top_fibre.value,
        }
        for b in data.brands[:30]
    ]
    cols: list[Col] = [("brand", "Marca", "text", None), ("items", "Peças", "number", None), ("weight_kg", "Peso", "number", "kg"), ("share_pct", "Do total", "percent", "%"), ("top_fibre", "Fibra principal", "category", None)]  # fmt: skip
    return {
        "sample_items": data.sample_items,
        "total_kg": data.total_kg,
        "table": make_table(
            "Evidência por marca", "Peças triadas (amostra pequena: cautela)", cols, rows, estimate=True
        ),
        "_summary": f"{len(rows)} marcas",
    }


async def get_lot_history(box: "CopilotTools", args: LotHistoryArgs) -> dict[str, Any]:
    lot = await lots.get_lot(box.db, args.code)
    rows = [
        {"at": e.occurred_at.isoformat(timespec="minutes"), "label": e.kind.value, "detail": e.note} for e in lot.events
    ]
    cols: list[Col] = [
        ("at", "Quando", "date", None),
        ("label", "Evento", "category", None),
        ("detail", "Nota", "text", None),
    ]
    return {
        "code": lot.code,
        "state": lot.state.value,
        "table": make_table(f"Lote {lot.code}", "Histórico do lote", cols, rows),
        "_summary": f"{len(rows)} eventos",
    }


async def get_quality_alerts(box: "CopilotTools", _: Empty) -> dict[str, Any]:
    q = await datasets.get_quality(box.db)
    rows = [
        {"id": str(a.id), "number": a.number, "kind": a.kind.value, "status": a.status.value, "detail": a.detail[:140]}
        for a in q.alerts
    ]
    cols: list[Col] = [("number", "Nº", "number", None), ("kind", "Tipo", "category", None), ("status", "Estado", "category", None), ("detail", "Descrição", "text", None), ("id", "Id", "text", None)]  # fmt: skip
    return {
        "open_alerts": q.open_alerts,
        "alerts": len(rows),
        "table": make_table("Alertas de qualidade dos dados", "Dados da Vitrus", cols, rows),
        "_summary": f"{q.open_alerts} em aberto",
    }


async def get_ai_usage(box: "CopilotTools", args: AiUsageArgs) -> dict[str, Any]:
    if box.user.role != "admin":
        raise ForbiddenError("Only administrators can read AI usage")
    from novelo.features.ai_admin import service as ai_admin  # noqa: PLC0415

    u = await ai_admin.usage_report(box.db, args.days)
    if args.group_by == "day":
        rows: list[dict[str, Any]] = [
            {"key": d.day.isoformat(), "calls": d.calls, "cost_usd": d.cost_usd} for d in u.by_day
        ]
    else:
        groups = u.by_task if args.group_by == "task" else u.by_model
        rows = [
            {
                "key": (g.task if args.group_by == "task" else g.model) or "",
                "calls": g.calls,
                "cost_usd": g.cost_usd,
                "avg_latency_ms": g.avg_latency_ms,
            }
            for g in groups
        ]
    cols: list[Col] = [
        ("key", args.group_by, "category", None),
        ("calls", "Chamadas", "number", None),
        ("cost_usd", "Custo", "currency", "US$"),
    ]
    return {
        "month_spent_usd": u.month.spent_usd,
        "month_budget_usd": u.month.monthly_budget_usd,
        "total_cost_usd": u.totals.cost_usd,
        "table": make_table("Consumo de IA", "ai_usage", cols, rows),
        "_summary": f"{u.totals.calls} chamadas",
    }


# --- rede MUNICIPAL (outras frações; nunca é a rede de têxteis; sem nomes de produtores, nem para admins) -----------

MUNICIPAL_NOTE = (
    "Municipal containers of OTHER fractions (not textile): useful only as possible places for textile points."
)


async def get_municipal_overview(box: "CopilotTools", _: Empty) -> dict[str, Any]:
    o = await municipal_analytics.get_overview(box.db)
    rows = [{"kind": k.kind.value, "containers": k.containers, "located": k.located, "capacity_litres": k.capacity_litres_total} for k in o.by_kind]  # fmt: skip
    cols: list[Col] = [("kind", "Tipo", "category", None), ("containers", "Contentores", "number", None), ("located", "Com coordenadas", "number", None), ("capacity_litres", "Capacidade", "number", "L")]  # fmt: skip
    return {
        "network": "municipal",
        "is_textile_network": False,
        "note": MUNICIPAL_NOTE,
        "per_inhabitants": 1000,  # "por 1 000 habitantes" é uma unidade: o verificador tem de a conhecer
        "containers": o.containers.model_dump(exclude={"brands"}),
        "sites": o.sites.model_dump(),
        "density": o.density.model_dump(),
        "coverage_of_area_estimate": o.coverage.model_dump(),
        "quality": o.quality.model_dump(),
        "estimate_note": o.estimates.note,
        "table": make_table("Contentores municipais por tipo", "Pacote QGIS da Vitrus (outras frações)", cols, rows),
        "_summary": f"{o.containers.located} contentores, {o.sites.total} locais",
    }


async def _resolve_parish(box: "CopilotTools", text: str) -> tuple[str | None, dict[str, Any] | None]:
    found, suggestions = await municipal.find_parish(box.db, text)
    if found is None:
        return None, {"error": "unknown_parish", "unknown": [text], "suggestions": suggestions}
    return found.dicofre, None


async def _gap_ranking(box: "CopilotTools", limit: int) -> dict[str, Any]:
    out = await municipal_analytics.gap_ranking(box.db, limit=limit)
    rows = [{"rank": r.rank, "name": r.name, "population": r.population, "containers": r.containers, "candidate_sites": r.candidate_sites,
             "textile_gap_t": r.textile_gap_t, "gap_t_per_candidate_site": r.gap_t_per_candidate_site} for r in out.items]  # fmt: skip
    cols: list[Col] = [("rank", "Ordem", "number", None), ("name", "Freguesia", "text", None), ("population", "Habitantes", "number", "hab."), ("containers", "Contentores municipais", "number", None),
                       ("candidate_sites", "Locais candidatos", "number", None), ("textile_gap_t", "Lacuna estimada", "number", "t/ano"), ("gap_t_per_candidate_site", "Lacuna por candidato", "number", "t/ano")]  # fmt: skip
    return {
        "network": "municipal",
        "is_textile_network": False,
        "is_estimate": True,
        "rule": out.rule,
        "capture_pct_assumed_for_every_parish": out.parameters.capture_pct,
        "kg_per_inhab_month": out.parameters.kg_per_inhab_month,
        "caveat": out.caveat,
        "table": make_table("Freguesias por lacuna estimada de têxtil", "Estimativa: captura média do concelho igual em todas", cols, rows, estimate=True),
        "_summary": f"{len(rows)} freguesias",
    }  # fmt: skip


async def get_parish_municipal(box: "CopilotTools", args: ParishMunicipalArgs) -> dict[str, Any]:
    if args.parish is None:
        return await _gap_ranking(box, args.limit)
    found, suggestions = await municipal.find_parish(box.db, args.parish)
    if found is None:
        return {"error": "unknown_parish", "unknown": [args.parish], "suggestions": suggestions}
    p = found
    rows = [{"kind": k, "containers": n} for k, n in p.by_kind.model_dump().items()]
    cols: list[Col] = [("kind", "Tipo", "category", None), ("containers", "Contentores", "number", None)]
    return {
        "network": "municipal",
        "is_textile_network": False,
        "per_inhabitants": 1000,
        "name": p.name,
        "population": p.population,
        "area_km2": p.area_km2,
        "containers": p.containers,
        "containers_pending": p.containers_pending,
        "sites": p.sites,
        "public_sites": p.public_sites,
        "containers_per_1000_hab": p.containers_per_1000_hab,
        "public_sites_per_1000_hab": p.public_sites_per_1000_hab,
        "containers_per_km2": p.containers_per_km2,
        "mean_nn_distance_m": p.mean_nn_distance_m,
        "cover_pct_300m_of_area_estimate": p.cover_pct_300m,
        "producer_containers": p.producers.model_dump(),
        "candidate_sites": p.candidate_sites,
        "candidate_sites_precise": p.candidate_sites_precise,
        "textile_potential_t_estimate": p.textile_potential_t,
        "textile_gap_t_estimate": p.textile_gap_t,
        "gap_t_per_candidate_site_estimate": p.gap_t_per_candidate_site,
        "gap_rank_estimate": p.gap_rank,
        "estimate_note": municipal.PARISH_ESTIMATES.note,
        "table": make_table(f"{p.name}: contentores municipais por tipo", "Pacote QGIS da Vitrus (outras frações)", cols, rows),
        "_summary": f"{p.name}: {p.containers} contentores",
    }  # fmt: skip


async def find_municipal_sites(box: "CopilotTools", args: FindSitesArgs) -> dict[str, Any]:
    parish: list[str] = []
    if args.parish:
        code, error = await _resolve_parish(box, args.parish)
        if error:
            return error
        parish = [code] if code else []
    filters = SiteFilters(
        kind=[args.kind] if args.kind else [],
        stream=[args.stream] if args.stream else [],
        parish=parish,
        producer_type=[args.producer_type] if args.producer_type else [],
        textile_candidate=args.textile_candidate,
        coord_suspect=args.coord_suspect,
        q=args.query,
        search_names=False,
    )
    page = await municipal.list_sites(box.db, filters, limit=args.limit, cursor=None, names=False)
    rows = [{"site_id": s.site_id, "parish": s.parish_name, "site_class": s.site_class.value, "containers": s.containers,
             "kinds": ", ".join(k.value for k in s.kinds), "streets": "; ".join(s.streets[:2]), "textile_candidate": "sim" if s.textile_candidate else "não",
             "coord_precision": s.coord_precision.value, "nn_distance_m": s.nn_distance_m, "lat": s.latitude, "lon": s.longitude} for s in page.items]  # fmt: skip
    cols: list[Col] = [("site_id", "Local", "text", None), ("parish", "Freguesia", "text", None), ("site_class", "Classe", "category", None), ("containers", "Contentores", "number", None),
                       ("kinds", "Tipos", "text", None), ("streets", "Ruas", "text", None), ("textile_candidate", "Candidato a têxteis", "category", None),
                       ("coord_precision", "Coordenada", "category", None), ("nn_distance_m", "Vizinho mais próximo", "number", "m"), ("lat", "Latitude", "number", None), ("lon", "Longitude", "number", None)]  # fmt: skip
    return {
        "network": "municipal",
        "is_textile_network": False,
        "total": page.total,
        "returned": len(rows),
        "producer_names": "not shown",
        "table": make_table("Locais da rede municipal", "Pacote QGIS da Vitrus (outras frações)", cols, rows),
        "_summary": f"{page.total} locais",
    }


async def get_textile_candidates(box: "CopilotTools", args: CandidatesArgs) -> dict[str, Any]:
    parish: list[str] = []
    if args.parish:
        code, error = await _resolve_parish(box, args.parish)
        if error:
            return error
        parish = [code] if code else []
    out = await municipal.textile_candidates(
        box.db, SiteFilters(parish=parish), precise_only=args.precise_only, limit=args.limit, cursor=None, names=False
    )
    rows = [{"rank": c.rank, "site_id": c.site.site_id, "parish": c.site.parish_name, "containers": c.site.containers,
             "reasons": "; ".join(c.reasons), "coord_precision": c.site.coord_precision.value,
             "parish_gap_t_per_candidate": c.parish_gap_t_per_candidate, "lat": c.site.latitude, "lon": c.site.longitude} for c in out.items]  # fmt: skip
    cols: list[Col] = [("rank", "Ordem", "number", None), ("site_id", "Local", "text", None), ("parish", "Freguesia", "text", None), ("containers", "Contentores", "number", None),
                       ("reasons", "Razões", "text", None), ("coord_precision", "Coordenada", "category", None), ("parish_gap_t_per_candidate", "Lacuna da freguesia por candidato", "number", "t/ano"),
                       ("lat", "Latitude", "number", None), ("lon", "Longitude", "number", None)]  # fmt: skip
    return {
        "network": "municipal",
        "is_textile_network": False,
        "is_estimate": True,
        "total": out.total,
        "total_precise": out.total_precise,
        "returned": len(rows),
        "rank_rule": out.rank_rule,
        "note": "Possible places, not recommendations: the choice depends on space, traffic and the textile points Vitrus already has.",
        "table": make_table("Locais candidatos a pontos de têxteis", "Rede municipal da Vitrus; ordem por regra explícita (estimativa)", cols, rows, estimate=True),
        "_summary": f"{out.total} candidatos",
    }  # fmt: skip


DATA_TOOLS: dict[str, tuple[type[BaseModel], str, Callable[[Any, Any], Awaitable[dict[str, Any]]]]] = {
    "get_flows": (
        Empty,
        "Observed 2025 flow links entity -> destination in tonnes. Only for a sankey/flow diagram; for totals use get_baseline.",
        get_flows,
    ),
    "list_parishes": (ParishesArgs, "Parishes with population, potential, typology and coordinates.", list_parishes),
    "get_scenario_detail": (
        ScenarioDetailArgs,
        "A saved scenario in detail: per-parish allocations, per-mode totals or routes.",
        get_scenario_detail,
    ),
    "get_circuits": (
        CircuitsArgs,
        "Vitrus collection circuits (typology, status, localities, vehicles, days).",
        get_circuits,
    ),
    "get_fleet": (Empty, "Vitrus vehicles and how many shifts/circuits each has.", get_fleet),
    "get_localities": (Empty, "Localities served by circuits, with coordinates.", get_localities),
    "get_pareto_frontier": (
        ParetoArgs,
        "Compute (not saved) scenarios at several budgets and mark the Pareto frontier of cost per tonne vs tonnes.",
        get_pareto_frontier,
    ),
    "get_robustness": (
        RobustnessArgs,
        "How often the recommended scenario beats the alternative under uncertainty.",
        get_robustness,
    ),
    "get_lots": (LotsArgs, "Sorted lots (state, fibre, parish, items, weight).", get_lots),
    "get_fibre_market": (Empty, "Fibre market: lots and weight by dominant fibre.", get_fibre_market),
    "get_brands": (Empty, "Brand evidence from sorted items (small sample: say so).", get_brands),
    "get_lot_history": (LotHistoryArgs, "Event history (timeline) of one lot.", get_lot_history),
    "get_quality_alerts": (Empty, "Data-quality alerts found in the Vitrus files, with status.", get_quality_alerts),
    "get_ai_usage": (AiUsageArgs, "AI usage and cost (administrators only).", get_ai_usage),
    "get_municipal_overview": (
        Empty,
        "Municipal container network (OTHER fractions, NOT textile): containers, sites, density per 1000 inhabitants, area coverage (estimate) and data quality.",
        get_municipal_overview,
    ),
    "get_parish_municipal": (
        ParishMunicipalArgs,
        "Municipal containers of ONE parish (not textile): density, nearest-neighbour distance, producers by type, candidate sites and the estimated textile gap with its rank. Without a parish: ranking of parishes by estimated textile gap.",
        get_parish_municipal,
    ),
    "find_municipal_sites": (
        FindSitesArgs,
        "Find municipal sites (not textile) by container kind, fraction, parish, producer type, textile-candidate flag, suspect coordinates or text. Never returns producer names.",
        find_municipal_sites,
    ),
    "get_textile_candidates": (
        CandidatesArgs,
        "Municipal sites that could host textile points (streets with a municipal container), ranked by an explicit rule, with reasons. Possible places, not recommendations.",
        get_textile_candidates,
    ),
}
