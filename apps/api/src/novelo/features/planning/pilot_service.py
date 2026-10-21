"""Piloto de 3 meses: escolhe as freguesias com mais valor de aprendizagem e prevê os KPIs a medir."""

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import ConflictError
from novelo.domain import network, pilot
from novelo.domain.vocab import Tipau
from novelo.features.network.models import Parish
from novelo.features.planning import service
from novelo.features.planning.params import to_domain_zone
from novelo.features.planning.pilot_schemas import (
    PilotFact,
    PilotKpiOut,
    PilotOut,
    PilotRequest,
    PilotScoreOut,
    PilotZoneOut,
    SignalFloorOut,
)
from novelo.features.planning.schemas import ZoneOut
from novelo.features.textile import service as textile
from novelo.features.textile.references import KG_PER_INHAB_MONTH

SRC_CENSUS = "INE, Censos 2021"
SRC_AREA = "INE/CAOP: população / área da freguesia"
SRC_CIRCUITS = "Vitrus: circuitos atuais"
SRC_COST = "Modelo de custos (pressuposto, estimativa)"
SRC_REJECT = "Vitrus: destino do recolhido em 2025"
TIPAU_LABEL = {
    Tipau.APU: "predominantemente urbana",
    Tipau.AMU: "mediamente urbana",
    Tipau.APR: "predominantemente rural",
}


def _n(x: float, decimals: int = 0) -> str:
    """Número em pt-PT: espaço fino nos milhares e vírgula decimal."""
    s = f"{x:,.{decimals}f}"
    return s.replace(",", " ").replace(".", ",")


SRC_MODEL = (
    f"Modelo: população × {_n(KG_PER_INHAB_MONTH, 3)} kg/hab/mês de têxtil que vai para o lixo "
    "(Vitrus: 43 051 t de RSU em 2025 × 5,4% da APA)"
)


def _facts(s: pilot.CandidateScore, z: ZoneOut, demand_t: float) -> list[PilotFact]:
    c = s.candidate
    facts = [PilotFact(key="population", value=z.population, unit="hab", source=SRC_CENSUS)]
    if c.density is not None and c.area_km2 is not None:
        facts.append(PilotFact(key="density", value=round(c.density, 1), unit="hab/km²", source=SRC_AREA))
    facts += [
        PilotFact(key="service_days", value=z.service_days, unit="dias/semana", source=SRC_CIRCUITS),
        PilotFact(key="demand_t", value=round(demand_t, 1), unit="t/ano", source=SRC_MODEL),
        PilotFact(key="startup_cost_eur", value=round(s.startup_cost_eur), unit="€", source=SRC_COST),
    ]
    return facts


def _rationale(sel: pilot.PilotSelection, months: int, zones: dict[str, ZoneOut]) -> list[str]:
    parts = []
    for s in sel.chosen:
        c = s.candidate
        z = zones[c.zone.id]
        tipau = TIPAU_LABEL.get(c.tipau) if c.tipau else None
        dens = f", {_n(c.density)} hab/km²" if c.density is not None else ""
        circuit = (
            f"circuito {z.service_days} dia(s)/semana"
            if z.service_days
            else "sem circuito da Vitrus (a pedido custa km novos)"
        )
        parts.append(
            f"{z.name}: {_n(z.population)} hab{dens}"
            f"{f', {tipau}' if tipau else ''}, {circuit}, arranque de {_n(s.startup_cost_eur)} € em {months} meses."
        )
    mix = (
        "Cobre territórios diferentes do INE (TIPAU), o que mostra se o resultado depende do contexto."
        if sel.tipau_diversity > 0
        else "Os escolhidos são do mesmo tipo de território: a mistura urbano/rural cedeu a custo ou cobertura."
    )
    return [
        *parts,
        mix,
        f"Pontuação de aprendizagem {_n(sel.score, 2)} em 1 (pesos: território {_n(sel.weights.tipau, 2)}, "
        f"densidade {_n(sel.weights.density, 2)}, circuitos {_n(sel.weights.coverage, 2)}, "
        f"custo {_n(sel.weights.cost, 2)}; pressuposto da equipa).",
    ]


def _floor_out(
    body: PilotRequest, floor: pilot.RejectFloor, sel: pilot.PilotSelection, min_tonnes: float
) -> SignalFloorOut:
    src = "Cálculo (estimativa)"
    calc = [
        PilotFact(key="reject_share_pct", value=round(floor.reject_share * 100, 1), unit="%", source=SRC_REJECT),
        PilotFact(
            key="half_width_pp", value=floor.half_width * 100, unit="p.p.", source="Critério: IC útil (pressuposto)"
        ),
        PilotFact(key="z", value=floor.z, unit="", source="IC a 95%"),
        PilotFact(
            key="design_effect", value=floor.design_effect, unit="x", source="Ensaio por conglomerados (pressuposto)"
        ),
        PilotFact(key="pieces_per_cell", value=floor.pieces_per_cell, unit="peças", source=src),
        PilotFact(key="piece_kg", value=floor.piece_kg, unit="kg", source="Peso médio por tipo de peça (pressuposto)"),
        PilotFact(key="tonnes_per_cell", value=round(floor.tonnes_per_cell, 3), unit="t", source=src),
        PilotFact(
            key="cells", value=floor.cells, unit="freguesia × modo", source=f"k = {body.k}, {len(body.modes)} modos"
        ),
    ]
    explanation = (
        f"Para medir a taxa de rejeito ({_n(floor.reject_share * 100, 1)}%) com ±{_n(floor.half_width * 100)} p.p. "
        f"(95%) em cada freguesia e modo são precisas {_n(floor.pieces_per_cell)} peças "
        f"(1,96² × p(1−p) / {_n(floor.half_width, 2)}² × {_n(floor.design_effect)}) = "
        f"{_n(floor.tonnes_per_cell, 3)} t por célula; {floor.cells} células dão {_n(floor.tonnes, 2)} t."
        if min_tonnes == floor.tonnes
        else f"Piso imposto no pedido: {_n(min_tonnes, 2)} t."
    )
    explanation += (
        f" Das {_n(sel.combos_total)} combinações, {_n(sel.combos_below_floor)} ficam abaixo de {_n(min_tonnes, 2)} t "
        f"em {body.months} meses e foram descartadas."
    )
    if not sel.floor_met:
        explanation += (
            " Nenhuma atinge o piso: devolvida a de mais toneladas; o piloto não mede a taxa de rejeito com esse rigor."
        )
    return SignalFloorOut(
        min_tonnes_pilot=round(min_tonnes, 3),
        computed=body.min_tonnes_pilot is None,
        tonnes_pilot=round(sel.tonnes, 3),
        floor_met=sel.floor_met,
        combos_total=sel.combos_total,
        combos_below_floor=sel.combos_below_floor,
        calculation=calc,
        explanation=explanation,
    )


def _recommend(
    zones: list[ZoneOut],
    areas: dict[str, float | None],
    params: network.Params,
    reject_share: float,
    body: PilotRequest,
) -> PilotOut:
    by_code = {z.code: z for z in zones}
    candidates = [
        pilot.PilotCandidate(
            to_domain_zone(z),
            z.tipau,
            areas.get(z.code),
        )
        for z in zones
    ]
    floor = pilot.reject_rate_floor(reject_share, cells=body.k * len(body.modes))
    min_tonnes = floor.tonnes if body.min_tonnes_pilot is None else body.min_tonnes_pilot
    sel = pilot.recommend_pilot(
        candidates, params, k=body.k, months=body.months, modes=body.modes, min_tonnes=min_tonnes
    )
    fc = pilot.forecast_pilot(
        sel,
        params,
        months=body.months,
        modes=body.modes,
        reject_share=reject_share,
        n=body.n_samples,
        seed=body.seed,
        swing=body.swing,
    )
    units = {"tonnes": "t", "eur_per_tonne": "€/t", "reject_rate_pct": "%"}
    basis = {
        "tonnes": f"Procura (INE × Plano municipal) × captura dos modos, em {body.months} meses (estimativa)",
        "eur_per_tonne": "Custo anual do modelo / toneladas anuais, intervalo por Monte Carlo (estimativa)",
        "reject_rate_pct": "Taxa observada em 2025 (14,1% rejeito) com a mesma incerteza ± (estimativa)",
    }
    w = sel.weights
    return PilotOut(
        k=body.k,
        months=body.months,
        modes=list(body.modes),
        zones=[
            PilotZoneOut(
                parish_code=s.candidate.zone.id,
                parish_name=s.candidate.zone.name,
                tipau=s.candidate.tipau,
                facts=_facts(s, by_code[s.candidate.zone.id], by_code[s.candidate.zone.id].demand_t),
            )
            for s in sel.chosen
        ],
        score=PilotScoreOut(
            score=sel.score,
            tipau_diversity=sel.tipau_diversity,
            density_contrast=sel.density_contrast,
            coverage=sel.coverage,
            cost=sel.cost,
            weight_tipau=w.tipau,
            weight_density=w.density,
            weight_coverage=w.coverage,
            weight_cost=w.cost,
        ),
        signal_floor=_floor_out(body, floor, sel, min_tonnes),
        kpis=[
            PilotKpiOut(key=k.key, unit=units[k.key], value=k.value, p10=k.p10, p90=k.p90, basis=basis[k.key])
            for k in fc.kpis
        ],
        startup_cost_eur=round(fc.startup_cost_eur, 2),
        rationale=_rationale(sel, body.months, by_code),
    )


async def recommend_pilot(db: AsyncSession, body: PilotRequest) -> PilotOut:
    params = (await service.get_parameters(db)).values
    zones = await service.load_zone_rows(db, params.kg_per_inhab_month)
    baseline = await textile.get_baseline(db)
    if baseline.total_t <= 0:
        raise ConflictError("No observed baseline to forecast the reject rate")
    rows = (await db.execute(select(Parish.dicofre, Parish.area_km2))).all()
    areas = {code: float(a) if a is not None else None for code, a in rows}
    reject_share = baseline.reject_t / baseline.total_t
    if len(zones) < body.k:
        raise ConflictError("Fewer parishes with data than requested")
    return await asyncio.to_thread(_recommend, zones, areas, service._domain_params(params), reject_share, body)
