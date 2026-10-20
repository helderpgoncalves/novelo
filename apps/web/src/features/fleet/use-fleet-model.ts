import { useMemo } from 'react';
import type { CircuitOut, FleetSummary, LocalityOut } from '@/client';
import { buildOccurrences, compareCircuit, detectIssues, loadBySlot, weekTotals } from './schedule';

/** Tudo o que se deriva do planeamento (uma vez por carregamento de dados). */
export function useFleetModel(
  fleet: FleetSummary,
  circuits: CircuitOut[],
  localities: LocalityOut[],
) {
  return useMemo(() => {
    const occs = buildOccurrences(fleet.vehicles, circuits);
    const issues = detectIssues(fleet.vehicles, circuits, occs);
    const fleetSize = fleet.vehicles.length;
    const load = loadBySlot(occs, fleetSize);
    const totals = weekTotals(load);
    const circuitMap = new Map(circuits.map((c) => [c.code, c]));
    const vehicleMap = new Map(fleet.vehicles.map((v) => [v.plate, v]));
    return {
      occs,
      issues,
      fleetSize,
      load,
      totals,
      circuitMap,
      vehicleMap,
      circuits: [...circuits].sort((a, b) => compareCircuit(a.code, b.code)),
      plates: fleet.vehicles.map((v) => v.plate).sort(),
      localityNames: [
        ...new Set([...localities.map((l) => l.name), ...circuits.flatMap((c) => c.localities)]),
      ].sort((a, b) => a.localeCompare(b, 'pt')),
    };
  }, [fleet, circuits, localities]);
}

export type FleetModel = ReturnType<typeof useFleetModel>;
