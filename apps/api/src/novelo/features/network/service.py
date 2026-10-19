from collections import defaultdict
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from novelo.domain.vocab import CircuitStatus, CollectionType, DayGroup, Shift, Typology
from novelo.features.datasets.models import DataSource
from novelo.features.network.models import (
    Circuit,
    CircuitLocality,
    Container,
    FleetCapacity,
    Locality,
    ShiftAssignment,
    Vehicle,
)
from novelo.features.network.schemas import (
    CircuitOut,
    CircuitsSummary,
    ContainerList,
    ContainerOut,
    FleetSummary,
    LocalityOut,
    ScheduleEntry,
    SlotCount,
    TypologyFleet,
    VehicleOut,
)

_WEEKDAY_SHIFTS = (DayGroup.WEEKDAY,)


async def _assignments(db: AsyncSession) -> list[ShiftAssignment]:
    result = await db.execute(select(ShiftAssignment).options(selectinload(ShiftAssignment.vehicle)))
    return list(result.scalars())


async def list_circuits(db: AsyncSession) -> CircuitsSummary:
    circuits = (
        (
            await db.execute(
                select(Circuit)
                .options(
                    selectinload(Circuit.days), selectinload(Circuit.localities).selectinload(CircuitLocality.locality)
                )
                .order_by(Circuit.typology, Circuit.code)
            )
        )
        .scalars()
        .all()
    )
    assignments = await _assignments(db)
    plates_by_circuit: dict[str, set[str]] = defaultdict(set)
    for a in assignments:
        if a.circuit_id:
            plates_by_circuit[str(a.circuit_id)].add(a.vehicle.plate)

    all_plates = set((await db.execute(select(Vehicle.plate))).scalars())
    used_plates = {a.vehicle.plate for a in assignments if a.circuit_id}
    out = [
        CircuitOut(
            code=c.code,
            typology=c.typology,
            collection_type=c.collection_type,
            status=c.status,
            localities=sorted(cl.locality.name for cl in c.localities),
            weekdays=sorted(d.weekday for d in c.days),
            days_text=c.days_text,
            vehicles=sorted(plates_by_circuit.get(str(c.id), set())),
            note=c.note,
        )
        for c in circuits
    ]
    locality_count = (await db.execute(select(func.count(func.distinct(CircuitLocality.locality_id))))).scalar_one()
    return CircuitsSummary(
        circuits=out,
        total=len(out),
        without_vehicle=sum(1 for c in circuits if c.status == CircuitStatus.NO_VEHICLE),
        vehicles=len(all_plates),
        vehicles_never_assigned=sorted(all_plates - used_plates),
        localities=locality_count,
    )


async def get_fleet(db: AsyncSession) -> FleetSummary:
    assignments = await _assignments(db)
    circuits = (await db.execute(select(Circuit))).scalars().all()
    capacity = {c.typology: c for c in (await db.execute(select(FleetCapacity))).scalars()}
    vehicles = (await db.execute(select(Vehicle).order_by(Vehicle.plate))).scalars().all()
    source = (await db.execute(select(DataSource).where(DataSource.key.like("vitrus_circuits%")))).scalars().first()

    typologies: list[TypologyFleet] = []
    for typology in (t for t in Typology if t not in (Typology.UNASSIGNED,)):
        rows = [a for a in assignments if a.typology == typology]
        own_circuits = [c for c in circuits if c.typology == typology]
        if not rows and not own_circuits:
            continue
        slots = [
            SlotCount(
                day_group=g,
                shift=s,
                assignments=sum(1 for a in rows if a.day_group == g and a.shift == s),
                crew=sum(a.crew_size for a in rows if a.day_group == g and a.shift == s),
            )
            for g in DayGroup
            for s in Shift
        ]
        weekday = [a for a in rows if a.day_group == DayGroup.WEEKDAY]
        cap = capacity.get(typology)
        typologies.append(
            TypologyFleet(
                typology=typology,
                circuits=len(own_circuits),
                circuits_without_vehicle=sum(1 for c in own_circuits if c.status == CircuitStatus.NO_VEHICLE),
                slots=[s for s in slots if s.assignments],
                vehicle_shifts_week=len(weekday),
                crew_shifts_week=sum(a.crew_size for a in weekday),
                fleet_vehicles=cap.vehicles if cap else None,
                fleet_crew=cap.crew if cap else None,
            )
        )

    by_plate: dict[str, list[ShiftAssignment]] = defaultdict(list)
    for a in assignments:
        by_plate[a.vehicle.plate].append(a)
    vehicle_out = []
    for v in vehicles:
        rows = by_plate.get(v.plate, [])
        real = [a for a in rows if a.circuit_id]
        types = sorted({a.typology for a in real})
        vehicle_out.append(
            VehicleOut(
                plate=v.plate,
                note=v.note,
                assignments=len(rows),
                weekday_shifts=len({a.shift for a in rows if a.day_group == DayGroup.WEEKDAY}),
                circuits=sorted({a.circuit_label for a in real}),
                typologies=types,
                max_crew=max((a.crew_size for a in rows), default=0),
                never_assigned=not real,
                multi_typology=len(types) > 1,
                schedule=[
                    ScheduleEntry(
                        day_group=a.day_group,
                        shift=a.shift,
                        circuit=a.circuit_label,
                        typology=a.typology,
                        crew=a.crew_size,
                    )
                    for a in sorted(rows, key=lambda r: (list(DayGroup).index(r.day_group), list(Shift).index(r.shift)))
                ],
            )
        )
    # Igual ao total da folha Resumo: as viaturas sem afetação não contam como tripulantes-turno.
    weekday_all = [a for a in assignments if a.day_group == DayGroup.WEEKDAY and a.typology != Typology.UNASSIGNED]
    return FleetSummary(
        typologies=typologies,
        vehicles=vehicle_out,
        total_assignments=len(assignments),
        total_crew_shifts_week=sum(a.crew_size for a in weekday_all),
        period_start=source.period_start if source else None,
        period_end=source.period_end if source else None,
    )


async def list_localities(db: AsyncSession) -> list[LocalityOut]:
    circuits = (
        (
            await db.execute(
                select(Circuit).options(
                    selectinload(Circuit.days), selectinload(Circuit.localities).selectinload(CircuitLocality.locality)
                )
            )
        )
        .scalars()
        .all()
    )
    by_locality: dict[str, dict[str, set[Any]]] = defaultdict(
        lambda: {"circuits": set(), "typologies": set(), "kinds": set(), "days": set()}
    )
    for c in circuits:
        for cl in c.localities:
            entry = by_locality[cl.locality.name]
            entry["circuits"].add(c.code)
            entry["typologies"].add(c.typology)
            if c.collection_type != CollectionType.UNSPECIFIED:
                entry["kinds"].add(c.collection_type)
            entry["days"] |= {d.weekday for d in c.days}
    return [
        LocalityOut(
            name=name,
            circuits=sorted(e["circuits"]),
            typologies=sorted(e["typologies"]),
            collection_types=sorted(e["kinds"]),
            weekdays=sorted(e["days"]),
            days_per_week=len(e["days"]),
        )
        for name, e in sorted(by_locality.items())
    ]


async def list_containers(db: AsyncSession, limit: int, offset: int) -> ContainerList:
    total = (await db.execute(select(func.count()).select_from(Container))).scalar_one()
    rows = (
        await db.execute(
            select(Container, Locality.name)
            .outerjoin(Locality, Locality.id == Container.locality_id)
            .order_by(Container.external_ref)
            .limit(limit)
            .offset(offset)
        )
    ).all()
    items = [
        ContainerOut(
            id=c.id,
            external_ref=c.external_ref,
            kind=c.kind,
            status=c.status,
            latitude=c.latitude,
            longitude=c.longitude,
            address=c.address,
            locality=locality,
            capacity_litres=c.capacity_litres,
        )
        for c, locality in rows
    ]
    return ContainerList(items=items, total=total)
