"""Plano de recolha a pedido por freguesia: no circuito porta a porta (0 km novos) ou a pedido com desvio.

Partilhado pelos cenários por freguesia e por locais; a regra do dia e as fórmulas estão em `domain/door_to_door.py`.
"""

from collections.abc import Mapping

from novelo.domain import door_to_door
from novelo.features.planning.schemas import CollectionPlanEntry, PlanningParams, ZoneOut


def build_collection_plan(
    zones: list[ZoneOut],
    on_demand: Mapping[str, tuple[float, float]],
    params: PlanningParams,
    *,
    door_to_door_on: bool = True,
) -> list[CollectionPlanEntry]:
    """`on_demand`: por freguesia com recolha a pedido, (toneladas, km por ano). Ordem: toneladas decrescentes."""
    by_code = {z.code: z for z in zones}
    pap = {code: t for code, (t, _) in on_demand.items() if door_to_door_on and t > 0 and by_code[code].door_to_door}
    passes = {
        code: [door_to_door.Pass(p.circuit, p.weekday, p.vehicle, p.crew) for p in by_code[code].door_to_door]
        for code in pap
    }
    assigned = {a.zone_id: a for a in door_to_door.assign_days(pap, passes)}
    loads = door_to_door.round_loads(list(assigned.values()))
    vehicle_kg = params.vehicle_capacity_t * 1000
    out: list[CollectionPlanEntry] = []
    for code, (tonnes, km) in on_demand.items():
        if tonnes <= 0:
            continue
        z = by_code[code]
        pickups = door_to_door.pickups_per_year(tonnes, params.on_demand_kg_per_pickup)
        a = assigned.get(code)
        if a is None:
            out.append(
                CollectionPlanEntry(
                    parish_code=code, parish_name=z.name, channel="detour", circuit=None, weekday=None, vehicle=None,
                    crew=None, new_km_year=round(km, 1), tonnes_year=round(tonnes, 3), pickups_year=round(pickups, 1),
                    kg_per_round=None, round_kg=None, fits_capacity=None,
                )
            )  # fmt: skip
            continue
        round_kg = loads[(a.circuit, a.weekday)]
        out.append(
            CollectionPlanEntry(
                parish_code=code,
                parish_name=z.name,
                channel="door_to_door",
                circuit=a.circuit,
                circuits=sorted({p.circuit for p in z.door_to_door}),
                weekday=a.weekday,
                vehicle=a.vehicle,
                crew=a.crew,
                new_km_year=0.0,
                tonnes_year=round(tonnes, 3),
                pickups_year=round(pickups, 1),
                kg_per_round=round(a.kg_per_round, 1),
                round_kg=round(round_kg, 1),
                fits_capacity=door_to_door.fits(round_kg, params.pap_free_capacity_kg, vehicle_kg),
            )
        )
    return sorted(out, key=lambda e: (-e.tonnes_year, e.parish_code))
