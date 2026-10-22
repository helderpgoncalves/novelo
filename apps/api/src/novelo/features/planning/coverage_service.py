"""Matriz de cobertura de um cenário: por freguesia (território, procura, proximidade, canais) e por TIPAU."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.domain import coverage_matrix as cm
from novelo.domain.vocab import Tipau
from novelo.features.municipal.models import MunicipalParishStat
from novelo.features.planning import service
from novelo.features.planning.coverage_schemas import (
    CoverageChannel,
    CoverageEquity,
    CoverageGroup,
    CoverageParish,
    ScenarioCoverage,
)
from novelo.features.planning.schemas import Allocation


def _channels(a: Allocation) -> list[CoverageChannel]:
    """Canais do cenário na freguesia: todos feitos pela viatura dedicada (o modo de cada parte)."""
    return [part.mode.value for part in a.parts]


def _group(g: cm.GroupFigures) -> CoverageGroup:
    return CoverageGroup(
        tipau=Tipau(g.tipau) if g.tipau else None,
        parishes=g.parishes,
        population=g.population,
        covered_population=round(g.covered_population),
        covered_pct=round(g.covered_pct, 1) if g.covered_pct is not None else None,
        tonnes=round(g.tonnes, 3),
        annual_cost_eur=round(g.annual_cost_eur, 2),
        eur_per_tonne=round(g.eur_per_tonne, 2) if g.eur_per_tonne is not None else None,
    )


async def scenario_coverage(db: AsyncSession, scenario_id: uuid.UUID) -> ScenarioCoverage:
    scenario = await service.get_scenario(db, scenario_id)  # NotFoundError se não existir
    zones = {z.code: z for z in await service.load_zone_rows(db, scenario.params.kg_per_inhab_month)}
    stats = {
        code: (area, cover)
        for code, area, cover in await db.execute(
            select(MunicipalParishStat.dicofre, MunicipalParishStat.area_km2, MunicipalParishStat.cover_pct_300m)
        )
    }
    rows: list[CoverageParish] = []
    figures: list[cm.ParishFigures] = []
    for a in scenario.result.allocations:
        z = zones.get(a.parish_code)
        tipau = z.tipau if z is not None else None
        area, cover = stats.get(a.parish_code, (None, None))
        dens = cm.density(a.population, area)
        rows.append(
            CoverageParish(
                parish_code=a.parish_code,
                parish_name=a.parish_name,
                tipau=tipau,
                population=a.population,
                area_km2=area,
                density_hab_km2=round(dens, 1) if dens is not None else None,
                demand_t=a.demand_t,
                area_within_300m_pct=cover,
                door_to_door_days_week=len({p.weekday for p in z.door_to_door}) if z is not None else 0,
                service_days=z.service_days if z is not None else 0,
                modes=a.modes,
                channels=_channels(a),
                tonnes=a.tonnes,
                covered_population=a.covered_population,
                covered_share=round(a.covered_population / a.population, 4) if a.population else 0.0,
                annual_cost_eur=a.annual_cost_eur,
            )
        )
        figures.append(
            cm.ParishFigures(
                tipau.value if tipau is not None else None,
                a.population,
                a.covered_population,
                a.tonnes,
                a.annual_cost_eur,
            )
        )

    order = {t: i for i, t in enumerate(cm.TIPAU_ORDER)}
    rows.sort(key=lambda r: (order.get(r.tipau.value if r.tipau else "", 9), -r.population, r.parish_code))
    eq = cm.equity(figures)
    return ScenarioCoverage(
        scenario_id=scenario.id,
        label=scenario.label,
        siting=scenario.siting,
        parishes=rows,
        by_tipau=[_group(g) for g in cm.by_tipau(figures)],
        total=_group(cm.group(figures, None)),
        equity=CoverageEquity(
            urban_population=eq.urban_population,
            urban_covered_pct=round(eq.urban_covered_pct, 1) if eq.urban_covered_pct is not None else None,
            non_urban_population=eq.non_urban_population,
            non_urban_covered_pct=round(eq.non_urban_covered_pct, 1) if eq.non_urban_covered_pct is not None else None,
            non_urban_vs_urban=round(eq.non_urban_vs_urban, 3) if eq.non_urban_vs_urban is not None else None,
        ),
    )
