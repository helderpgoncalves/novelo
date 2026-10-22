from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.domain.validation import (
    Basis,
    SpatialCheck,
    implied_generated_t,
    leave_one_out,
    potential_reading,
    share_reading,
)
from novelo.features.municipal.models import MunicipalParishStat
from novelo.features.textile import references
from novelo.features.textile import service as textile
from novelo.features.validation.schemas import (
    CountKind,
    FranceReference,
    ModelValidationOut,
    PotentialReadingOut,
    ReadingKey,
    SpatialCheckOut,
    ValidationBaseline,
    ZoneCheckOut,
)

# Leituras do têxtil por habitante. A base do modelo é a da Vitrus e da APA (51 250,6 t de indiferenciado × 5,86%); as
# outras são publicadas por terceiros e servem só para triangular. Nenhuma é medida local.
MODEL_RESIDUAL_KG_PER_INHAB_YEAR = references.KG_PER_INHAB_MONTH * 12  # 19,15: têxtil que ainda vai para o lixo
PLAN_KG_PER_MONTH = references.PLAN_KG_PER_INHAB_MONTH  # 0,7: leitura alternativa, não usada pela Vitrus
PLAN_RESIDUAL_KG_PER_INHAB_YEAR = 315  # indiferenciado por habitante, mesmo plano
PLAN_TEXTILE_SHARE_OF_RESIDUAL_PCT = 5.4
PT_TEXTILE_SHARE_PCT = 4.55  # composição dos RSU em Portugal (folha RSU de dados_textil.xlsx, EEA)
FRANCE_KG_PER_INHAB_YEAR = 4.27  # Refashion; por verificar (registo de afirmações C1)
WORST_ZONES = 8
MODEL_BASE: ReadingKey = "vitrus_apa_share_of_rsu"
ALTERNATIVES: frozenset[ReadingKey] = frozenset({"plan_per_capita", "plan_share_of_residual"})

SOURCES: dict[ReadingKey, str] = {
    "vitrus_apa_share_of_rsu": (
        "Vitrus (mentor, 22/10/2026): 43 050,5 t de indiferenciado recolhidas pela Vitrus em 2025, 84,0% do concelho "
        "(R&C 2025, p. 8), logo 51 250,6 t no concelho, das quais 5,86% são têxtil (APA, RARU 2025, p. 24). É o têxtil "
        "que ainda vai para o lixo; o recolhido à parte soma-se."
    ),
    "plan_share_of_residual": (
        "Leitura alternativa, não usada pela Vitrus: Plano de Ação Integrado para a Circularidade Têxtil de Guimarães "
        "(URBACT, 25/11/2025), 5,4% de têxtil no indiferenciado × 315 kg de indiferenciado por habitante e por ano."
    ),
    "pt_composition": (
        "Composição dos RSU em Portugal (4,55% de têxteis, sem sanitários) × 517 kg por habitante e por ano "
        "(Portugal continental, 2024), folha RSU de dados_textil.xlsx."
    ),
    "plan_per_capita": (
        "Leitura alternativa, não usada pela Vitrus: Plano de Ação Integrado para a Circularidade Têxtil de Guimarães "
        "(URBACT, 25/11/2025), p. 30: 0,7 kg por habitante e por mês."
    ),
}

ESTIMATES = [
    "readings.kg_per_inhab_year",
    "readings.implied_capture_pct",
    "readings.implied_potential_t",
    "france.capture_of_model_base_pct",
]
CANNOT_TEST = [
    "no_time_series",  # só há totais anuais de 2025: não se prevê um mês com os anteriores
    "no_local_unit_costs",  # a Vitrus ainda não enviou custos; os €/t são pressupostos
    "no_textile_container_locations",  # a localização dos contentores de têxteis continua por receber
]


def _check_out(kind: CountKind, check: SpatialCheck) -> SpatialCheckOut:
    return SpatialCheckOut(
        kind=kind,
        n=check.n,
        pearson_r=round(check.pearson_r, 3),
        spearman_rho=round(check.spearman_rho, 3),
        r2=round(check.r2, 3),
        median_abs_pct_error=round(check.median_abs_pct_error, 1),
        within_25_pct=check.within_25_pct,
        within_50_pct=check.within_50_pct,
        worst=[
            ZoneCheckOut(
                zone=z.zone,
                population=z.population,
                observed=z.observed,
                predicted=round(z.predicted, 1),
                pct_error=None if z.pct_error is None else round(z.pct_error, 1),
            )
            for z in check.zones[:WORST_ZONES]
        ],
    )


async def model_validation(db: AsyncSession) -> ModelValidationOut:
    base = await textile.get_baseline(db)
    rows = (
        await db.execute(
            select(
                MunicipalParishStat.name,
                MunicipalParishStat.population,
                MunicipalParishStat.containers,
                MunicipalParishStat.n_underground,
                MunicipalParishStat.n_surface,
            ).order_by(MunicipalParishStat.dicofre)
        )
    ).all()
    observed_per_year = base.total_t * 1000 / base.population

    values: list[tuple[ReadingKey, float, Basis]] = [
        ("vitrus_apa_share_of_rsu", MODEL_RESIDUAL_KG_PER_INHAB_YEAR, "residual"),
        (
            "plan_share_of_residual",
            share_reading(PLAN_RESIDUAL_KG_PER_INHAB_YEAR, PLAN_TEXTILE_SHARE_OF_RESIDUAL_PCT),
            "residual",
        ),
        ("pt_composition", share_reading(textile.PT_KG_PER_INHAB_YEAR, PT_TEXTILE_SHARE_PCT), "generated"),
        ("plan_per_capita", PLAN_KG_PER_MONTH * 12, "generated"),
    ]
    readings: list[PotentialReadingOut] = []
    for key, kg, basis in values:
        r = potential_reading(key, kg, base.total_t, base.population, basis)
        readings.append(
            PotentialReadingOut(
                key=key,
                kg_per_inhab_year=round(kg, 2),
                basis=basis,
                implied_capture_pct=round(r.implied_capture_pct, 1),
                implied_potential_t=round(implied_generated_t(base.total_t, base.population, kg, basis), 1),
                is_model_base=key == MODEL_BASE,
                is_alternative=key in ALTERNATIVES,
                source=SOURCES[key],
            )
        )
    # Têxtil gerado por habitante e ano na base do modelo (por desviar + recolhido): referência para a França.
    model_generated_per_inhab_year = (
        implied_generated_t(base.total_t, base.population, MODEL_RESIDUAL_KG_PER_INHAB_YEAR, "residual")
        * 1000
        / base.population
    )

    spatial: list[SpatialCheckOut] = []
    if len(rows) >= 4:
        names = [r.name for r in rows]
        pop = [r.population for r in rows]
        for kind, counts in (
            ("all", [r.containers for r in rows]),
            ("underground", [r.n_underground for r in rows]),
            ("surface", [r.n_surface for r in rows]),
        ):
            spatial.append(_check_out(kind, leave_one_out(names, pop, counts)))  # type: ignore[arg-type]

    return ModelValidationOut(
        baseline=ValidationBaseline(
            year=base.year,
            collected_t=base.total_t,
            population=base.population,
            observed_kg_per_inhab_year=round(observed_per_year, 2),
        ),
        readings=readings,
        france=FranceReference(
            kg_per_inhab_year=FRANCE_KG_PER_INHAB_YEAR,
            capture_of_model_base_pct=round(FRANCE_KG_PER_INHAB_YEAR / model_generated_per_inhab_year * 100, 1),
            source="Refashion, via registo de afirmações C1 (fonte secundária, por verificar).",
        ),
        spatial=spatial,
        estimates=ESTIMATES,
        cannot_test=CANNOT_TEST,
    )
