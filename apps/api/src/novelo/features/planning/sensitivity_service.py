"""Sensibilidade e robustez dos cenários: reavalia o plano já otimizado, sem CP-SAT (ver domain/sensitivity)."""

import asyncio
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import ConflictError
from novelo.domain import network
from novelo.domain import sensitivity as sens
from novelo.domain.vocab import CollectionMode
from novelo.features.planning import service
from novelo.features.planning.params import params_meta, to_domain_zone
from novelo.features.planning.schemas import ParamSource, ScenarioOut, ZoneOut
from novelo.features.planning.sensitivity_schemas import (
    MetricsOut,
    QuantilesOut,
    RobustnessOut,
    SensitivityOut,
    SensitivityRequest,
    TornadoBarOut,
)

METHOD = (
    "Monte Carlo sobre o plano já otimizado: cada amostra reavalia o modelo de custos com os parâmetros perturbados "
    "(distribuição triangular em torno do pressuposto) e não resolve o otimizador de novo. Responde a "
    "'o plano proposto aguenta se os pressupostos estiverem errados?'; reotimizar daria sempre valores mais otimistas."
)
TOP_DRIVERS = 5


def _metrics(m: sens.Metrics) -> MetricsOut:
    return MetricsOut(tonnes=m.tonnes, annual_cost_eur=m.annual_cost_eur, eur_per_tonne=m.eur_per_tonne)


def _quantiles(q: sens.Quantiles) -> QuantilesOut:
    return QuantilesOut(p10=q.p10, p50=q.p50, p90=q.p90)


async def load_plan(db: AsyncSession, scenario_id: uuid.UUID) -> tuple[ScenarioOut, sens.Plan, network.Params]:
    """O plano de um cenário gravado (freguesias e modos, ou locais e rotas) com os km calibrados pelas rotas reais."""
    scenario = await service.get_scenario(db, scenario_id)
    dp = service._domain_params(scenario.params)
    zones = {z.code: z for z in await service.load_zone_rows(db, scenario.params.kg_per_inhab_month)}
    if scenario.result.siting is not None:
        return scenario, _site_plan(scenario, zones, dp), dp
    pap = scenario.result.collection_plan is not None  # cenários antigos: sem o canal porta a porta
    items = []
    for a in scenario.result.allocations:
        if not a.parts:
            continue
        z = zones[a.parish_code]
        zone = to_domain_zone(z, door_to_door=pap)
        modes = tuple(p.mode for p in a.parts)
        items.append(sens.PlanItem(zone, modes, sens.calibrate_km_scale(zone, modes, dp, [p.km_year for p in a.parts])))
    if not items:
        raise ConflictError("Scenario has no plan (infeasible): nothing to evaluate")
    return scenario, items, dp


def _site_plan(scenario: ScenarioOut, zones: dict[str, ZoneOut], dp: network.Params) -> sens.SitePlan:
    result = scenario.result
    summary = result.siting
    assert summary is not None
    if not result.sites and not any(CollectionMode.ON_DEMAND in a.modes for a in result.allocations):
        raise ConflictError("Scenario has no plan (infeasible): nothing to evaluate")
    site_zones = []
    for a in result.allocations:
        if a.served_share is None:
            raise ConflictError("Scenario was computed before the sensitivity existed: calculate it again")
        on_demand = CollectionMode.ON_DEMAND in a.modes
        if a.served_share <= 0 and not on_demand:
            continue
        z = zones[a.parish_code]
        site_zones.append(
            sens.SiteZone(
                to_domain_zone(z, door_to_door=scenario.result.collection_plan is not None),
                a.served_share,
                on_demand,
            )
        )
    return sens.SitePlan(
        mode=summary.site_mode,
        zones=tuple(site_zones),
        sites=len(result.sites),
        km_per_round=sum(r.km for r in result.routes),
        base_detour=dp.detour_factor,
    )


def _sensitivity(
    scenario_id: uuid.UUID, items: sens.Plan, dp: network.Params, body: SensitivityRequest
) -> SensitivityOut:
    meta = {m.key: m for m in params_meta()}
    bars = sens.tornado(items, dp, body.swing)
    mc = sens.monte_carlo(
        items,
        dp,
        n=body.n_samples,
        seed=body.seed,
        swing=body.swing,
        threshold_eur_per_tonne=body.threshold_eur_per_tonne,
    )
    top = bars[:TOP_DRIVERS]
    assumptions = sum(1 for b in top if meta[b.key].source == ParamSource.ASSUMPTION)
    return SensitivityOut(
        scenario_id=scenario_id,
        swing=body.swing,
        n_samples=body.n_samples,
        seed=body.seed,
        method=METHOD,
        base=_metrics(mc.base),
        tornado=[
            TornadoBarOut(
                key=b.key,
                unit=meta[b.key].unit,
                source=meta[b.key].source,
                base_value=b.base_value,
                low_value=b.low_value,
                high_value=b.high_value,
                low=_metrics(b.low),
                high=_metrics(b.high),
                swing_eur_per_tonne=b.swing_eur_per_tonne,
                swing_tonnes=b.swing_tonnes,
                swing_cost_eur=b.swing_cost_eur,
            )
            for b in bars
        ],
        eur_per_tonne=_quantiles(mc.eur_per_tonne),
        annual_cost_eur=_quantiles(mc.annual_cost_eur),
        tonnes=_quantiles(mc.tonnes),
        threshold_eur_per_tonne=mc.threshold_eur_per_tonne,
        prob_below_threshold=mc.prob_below_threshold,
        assumption_share_of_top_drivers=assumptions / len(top) if top else 0.0,
    )


async def scenario_sensitivity(db: AsyncSession, scenario_id: uuid.UUID, body: SensitivityRequest) -> SensitivityOut:
    _, items, dp = await load_plan(db, scenario_id)
    return await asyncio.to_thread(_sensitivity, scenario_id, items, dp, body)


async def compare_robustness(
    db: AsyncSession,
    recommended_id: uuid.UUID,
    alternative_id: uuid.UUID,
    *,
    n_samples: int,
    seed: int,
    swing: float,
    criterion: sens.Criterion,
    min_share: float,
) -> RobustnessOut:
    _, rec_items, rec_params = await load_plan(db, recommended_id)
    _, alt_items, alt_params = await load_plan(db, alternative_id)
    r = await asyncio.to_thread(
        lambda: sens.robustness(
            rec_items,
            rec_params,
            alt_items,
            alt_params,
            n=n_samples,
            seed=seed,
            swing=swing,
            criterion=criterion,
            min_share=min_share,
        )
    )
    return RobustnessOut(
        recommended_id=recommended_id,
        alternative_id=alternative_id,
        criterion=r.criterion,
        n_samples=r.n,
        seed=r.seed,
        swing=r.swing,
        share_recommended_better=r.share_recommended_better,
        min_share=r.min_share,
        holds=r.holds,
        median_advantage=r.median_advantage,
        base_recommended=_metrics(r.base_recommended),
        base_alternative=_metrics(r.base_alternative),
    )
