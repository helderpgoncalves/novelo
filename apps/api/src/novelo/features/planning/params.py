"""Pressupostos por omissão do simulador e a origem de cada um.

Dados reais (população INE, circuitos, indiferenciado da Vitrus e percentagem de têxtil da APA, estaleiro e custo de
tratamento) entram no modelo por outra via ou derivam-se aqui; o resto são números que a Vitrus ainda não forneceu
(custos unitários, capturas por modo, viatura dedicada), marcados como `assumption` até serem validados.
"""

from novelo.domain import network
from novelo.domain.routing import RoadRouter
from novelo.domain.vocab import CollectionMode
from novelo.features.planning import assumptions as a
from novelo.features.planning.schemas import ModeParams, ParamMeta, ParamSource, PlanningParams, ZoneOut
from novelo.features.textile.references import KG_PER_INHAB_MONTH

# Procura: têxtil que ainda vai para o lixo, 51 250,6 t de indiferenciado do concelho × 5,86% (Vitrus + APA) ÷ 156 830
# hab ÷ 12 = 1,5958 kg/hab/mês. Derivado em `features/textile/references.py`; não se escreve à mão.
# Arredondado a 5 casas para o ecrã de pressupostos (1,59583): o potencial continua 3 003,3 t (a 4 casas, 1,5958,
# daria 3 003,2 t).
DEFAULT_KG_PER_INHAB_MONTH = round(KG_PER_INHAB_MONTH, 5)

# Contentor de rua: a Vitrus não tem contentores de têxtil nem os quer (contaminação). O modo fica só como referência
# (ex.: o benchmark francês, que é de contentores) e nunca entra por omissão. Os valores são pressupostos: a antiga
# calibração com as 301 t de 2025 deixou de fazer sentido, porque essas toneladas são recolhidas por terceiros.
STREET_CAPTURE_RATE = 0.286
STREET_COVERAGE = 0.8

# Estaleiro e viatura dedicada: valores e fontes em `assumptions.py` (Vitrus, 22 out 2026: o saco de têxtil não pode
# ir na compactadora do porta a porta; a recolha é feita por uma viatura nova, a partir do estaleiro de Polvoreira).
DEPOT_LAT, DEPOT_LON = a.DEPOT_LAT, a.DEPOT_LON


def default_params() -> PlanningParams:
    return PlanningParams(
        kg_per_inhab_month=DEFAULT_KG_PER_INHAB_MONTH,
        modes={
            CollectionMode.EXISTING: ModeParams(
                capture_rate=0.18,
                coverage_factor=0.7,
                capex_per_point_eur=250,
                people_per_point=4000,
                min_points=1,
                lifetime_years=5,
                collections_per_year=26,
            ),
            CollectionMode.STREET: ModeParams(
                capture_rate=STREET_CAPTURE_RATE,
                coverage_factor=STREET_COVERAGE,
                capex_per_point_eur=1200,
                people_per_point=1500,
                min_points=1,
                lifetime_years=10,
                collections_per_year=26,
            ),
            CollectionMode.ON_DEMAND: ModeParams(
                capture_rate=0.25,
                coverage_factor=0.6,
                capex_per_point_eur=0,
                people_per_point=1,
                min_points=0,
                lifetime_years=1,
                collections_per_year=0,
            ),
        },
        cost_per_collection_eur=6.0,
        cost_per_km_eur=1.1,
        detour_factor=1.3,
        on_demand_kg_per_pickup=25.0,
        vehicle_capacity_t=a.VEHICLE_CAPACITY_T,
        depot_lat=DEPOT_LAT,
        depot_lon=DEPOT_LON,
        solver_time_limit_s=20,
        on_demand_every_weeks=a.ON_DEMAND_EVERY_WEEKS,
        vehicle_capex_eur=a.VEHICLE_CAPEX_EUR,
        vehicle_lifetime_years=a.VEHICLE_LIFETIME_YEARS,
        vehicle_speed_kmh=a.VEHICLE_SPEED_KMH,
        door_stop_minutes=a.DOOR_STOP_MINUTES,
        site_stop_minutes=a.SITE_STOP_MINUTES,
        shift_hours=a.SHIFT_HOURS,
        rsu_treatment_eur_per_t=a.TREATMENT_EUR_PER_T,  # 40 €/t TGR + 65,64 €/t Resinorte (Vitrus, 22 out 2026)
    )


def _mode_meta(mode: str, rate_source: ParamSource) -> list[ParamMeta]:
    p = f"modes.{mode}."
    return [
        ParamMeta(key=p + "capture_rate", unit="%", source=rate_source),
        ParamMeta(key=p + "coverage_factor", unit="%", source=ParamSource.ASSUMPTION),
        ParamMeta(key=p + "capex_per_point_eur", unit="€", source=ParamSource.ASSUMPTION),
        ParamMeta(key=p + "people_per_point", unit="hab", source=ParamSource.ASSUMPTION),
        ParamMeta(key=p + "min_points", unit="", source=ParamSource.ASSUMPTION),
        ParamMeta(key=p + "lifetime_years", unit="anos", source=ParamSource.ASSUMPTION),
        ParamMeta(key=p + "collections_per_year", unit="/ano", source=ParamSource.ASSUMPTION),
    ]


def params_meta() -> list[ParamMeta]:
    return [
        ParamMeta(key="kg_per_inhab_month", unit="kg/hab/mês", source=ParamSource.VITRUS_DATA),
        *_mode_meta("existing", ParamSource.ASSUMPTION),
        *_mode_meta("street", ParamSource.ASSUMPTION),
        *_mode_meta("on_demand", ParamSource.ASSUMPTION),
        ParamMeta(key="cost_per_collection_eur", unit="€", source=ParamSource.ASSUMPTION),
        ParamMeta(key="cost_per_km_eur", unit="€/km", source=ParamSource.ASSUMPTION),
        ParamMeta(key="detour_factor", unit="x", source=ParamSource.ASSUMPTION),
        ParamMeta(key="on_demand_kg_per_pickup", unit="kg", source=ParamSource.ASSUMPTION),
        ParamMeta(key="on_demand_every_weeks", unit="semanas", source=ParamSource.ASSUMPTION),
        ParamMeta(
            key="vehicle_capex_eur",
            unit="€",
            source=ParamSource.ASSUMPTION,
            note=(
                "Viatura nova de caixa fechada, sem compactação: 42 500 € sem IVA, adjudicação de um pesado de "
                "mercadorias com caixa fechada, Município de Vila Nova de Gaia (TED 72690-2025, lote VII)."
            ),
        ),
        ParamMeta(key="vehicle_lifetime_years", unit="anos", source=ParamSource.ASSUMPTION),
        ParamMeta(key="vehicle_capacity_t", unit="t", source=ParamSource.ASSUMPTION),
        ParamMeta(key="vehicle_speed_kmh", unit="km/h", source=ParamSource.ASSUMPTION),
        ParamMeta(key="door_stop_minutes", unit="min", source=ParamSource.ASSUMPTION),
        ParamMeta(key="site_stop_minutes", unit="min", source=ParamSource.ASSUMPTION),
        ParamMeta(key="shift_hours", unit="h", source=ParamSource.ASSUMPTION),
        ParamMeta(
            key="depot_lat",
            unit="°",
            source=ParamSource.VITRUS_DATA,
            note="Estaleiro Operacional da Vitrus, Rua das Lameiras, Polvoreira (Vitrus, 22 out 2026).",
        ),
        ParamMeta(key="depot_lon", unit="°", source=ParamSource.VITRUS_DATA),
        ParamMeta(key="solver_time_limit_s", unit="s", source=ParamSource.ASSUMPTION),
        ParamMeta(
            key="rsu_treatment_eur_per_t",
            unit="€/t",
            source=ParamSource.VITRUS_DATA,
            note="40 €/t TGR + 65,64 €/t Resinorte, Vitrus 22 out 2026.",
        ),
    ]


def to_domain_params(p: PlanningParams, road: RoadRouter | None = None) -> network.Params:
    return network.Params(
        kg_per_inhab_month=p.kg_per_inhab_month,
        modes={m: network.ModeParams(**mp.model_dump()) for m, mp in p.modes.items()},
        cost_per_collection_eur=p.cost_per_collection_eur,
        cost_per_km_eur=p.cost_per_km_eur,
        detour_factor=p.detour_factor,
        on_demand_kg_per_pickup=p.on_demand_kg_per_pickup,
        vehicle_capacity_t=p.vehicle_capacity_t,
        depot=(p.depot_lat, p.depot_lon),
        on_demand_every_weeks=float(p.on_demand_every_weeks),
        vehicle_capex_eur=p.vehicle_capex_eur,
        vehicle_lifetime_years=p.vehicle_lifetime_years,
        vehicle_speed_kmh=p.vehicle_speed_kmh,
        door_stop_minutes=p.door_stop_minutes,
        site_stop_minutes=p.site_stop_minutes,
        shift_hours=p.shift_hours,
        road=road,
    )


def to_domain_zone(z: ZoneOut, *, existing_points: bool = False) -> network.Zone:
    """Freguesia para o domínio, com a área (volta da viatura dedicada porta a porta)."""
    return network.Zone(
        z.code,
        z.name,
        z.population,
        z.latitude,
        z.longitude,
        z.service_days,
        (z.existing_containers or None) if existing_points else None,
        area_km2=z.area_km2,
    )
