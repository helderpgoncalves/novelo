"""Cenários de referência externos: pressupostos com fonte, consequências com os dados reais e criação de cenário."""

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import NotFoundError
from novelo.domain import benchmarks
from novelo.domain.vocab import CollectionMode, ScenarioObjective
from novelo.features.planning import service
from novelo.features.planning.benchmark_schemas import BenchmarkOut, BenchmarkScenarioRequest
from novelo.features.planning.params import to_domain_zone
from novelo.features.planning.schemas import PlanningParams, ScenarioOut, ScenarioRequest
from novelo.features.textile import service as textile
from novelo.features.users.models import User


@dataclass(frozen=True)
class Benchmark:
    key: str
    label: str
    kg_per_inhab_year: float
    people_per_point: int
    density_mode: CollectionMode
    source: str
    verified: bool


FRENCH_PERFORMANCE = Benchmark(
    key="french_performance",
    label="Desempenho francês",
    kg_per_inhab_year=4.27,
    people_per_point=1414,
    density_mode=CollectionMode.STREET,
    source=(
        "Referência externa indicada pela equipa (França: 4,27 kg/hab/ano recolhidos, 1 ponto por ~1 414 habitantes). "
        "Por verificar: confirmar no relatório anual do eco-organismo francês (Refashion) antes de a citar. "
        "Entra no modelo só como cenário de comparação, nunca como pressuposto base. É uma rede de contentores de "
        "rua: o único sítio onde o modo `street` entra, como referência (a Vitrus não tem contentores de têxtil)."
    ),
    verified=False,
)
BENCHMARKS = {b.key: b for b in (FRENCH_PERFORMANCE,)}


def get_benchmark(key: str) -> Benchmark:
    try:
        return BENCHMARKS[key]
    except KeyError:
        raise NotFoundError("Benchmark not found") from None


def _preset_params(base: PlanningParams, b: Benchmark) -> PlanningParams:
    modes = {
        **base.modes,
        b.density_mode: base.modes[b.density_mode].model_copy(update={"people_per_point": b.people_per_point}),
    }
    return base.model_copy(update={"modes": modes})


async def _describe(db: AsyncSession, b: Benchmark) -> BenchmarkOut:
    base = (await service.get_parameters(db)).values
    params = _preset_params(base, b)
    zones = await service.load_zone_rows(db, params.kg_per_inhab_month)
    baseline = await textile.get_baseline(db)
    population = sum(z.population for z in zones)
    dp = service._domain_params(params)
    dzones = [to_domain_zone(z) for z in zones]
    target = benchmarks.target_tonnes(b.kg_per_inhab_year, population)
    ceiling = benchmarks.max_capturable_t(dzones, dp)
    return BenchmarkOut(
        key=b.key,
        label=b.label,
        kg_per_inhab_year=b.kg_per_inhab_year,
        people_per_point=b.people_per_point,
        density_mode=b.density_mode,
        source=b.source,
        verified=b.verified,
        population=population,
        target_tonnes=round(target, 1),
        implied_capture_pct=round(
            benchmarks.implied_capture_of_demand(b.kg_per_inhab_year, params.kg_per_inhab_month) * 100, 1
        ),
        observed_capture_pct=baseline.capture_of_demand_pct,
        observed_kg_per_inhab_year=round(baseline.total_t * 1000 / baseline.population, 2)
        if baseline.population
        else 0.0,
        current_people_per_point=base.modes[b.density_mode].people_per_point,
        max_capturable_t=round(ceiling, 1),
        reachable=target <= ceiling,
    )


async def list_benchmarks(db: AsyncSession) -> list[BenchmarkOut]:
    return [await _describe(db, b) for b in BENCHMARKS.values()]


async def create_benchmark_scenario(
    db: AsyncSession, key: str, body: BenchmarkScenarioRequest, user: User
) -> ScenarioOut:
    """Cria um cenário normal (reutiliza `run_scenario`) com a meta e a densidade do preset."""
    b = get_benchmark(key)
    info = await _describe(db, b)
    base = (await service.get_parameters(db)).values
    request = ScenarioRequest(
        label=body.label or b.label,
        objective=body.objective,
        budget_eur_year=body.budget_eur_year if body.objective == ScenarioObjective.MAX_TONNES else None,
        target_tonnes=info.target_tonnes,
        params=_preset_params(base, b),
        # Referência explícita: a densidade do preset é de contentores de rua, por isso todos os modos ficam ligados.
        default_modes=list(CollectionMode),
    )
    return await service.run_scenario(db, request, user)
