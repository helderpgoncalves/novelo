"""Pressupostos por omissão do simulador e a origem de cada um.

Dados reais (população INE, circuitos, RSU recolhido pela Vitrus e percentagem de têxtil da APA) entram no modelo por
outra via ou derivam-se aqui; o resto são números que a Vitrus ainda não forneceu (custos unitários, capturas por modo),
marcados como `assumption` até serem validados.
"""

from novelo.domain import network
from novelo.domain.vocab import CollectionMode
from novelo.features.planning.schemas import ModeParams, ParamMeta, ParamSource, PlanningParams, ZoneOut
from novelo.features.textile.references import KG_PER_INHAB_MONTH

# Procura: têxtil que ainda vai para o lixo, 43 051 t de RSU × 5,4% (Vitrus + APA) ÷ 156 830 hab ÷ 12 = 1,2353
# kg/hab/mês. Derivado em `features/textile/references.py`; não se escreve à mão.
# Arredondado a 4 casas para o ecrã de pressupostos (1,2353): o potencial continua 2 324,8 t.
DEFAULT_KG_PER_INHAB_MONTH = round(KG_PER_INHAB_MONTH, 4)

# Contentor de rua: a Vitrus não tem contentores de têxtil nem os quer (contaminação). O modo fica só como referência
# (ex.: o benchmark francês, que é de contentores) e nunca entra por omissão. Os valores são pressupostos: a antiga
# calibração com as 301 t de 2025 deixou de fazer sentido, porque essas toneladas são recolhidas por terceiros.
STREET_CAPTURE_RATE = 0.286
STREET_COVERAGE = 0.8

# Recolha no circuito porta a porta (PAP): o saco vai na viatura que já passa à porta, sem km novos. O custo de cada
# recolha é o tempo extra de paragem, que a Vitrus ainda não deu: até lá, o mesmo valor de uma recolha normal
# (`cost_per_collection_eur`), um teto conservador, porque a viatura já para nessa porta.
PAP_COST_PER_PICKUP_EUR = 6.0

# Centro de Guimarães como depósito, até a Vitrus indicar o seu (pergunta ao mentor, dia 1).
DEPOT_LAT, DEPOT_LON = 41.4425, -8.2918


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
        piggyback_extra_km=1.5,
        piggyback_min_days=2,
        vehicle_capacity_t=4.0,
        depot_lat=DEPOT_LAT,
        depot_lon=DEPOT_LON,
        solver_time_limit_s=20,
        pap_cost_per_pickup_eur=PAP_COST_PER_PICKUP_EUR,
        pap_free_capacity_kg=None,  # por validar com a Vitrus: espaço livre para sacos de têxtil na viatura PAP
        rsu_treatment_eur_per_t=None,  # pedido ao departamento financeiro da Vitrus a 21 out 2026
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
        ParamMeta(key="piggyback_extra_km", unit="km", source=ParamSource.ASSUMPTION),
        ParamMeta(key="piggyback_min_days", unit="dias/semana", source=ParamSource.VITRUS_DATA),
        ParamMeta(key="vehicle_capacity_t", unit="t", source=ParamSource.ASSUMPTION),
        ParamMeta(key="depot_lat", unit="°", source=ParamSource.ASSUMPTION),
        ParamMeta(key="depot_lon", unit="°", source=ParamSource.ASSUMPTION),
        ParamMeta(key="solver_time_limit_s", unit="s", source=ParamSource.ASSUMPTION),
        ParamMeta(key="pap_cost_per_pickup_eur", unit="€", source=ParamSource.ASSUMPTION),
        ParamMeta(
            key="pap_free_capacity_kg",
            unit="kg",
            source=ParamSource.ASSUMPTION,
            note="Por validar com a Vitrus: espaço livre para sacos de têxtil numa ronda porta a porta.",
        ),
        ParamMeta(
            key="rsu_treatment_eur_per_t",
            unit="€/t",
            source=ParamSource.VITRUS_DATA,
            note="Vitrus, departamento financeiro (pedido a 21 out 2026); por preencher.",
        ),
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
        pap_cost_per_pickup_eur=p.pap_cost_per_pickup_eur,
    )


def to_domain_zone(z: ZoneOut, *, existing_points: bool = False, door_to_door: bool = True) -> network.Zone:
    """Freguesia para o domínio. `door_to_door=False` reproduz cenários calculados antes do canal porta a porta."""
    return network.Zone(
        z.code,
        z.name,
        z.population,
        z.latitude,
        z.longitude,
        z.service_days,
        (z.existing_containers or None) if existing_points else None,
        door_to_door=door_to_door and bool(z.door_to_door),
    )
