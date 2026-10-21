"""Pressupostos por omissão do simulador e a origem de cada um.

Dados reais (população INE, circuitos e captura observada da Vitrus) entram no modelo por outra via; aqui ficam
os números que a Vitrus ainda não forneceu (custos unitários), marcados como `assumption` até serem validados.
"""

from novelo.domain import network
from novelo.domain.vocab import CollectionMode
from novelo.features.planning.schemas import ModeParams, ParamMeta, ParamSource, PlanningParams

# Calibração com os dados da Vitrus: em 2025 recolheram-se 301,3 t de um potencial de 1 317,4 t (22,9%).
# O contentor de rua serve 80% da população; a taxa de captura de quem é servido que reproduz as 301 t é
# 22,9% / 80% = 28,6%. Assim, uma rede só de rua em todo o concelho dá, no modelo, o que a Vitrus recolhe hoje.
OBSERVED_CAPTURE_OF_DEMAND = 0.229
STREET_COVERAGE = 0.8
STREET_CAPTURE_RATE = round(OBSERVED_CAPTURE_OF_DEMAND / STREET_COVERAGE, 3)

# Centro de Guimarães como depósito, até a Vitrus indicar o seu (pergunta ao mentor, dia 1).
DEPOT_LAT, DEPOT_LON = 41.4425, -8.2918


def default_params() -> PlanningParams:
    return PlanningParams(
        kg_per_inhab_month=0.7,
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
        piggyback_extra_km=1.5,
        piggyback_min_days=2,
        vehicle_capacity_t=4.0,
        depot_lat=DEPOT_LAT,
        depot_lon=DEPOT_LON,
        solver_time_limit_s=20,
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
        ParamMeta(key="kg_per_inhab_month", unit="kg/hab/mês", source=ParamSource.PLAN),
        *_mode_meta("existing", ParamSource.ASSUMPTION),
        *_mode_meta("street", ParamSource.VITRUS_DATA),
        *_mode_meta("on_demand", ParamSource.ASSUMPTION),
        ParamMeta(key="cost_per_collection_eur", unit="€", source=ParamSource.ASSUMPTION),
        ParamMeta(key="cost_per_km_eur", unit="€/km", source=ParamSource.ASSUMPTION),
        ParamMeta(key="detour_factor", unit="x", source=ParamSource.ASSUMPTION),
        ParamMeta(key="on_demand_kg_per_pickup", unit="kg", source=ParamSource.ASSUMPTION),
        ParamMeta(key="piggyback_extra_km", unit="km", source=ParamSource.ASSUMPTION),
        ParamMeta(key="piggyback_min_days", unit="dias/semana", source=ParamSource.VITRUS_DATA),
        ParamMeta(key="vehicle_capacity_t", unit="t", source=ParamSource.ASSUMPTION),
        ParamMeta(key="depot_lat", unit="°", source=ParamSource.ASSUMPTION),
        ParamMeta(key="depot_lon", unit="°", source=ParamSource.ASSUMPTION),
        ParamMeta(key="solver_time_limit_s", unit="s", source=ParamSource.ASSUMPTION),
    ]


def to_domain_params(p: PlanningParams) -> network.Params:
    return network.Params(
        kg_per_inhab_month=p.kg_per_inhab_month,
        modes={m: network.ModeParams(**mp.model_dump()) for m, mp in p.modes.items()},
        cost_per_collection_eur=p.cost_per_collection_eur,
        cost_per_km_eur=p.cost_per_km_eur,
        detour_factor=p.detour_factor,
        on_demand_kg_per_pickup=p.on_demand_kg_per_pickup,
        piggyback_extra_km=p.piggyback_extra_km,
        piggyback_min_days=p.piggyback_min_days,
        vehicle_capacity_t=p.vehicle_capacity_t,
        depot=(p.depot_lat, p.depot_lon),
    )
