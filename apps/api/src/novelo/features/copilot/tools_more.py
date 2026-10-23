"""Ferramentas de DADOS adicionais do copiloto: pressupostos, lacunas de dados, diferenças entre cenários, relatórios,
administração (só administradores) e tabelas derivadas (agrupar, somar, quota) para desenhar gráficos de qualquer consulta.

Mesma convenção de `tools_data`: cada resultado traz uma `table`; os números vêm da base de dados ou do otimizador.
"""

import uuid
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING, Any, Literal

from pydantic import BaseModel, Field

from novelo.core.errors import ForbiddenError
from novelo.features.audit import service as audit
from novelo.features.copilot.derive import DeriveArgs, DeriveError, derive_table
from novelo.features.copilot.tools_data import _A, Col, Empty, assumption_note, make_table
from novelo.features.datasets import service as datasets
from novelo.features.network import service as network
from novelo.features.planning import service as planning
from novelo.features.planning.params import params_meta
from novelo.features.reports import service as reports
from novelo.features.reports.texts import PARAM_LABELS
from novelo.features.textile import service as textile
from novelo.features.users import service as user_service

if TYPE_CHECKING:
    from novelo.features.copilot.tools import CopilotTools

ORIGIN = {
    "vitrus_data": "Dados reais da Vitrus (com a APA para o têxtil no RSU)",
    "assumption": "Pressuposto da equipa, a validar com a Vitrus (estimativa)",
}


class AssumptionsArgs(_A):
    source: Literal["vitrus_data", "assumption"] | None = Field(
        default=None, description="Filtrar pela origem do pressuposto"
    )


class ScenarioDiffArgs(_A):
    scenario_a: uuid.UUID = Field(description="Cenário de partida")
    scenario_b: uuid.UUID = Field(description="Cenário a comparar com o de partida")
    view: Literal["parishes", "modes"] = "parishes"
    limit: int = Field(default=12, ge=1, le=30)


class ReportsArgs(_A):
    limit: int = Field(default=10, ge=1, le=30)


class AuditArgs(_A):
    limit: int = Field(default=20, ge=1, le=50)
    action_prefix: str | None = Field(default=None, max_length=40, description="Ex.: `user.` ou `invitation.`")


# --- Pressupostos ----------------------------------------------------------------------------------


def _flatten(data: dict[str, Any], prefix: str = "") -> dict[str, float]:
    out: dict[str, float] = {}
    for key, value in data.items():
        if isinstance(value, dict):
            out.update(_flatten(value, f"{prefix}{key}."))
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            out[f"{prefix}{key}"] = float(value)
    return out


async def list_assumptions(box: "CopilotTools", args: AssumptionsArgs) -> dict[str, Any]:
    labels = PARAM_LABELS.get(box.locale, PARAM_LABELS["pt-PT"])
    params = await planning.get_parameters(box.db)
    values = _flatten(params.values.model_dump(mode="json"))
    rows = [
        {
            "key": m.key,
            "label": labels.get(m.key, m.key),
            "value": values.get(m.key),
            "unit": m.unit,
            "source": m.source.value,
            "origin": ORIGIN[m.source.value],
            "note": assumption_note(m.key, m.note),
        }
        for m in params_meta()
        if args.source is None or m.source.value == args.source
    ]
    cols: list[Col] = [
        ("label", "Pressuposto", "text", None),
        ("value", "Valor", "number", None),
        ("unit", "Unidade", "text", None),
        ("source", "Origem", "category", None),
        ("origin", "Fonte", "text", None),
        ("key", "Chave", "text", None),
        ("note", "Nota", "text", None),
    ]
    by_source = {s: sum(1 for r in rows if r["source"] == s) for s in ("vitrus_data", "assumption")}
    return {
        "version": params.version,
        "count": len(rows),
        "count_by_source": by_source,
        "note": "assumption = estimate to validate with Vitrus; vitrus_data = from Vitrus real data (and APA)",
        "table": make_table(
            "Pressupostos do simulador", "Parâmetros ativos (versão guardada)", cols, rows, estimate=True
        ),
        "_summary": f"{len(rows)} pressupostos",
    }


# --- Lacunas de dados ------------------------------------------------------------------------------


async def get_data_gaps(box: "CopilotTools", _: Empty) -> dict[str, Any]:
    """O que a plataforma ainda não sabe: lacunas medidas na base de dados, com o dado a pedir para as fechar."""
    db = box.db
    circuits = await network.list_circuits(db)
    fleet = await network.get_fleet(db)
    localities = await network.list_localities(db)
    baseline = await textile.get_baseline(db)
    quality = await datasets.get_quality(db)
    params = await planning.get_parameters(db)
    estimated_entities = [e.entity for e in baseline.entities if e.method.value != "weighed"]
    unmapped = sum(1 for x in localities if x.latitude is None)
    unassigned = sum(1 for v in fleet.vehicles if v.never_assigned)
    assumptions = sum(1 for m in params.meta if m.source.value == "assumption")
    rows: list[dict[str, Any]] = [
        {"area": "Rede de têxteis", "gap": "Têxtil realmente depositado por local, por canal e por mês", "count": None,
         "impact": "As capturas por modo são pressupostos e o modelo usa o total anual até haver piloto e pesagens",
         "ask": "Pesagens por local e por mês no piloto (a Vitrus só partilha os quilos por mês com o município)"},
        {"area": "Procura", "gap": "Têxtil no indiferenciado do concelho: média nacional da APA aplicada ao concelho", "count": None,
         "impact": "O potencial e a captura atual são estimativas, não medições",
         "ask": "Caracterização do indiferenciado de Guimarães, se existir"},
        {"area": "Recolha", "gap": "Circuitos sem viatura atribuída", "count": circuits.without_vehicle,
         "impact": "Não se sabe que veículo faz estes circuitos, o que afeta custo e rota",
         "ask": "Plano de viaturas por circuito"},
        {"area": "Frota", "gap": "Viaturas nunca atribuídas a um circuito", "count": unassigned,
         "impact": "Podem ser reserva ou dados em falta; limita a capacidade disponível",
         "ask": "Confirmar se são reserva"},
        {"area": "Localidades", "gap": "Localidades sem coordenadas", "count": unmapped,
         "impact": "Não entram no mapa nem nos cálculos de distância",
         "ask": "Coordenadas ou moradas completas"},
        {"area": "Destinos", "gap": "Entidades com destino calculado por percentagens (estimativa)",
         "count": len(estimated_entities),
         "impact": "Reutilização, reciclagem e rejeito dessas entidades são estimativas e não pesagens",
         "ask": "Pesagens por destino (kg) em vez de percentagens"},
        {"area": "Qualidade", "gap": "Alertas de qualidade dos dados em aberto", "count": quality.open_alerts,
         "impact": "Inconsistências nos ficheiros da Vitrus por resolver",
         "ask": "Rever e resolver os alertas"},
        {"area": "Simulador", "gap": "Pressupostos ainda não validados com a Vitrus", "count": assumptions,
         "impact": "Os resultados dos cenários dependem deles (ver a sensibilidade)",
         "ask": "Custo por hora e por quilómetro da viatura de têxtil (departamento financeiro da Vitrus), orçamento do veículo e capacidade"},
        {"area": "Rotas", "gap": "Dimensões e tipo da viatura nova: as rotas por estrada usam um perfil de furgoneta", "count": None,
         "impact": "Ruas estreitas e restrições de peso podem tornar uma rota menos viável do que o mapa diz",
         "ask": "Ficha técnica da viatura que a Vitrus vai adquirir"},
    ]  # fmt: skip
    cols: list[Col] = [
        ("area", "Área", "category", None),
        ("gap", "Lacuna", "text", None),
        ("count", "Quantidade", "number", None),
        ("impact", "Impacto", "text", None),
        ("ask", "Dado a pedir", "text", None),
    ]
    return {
        "textile_containers": "none: Vitrus has no textile containers and does not want them, so their locations are not a gap",
        "estimated_entities": estimated_entities,
        "table": make_table("Lacunas de dados da plataforma", "Base de dados do Novelo (contagens)", cols, rows),
        "_summary": f"{len(rows)} lacunas",
    }


# --- Diferença entre dois cenários -----------------------------------------------------------------


def _delta(a: float | None, b: float | None) -> float | None:
    return None if a is None or b is None else round(b - a, 2)


async def explain_scenario_difference(box: "CopilotTools", args: ScenarioDiffArgs) -> dict[str, Any]:
    a = await planning.get_scenario(box.db, args.scenario_a)
    b = await planning.get_scenario(box.db, args.scenario_b)
    head = {
        "scenario_a": a.label,
        "scenario_b": b.label,
        "difference_tonnes_per_year": _delta(a.tonnes_year, b.tonnes_year),
        "difference_annual_cost_eur": _delta(a.annual_cost_eur, b.annual_cost_eur),
        "difference_eur_per_tonne": _delta(a.eur_per_tonne, b.eur_per_tonne),
        "difference_investment_eur": _delta(a.capex_eur, b.capex_eur),
        "difference_coverage_pct": _delta(a.coverage_pct, b.coverage_pct),
    }
    if args.view == "modes":
        ma, mb = {m.mode.value: m for m in a.result.modes}, {m.mode.value: m for m in b.result.modes}
        rows = [
            {
                "mode": mode,
                "points_a": getattr(ma.get(mode), "points", 0),
                "points_b": getattr(mb.get(mode), "points", 0),
                "tonnes_a": getattr(ma.get(mode), "tonnes", 0.0),
                "tonnes_b": getattr(mb.get(mode), "tonnes", 0.0),
                "delta_tonnes": _delta(getattr(ma.get(mode), "tonnes", 0.0), getattr(mb.get(mode), "tonnes", 0.0)),
                "delta_cost_eur": _delta(
                    getattr(ma.get(mode), "annual_cost_eur", 0.0), getattr(mb.get(mode), "annual_cost_eur", 0.0)
                ),
            }
            for mode in sorted(set(ma) | set(mb))
        ]
        cols: list[Col] = [
            ("mode", "Modo", "category", None), ("points_a", "Pontos (A)", "number", None), ("points_b", "Pontos (B)", "number", None),
            ("tonnes_a", "Captado (A)", "number", "t/ano"), ("tonnes_b", "Captado (B)", "number", "t/ano"),
            ("delta_tonnes", "Diferença captado", "number", "t/ano"), ("delta_cost_eur", "Diferença de custo", "currency", "€"),
        ]  # fmt: skip
        return {
            **head,
            "table": make_table(
                f"{a.label} → {b.label}: por modo", "Otimizador (cenários guardados)", cols, rows, estimate=True
            ),
            "_summary": f"«{a.label}» vs «{b.label}»",
        }
    pa = {x.parish_code: x for x in a.result.allocations}
    pb = {x.parish_code: x for x in b.result.allocations}
    rows = []
    for code in sorted(set(pa) | set(pb)):
        x, y = pa.get(code), pb.get(code)
        # a 2 casas, como na tabela: a diferença mostrada é a das duas colunas mostradas
        ta, tb = round(x.tonnes if x else 0.0, 2), round(y.tonnes if y else 0.0, 2)
        ca, cb = (x.annual_cost_eur if x else 0.0), (y.annual_cost_eur if y else 0.0)
        mode_a = x.mode.value if x and x.mode else None
        mode_b = y.mode.value if y and y.mode else None
        if mode_a == mode_b and abs(tb - ta) < 0.005 and abs(cb - ca) < 0.5:
            continue
        rows.append(
            {
                "name": (y or x).parish_name if (y or x) else code,  # type: ignore[union-attr]
                "mode_a": mode_a,
                "mode_b": mode_b,
                "tonnes_a": ta,
                "tonnes_b": tb,
                "delta_tonnes": _delta(ta, tb),
                "cost_a": ca,
                "cost_b": cb,
                "delta_cost_eur": _delta(ca, cb),
            }
        )
    changed_mode = sum(1 for r in rows if r["mode_a"] != r["mode_b"])
    rows.sort(key=lambda r: -abs(float(r["delta_tonnes"] or 0.0)))
    cols = [
        ("name", "Freguesia", "text", None), ("mode_a", "Modo (A)", "category", None), ("mode_b", "Modo (B)", "category", None),
        ("tonnes_a", "Captado (A)", "number", "t/ano"), ("tonnes_b", "Captado (B)", "number", "t/ano"),
        ("delta_tonnes", "Diferença captado", "number", "t/ano"), ("cost_a", "Custo (A)", "currency", "€"),
        ("cost_b", "Custo (B)", "currency", "€"), ("delta_cost_eur", "Diferença de custo", "currency", "€"),
    ]  # fmt: skip
    return {
        **head,
        "parishes_compared": len(set(pa) | set(pb)),
        "parishes_that_differ": len(rows),
        "parishes_that_changed_mode": changed_mode,
        "table": make_table(
            f"{a.label} → {b.label}: freguesias que mudam",
            "Otimizador (cenários guardados)",
            cols,
            rows[: args.limit],
            estimate=True,
        ),
        "_summary": f"«{a.label}» vs «{b.label}»: {len(rows)} freguesias mudam",
    }


# --- Relatórios e administração --------------------------------------------------------------------


async def list_reports(box: "CopilotTools", args: ReportsArgs) -> dict[str, Any]:
    items = (await reports.list_reports(box.db))[: args.limit]
    rows = [
        {
            "title": r.title,
            "locale": r.locale,
            "scenarios": len(r.scenario_ids),
            "size_kb": round(r.size_bytes / 1024),
            "created_at": r.created_at.date().isoformat(),
            "download_path": f"/api/v1/reports/{r.id}/pdf",
        }
        for r in items
    ]
    cols: list[Col] = [
        ("title", "Relatório", "text", None),
        ("created_at", "Data", "date", None),
        ("locale", "Idioma", "category", None),
        ("scenarios", "Cenários", "number", None),
        ("size_kb", "Tamanho", "number", "kB"),
    ]
    return {
        "count": len(rows),
        "table": make_table("Relatórios RAP gerados", "Relatórios guardados", cols, rows),
        "_summary": f"{len(rows)} relatórios",
    }


def _need_admin(box: "CopilotTools", what: str) -> None:
    if box.user.role != "admin":
        raise ForbiddenError(f"Only administrators can read {what}")


async def get_user_stats(box: "CopilotTools", _: Empty) -> dict[str, Any]:
    """Contagens de contas por papel e estado (administradores). Nunca emails nem nomes."""
    _need_admin(box, "user statistics")
    users = await user_service.list_users(box.db)
    counts: dict[tuple[str, str, bool], int] = {}
    for u in users:
        key = (u.role, u.approval_status, bool(u.is_active))
        counts[key] = counts.get(key, 0) + 1
    rows = [
        {"role": r, "approval": s, "active": "sim" if act else "não", "accounts": n}
        for (r, s, act), n in sorted(counts.items())
    ]
    cols: list[Col] = [
        ("role", "Papel", "category", None),
        ("approval", "Aprovação", "category", None),
        ("active", "Ativa", "category", None),
        ("accounts", "Contas", "number", None),
    ]
    return {
        "accounts": len(users),
        "pending_approval": sum(1 for u in users if u.approval_status == "pending"),
        "table": make_table("Contas por papel e estado", "Utilizadores do Novelo", cols, rows),
        "_summary": f"{len(users)} contas",
    }


async def get_audit_log(box: "CopilotTools", args: AuditArgs) -> dict[str, Any]:
    """Últimas entradas da auditoria (administradores): ação, alvo e quando. Sem emails, IPs nem agentes de utilizador."""
    _need_admin(box, "the audit log")
    page = await audit.list_audit(box.db, offset=0, limit=args.limit, action=args.action_prefix)
    rows = [
        {
            "at": e.created_at.isoformat(timespec="minutes"),
            "action": e.action,
            "target_type": e.target_type or "",
            "impersonated": "sim" if e.effective_actor_id and e.effective_actor_id != e.actor_id else "não",
        }
        for e in page.items
    ]
    cols: list[Col] = [
        ("at", "Quando", "date", None),
        ("action", "Ação", "category", None),
        ("target_type", "Alvo", "category", None),
        ("impersonated", "Em nome de outra conta", "category", None),
    ]
    return {
        "total": page.total,
        "returned": len(rows),
        "table": make_table("Auditoria: últimas ações", "Registo de auditoria", cols, rows),
        "_summary": f"{page.total} entradas",
    }


# --- Tabelas derivadas -----------------------------------------------------------------------------


async def analyze_result(box: "CopilotTools", args: DeriveArgs) -> dict[str, Any]:
    """Agrupa, ordena, filtra ou calcula quotas de um resultado anterior; devolve uma nova tabela para desenhar."""
    found = box.find_result(args.result_id)
    if found is None:
        return {
            "error": "unknown_result_id",
            "message": f"No data result '{args.result_id}' in this conversation",
            "available": box.result_ids(),
        }
    try:
        table = derive_table(found["table"], args)
    except DeriveError as exc:
        return {"error": "invalid_derivation", "message": exc.message, "columns": exc.columns}
    return {
        "operation": args.operation,
        "from": args.result_id,
        "rows": len(table["rows"]),
        **({"total_value": table.pop("total_value")} if "total_value" in table else {}),
        "table": table,
        "_lineage": {
            "tool": found["tool"],
            "args": found["args"],
            "post": [*found.get("post", []), args.model_dump(mode="json")],
        },
        "_summary": f"{args.operation} de {args.result_id}: {len(table['rows'])} linhas",
    }


MORE_TOOLS: dict[str, tuple[type[BaseModel], str, Callable[[Any, Any], Awaitable[dict[str, Any]]]]] = {
    "list_assumptions": (
        AssumptionsArgs,
        "All simulator assumptions with value, unit, origin (Vitrus data or team assumption = estimate to validate) and a provenance note "
        "(e.g. the road calibration of the detour and speed, the vehicle costs still missing from Vitrus finance).",
        list_assumptions,
    ),
    "get_data_gaps": (
        Empty,
        "What the platform does NOT know yet, measured in the database (circuits without vehicle, unlocated localities, estimated "
        "destinations, open data-quality alerts, unvalidated assumptions such as the vehicle cost per hour and per km...) and the "
        "data to ask for. There are no textile containers, so their locations are never a gap.",
        get_data_gaps,
    ),
    "explain_scenario_difference": (
        ScenarioDiffArgs,
        "WHY two saved scenarios differ: per-parish changes of mode, tonnes and cost (or per mode), with computed differences. "
        "Use it to explain a comparison; never subtract yourself.",
        explain_scenario_difference,
    ),
    "list_reports": (ReportsArgs, "RAP reports already generated (title, date, scenarios, size).", list_reports),
    "get_user_stats": (
        Empty,
        "Account counts by role and approval state (administrators only, no personal data).",
        get_user_stats,
    ),
    "get_audit_log": (
        AuditArgs,
        "Latest audit entries: action, target type and time (administrators only; no emails, IPs or names).",
        get_audit_log,
    ),
    "analyze_result": (
        DeriveArgs,
        "Derive a NEW table from a previous result_id so you can chart any query: group (sum/mean/count/min/max/distinct by a "
        "column), top (sort and cut), filter, share (adds % of total). The server computes; then call show_chart on the new result_id.",
        analyze_result,
    ),
}
