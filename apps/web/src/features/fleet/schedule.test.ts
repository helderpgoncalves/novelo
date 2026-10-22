import { describe, expect, it } from 'vitest';
import type { CircuitOut, LocalityOut, ScheduleEntry, Typology, VehicleOut } from '@/client';
import {
  blockKey,
  buildBlocks,
  buildIcs,
  buildOccurrences,
  detectIssues,
  type Filters,
  filterOccurrences,
  foldIcs,
  groupBySlot,
  groupIssues,
  type IcsLabels,
  isoWeekday,
  loadBySlot,
  localitiesWithoutVehicle,
  routeOrder,
  weekTotals,
} from './schedule';

const circuit = (
  code: string,
  weekdays: number[],
  extra: Partial<CircuitOut> = {},
): CircuitOut => ({
  code,
  typology: 'undifferentiated',
  collection_type: 'moloks',
  status: 'ok',
  localities: [],
  weekdays,
  days_text: '',
  vehicles: [],
  note: null,
  ...extra,
});

const entry = (
  day_group: ScheduleEntry['day_group'],
  shift: ScheduleEntry['shift'],
  circuitCode: string,
  typology: Typology = 'undifferentiated',
  crew = 3,
  extra: Partial<ScheduleEntry> = {},
): ScheduleEntry => ({
  day_group,
  shift,
  circuit: circuitCode,
  typology,
  crew,
  note: null,
  collection_type: 'unspecified',
  ...extra,
});

const vehicle = (
  plate: string,
  schedule: ScheduleEntry[],
  extra: Partial<VehicleOut> = {},
): VehicleOut => ({
  plate,
  note: null,
  assignments: schedule.length,
  weekday_shifts: 1,
  circuits: [],
  typologies: [],
  max_crew: 3,
  never_assigned: schedule.every((s) => s.typology === 'unassigned'),
  multi_typology: false,
  schedule,
  ...extra,
});

const labels: IcsLabels = {
  shift: { morning: 'Manhã', afternoon: 'Tarde', night: 'Noite' },
  typology: {
    organic: 'Orgânicos',
    undifferentiated: 'Indiferenciados',
    recyclable: 'Recicláveis',
    bulky: 'Monstros',
    payt: 'PAYT',
    support: 'Apoio',
    to_confirm: 'Por confirmar',
    unassigned: 'Sem circuito',
  },
  notice: 'Planeamento tipo.',
  calendarName: 'Frota',
  crew: (n) => `${n} pessoas`,
  localities: 'Localidades',
  vehicle: 'Viaturas',
  circuit: 'Circuitos',
};

describe('buildOccurrences', () => {
  it('interseta o grupo de dias com os dias do circuito', () => {
    const occ = buildOccurrences(
      [vehicle('AA', [entry('weekday', 'morning', 'C7')])],
      [circuit('C7', [2, 4, 6])],
    );
    expect(occ.map((o) => o.day)).toEqual([2, 4]);
    expect(occ.every((o) => !o.daysAssumed)).toBe(true);
  });

  it('usa o grupo inteiro e assinala quando o circuito não tem dias', () => {
    const occ = buildOccurrences(
      [vehicle('AA', [entry('weekday', 'morning', 'MONSTROS', 'bulky')])],
      [circuit('MONSTROS', [])],
    );
    expect(occ.map((o) => o.day)).toEqual([1, 2, 3, 4, 5]);
    expect(occ.every((o) => o.daysAssumed)).toBe(true);
  });

  it('usa o grupo quando os dias do circuito não coincidem (ex.: domingo no grupo de semana)', () => {
    const occ = buildOccurrences(
      [vehicle('AA', [entry('weekday', 'morning', 'C.H', 'to_confirm')])],
      [circuit('C.H', [7])],
    );
    expect(occ).toHaveLength(5);
    expect(occ[0]?.daysAssumed).toBe(true);
  });

  it('ignora linhas sem circuito', () => {
    const occ = buildOccurrences(
      [vehicle('AA', [entry('weekday', 'morning', 'SEM CIRCUITO', 'unassigned')])],
      [],
    );
    expect(occ).toEqual([]);
  });

  it('sábado e domingo caem em 6 e 7', () => {
    const occ = buildOccurrences(
      [vehicle('AA', [entry('saturday', 'night', 'C1'), entry('sunday', 'morning', 'C1')])],
      [circuit('C1', [1, 2, 3, 4, 5, 6, 7])],
    );
    expect(occ.map((o) => `${o.day}${o.shift[0]}`)).toEqual(['6n', '7m']);
  });
});

describe('blocos e conflitos', () => {
  const vehicles = [
    vehicle('AA', [
      entry('weekday', 'morning', 'C7'),
      entry('weekday', 'morning', 'BIO 3', 'organic'),
    ]),
    vehicle('BB', [entry('weekday', 'morning', 'C7')]),
    vehicle('CC', [
      entry('weekday', 'morning', 'C1'),
      entry('weekday', 'afternoon', 'BIO 1', 'organic'),
    ]),
    vehicle('DD', [entry('weekday', 'morning', 'SEM CIRCUITO', 'unassigned')]),
  ];
  const circuits = [
    circuit('C7', [2, 4, 6]),
    circuit('BIO 3', [1, 2, 3, 4, 5, 6, 7], { typology: 'organic' }),
    circuit('C1', [1, 2, 3, 4, 5, 6, 7]),
    circuit('BIO 1', [1, 2, 3, 4, 5, 6, 7], { typology: 'organic' }),
    circuit('C99', [1, 3, 5], { status: 'no_vehicle' }),
  ];
  const occs = buildOccurrences(vehicles, circuits);

  it('junta as viaturas do mesmo circuito num bloco, com a tripulação somada', () => {
    const blocks = buildBlocks(occs);
    const c7 = blocks.find((b) => b.key === blockKey(2, 'morning', 'C7'));
    expect(c7?.plates).toEqual(['AA', 'BB']);
    expect(c7?.crew).toBe(6);
  });

  it('deteta a mesma viatura em dois circuitos só nos dias em que ambos correm', () => {
    const over = detectIssues(vehicles, circuits, occs).filter((i) => i.kind === 'plate_overlap');
    expect(over.map((i) => i.day)).toEqual([2, 4]);
    expect(over[0]?.detail).toEqual(['BIO 3', 'C7']);
    const blocks = buildBlocks(occs);
    expect(blocks.find((b) => b.key === blockKey(1, 'morning', 'C7'))).toBeUndefined();
    expect(blocks.find((b) => b.key === blockKey(2, 'morning', 'BIO 3'))?.overlap).toBe(true);
    expect(blocks.find((b) => b.key === blockKey(1, 'morning', 'BIO 3'))?.overlap).toBe(false);
  });

  it('assinala viaturas sem circuito e circuitos sem viatura', () => {
    const issues = detectIssues(vehicles, circuits, occs);
    expect(issues.filter((i) => i.kind === 'vehicle_idle').map((i) => i.plate)).toEqual(['DD']);
    expect(
      issues.filter((i) => i.kind === 'circuit_without_vehicle').map((i) => i.circuit),
    ).toEqual(['C99']);
  });

  it('pede lavagem quando a viatura serve duas tipologias no mesmo dia', () => {
    const issues = detectIssues(vehicles, circuits, occs).filter(
      (i) => i.kind === 'wash_between_flows',
    );
    expect(issues.filter((i) => i.plate === 'CC')).toHaveLength(5);
    expect(issues.find((i) => i.plate === 'CC')?.detail.sort()).toEqual([
      'organic',
      'undifferentiated',
    ]);
    expect(buildBlocks(occs).find((b) => b.key === blockKey(1, 'afternoon', 'BIO 1'))?.wash).toBe(
      true,
    );
  });

  it('junta o mesmo aviso de vários dias numa só linha', () => {
    const grouped = groupIssues(detectIssues(vehicles, circuits, occs));
    const over = grouped.filter((i) => i.kind === 'plate_overlap');
    expect(over).toHaveLength(1);
    expect(over[0]?.days).toEqual([2, 4]);
    const wash = grouped.filter((i) => i.kind === 'wash_between_flows' && i.plate === 'CC');
    expect(wash).toHaveLength(1);
    expect(wash[0]?.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('agrupa por dia e turno', () => {
    const map = groupBySlot(buildBlocks(occs));
    expect(map.get('2|morning')?.map((b) => b.circuit)).toEqual(['BIO 3', 'C1', 'C7']);
    expect(map.get('1|morning')?.map((b) => b.circuit)).toEqual(['BIO 3', 'C1']);
  });
});

describe('filtros e carga', () => {
  const vehicles = [
    vehicle('AA', [entry('weekday', 'morning', 'C1'), entry('saturday', 'morning', 'C1')]),
    vehicle('BB', [entry('weekday', 'morning', 'BIO 1', 'organic', 2)]),
  ];
  const circuits = [
    circuit('C1', [1, 2, 3, 4, 5, 6], { localities: ['Costa', 'Azurém'] }),
    circuit('BIO 1', [1, 2, 3, 4, 5, 6, 7], { typology: 'organic', localities: ['Costa'] }),
  ];
  const occs = buildOccurrences(vehicles, circuits);

  it('filtra por tipologia, viatura, localidade, dia e turno', () => {
    const f = (x: Partial<Filters>) =>
      filterOccurrences(occs, { typologies: [], ...x }, circuits).length;
    expect(f({})).toBe(11);
    expect(f({ typologies: ['organic'] })).toBe(5);
    expect(f({ plate: 'AA' })).toBe(6);
    expect(f({ locality: 'Azurém' })).toBe(6);
    expect(f({ locality: 'Costa' })).toBe(11);
    expect(f({ day: 6 })).toBe(1);
    expect(f({ shift: 'night' })).toBe(0);
  });

  it('calcula a carga e a taxa de ocupação face à frota', () => {
    const load = loadBySlot(occs, 4);
    const mon = load.find((s) => s.day === 1 && s.shift === 'morning');
    expect(mon).toMatchObject({ vehicles: 2, circuits: 2, crew: 5, rate: 0.5 });
    const sun = load.find((s) => s.day === 7 && s.shift === 'morning');
    expect(sun?.vehicles).toBe(0);
    const totals = weekTotals(load);
    expect(totals.vehicleShifts).toBe(11);
    expect(totals.peak?.vehicles).toBe(2);
  });

  it('não divide por zero com frota vazia', () => {
    expect(loadBySlot([], 0).every((s) => s.rate === 0)).toBe(true);
  });
});

describe('localidades sem viatura', () => {
  it('só conta as servidas apenas por circuitos sem viatura', () => {
    const circuits = [circuit('A', [1], { vehicles: ['AA'] }), circuit('B', [1], { vehicles: [] })];
    const loc = (name: string, c: string[]) =>
      ({
        name,
        latitude: 41,
        longitude: -8,
        parish_code: null,
        circuits: c,
        typologies: [],
        collection_types: [],
        weekdays: [],
        days_per_week: 1,
      }) satisfies LocalityOut;
    const out = localitiesWithoutVehicle(
      [loc('x', ['A']), loc('y', ['B']), loc('z', ['A', 'B'])],
      circuits,
    );
    expect(out.map((l) => l.name)).toEqual(['y']);
  });
});

describe('.ics', () => {
  const vehicles = [
    vehicle('AA-11-BB', [entry('weekday', 'morning', 'C7'), entry('saturday', 'morning', 'C7')]),
  ];
  const circuits = [circuit('C7', [2, 4, 6], { localities: ['Costa, Norte', 'Azurém'] })];
  const occs = buildOccurrences(vehicles, circuits);
  // 2026-10-20 é terça-feira
  const now = new Date(2026, 9, 20, 10, 0, 0);

  it('gera eventos de dia inteiro semanais com os dias certos e o aviso', () => {
    const ics = buildIcs(occs, circuits, 'circuit', labels, now);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261020');
    expect(ics).toContain('DTEND;VALUE=DATE:20261021');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU,TH,SA');
    expect(ics).toContain('SUMMARY:C7 · Manhã · AA-11-BB');
    expect(ics).toContain('Planeamento tipo.');
    expect(ics).toContain('Costa\\, Norte\\, Azurém');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('começa no primeiro dia do evento a partir de hoje', () => {
    const quarta = new Date(2026, 9, 21, 10, 0, 0);
    expect(buildIcs(occs, circuits, 'circuit', labels, quarta)).toContain(
      'DTSTART;VALUE=DATE:20261022',
    );
  });

  it('por viatura usa a matrícula no título', () => {
    const ics = buildIcs(occs, circuits, 'vehicle', labels, now);
    expect(ics).toContain('SUMMARY:AA-11-BB · Manhã · C7');
    expect(ics).toContain('UID:fleet-vehicle-AA_11_BB-morning@novelo.helder.si');
  });

  it('dobra linhas longas a 75 octetos sem partir carateres', () => {
    const folded = foldIcs(`DESCRIPTION:${'ã'.repeat(80)}`);
    for (const line of folded.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'ã'.repeat(80)}`);
  });
});

describe('utilitários', () => {
  it('isoWeekday: 1 segunda ... 7 domingo', () => {
    expect(isoWeekday(new Date(2026, 9, 19))).toBe(1);
    expect(isoWeekday(new Date(2026, 9, 25))).toBe(7);
  });

  it('routeOrder segue a ordem do percurso e não repete localidades', () => {
    const map = new Map([
      ['C1', circuit('C1', [1], { localities: ['Ponte', 'Azurém', 'Creixomil'] })],
      ['C2', circuit('C2', [1], { localities: ['Creixomil', 'Atães'] })],
    ]);
    expect(routeOrder(['C1', 'C2', 'C9'], map)).toEqual(['Ponte', 'Azurém', 'Creixomil', 'Atães']);
    expect(routeOrder(['C2', 'C1'], map)).toEqual(['Creixomil', 'Atães', 'Ponte', 'Azurém']);
  });
});

describe('agrupamento planeado vs conflito real', () => {
  const grouped = {
    note: 'Circuito agrupado no planeamento',
    collection_type: 'door_to_door',
  } as const;
  const vehicles = [
    vehicle('AA', [
      entry('weekday', 'morning', 'C10', 'undifferentiated', 3, grouped),
      entry('weekday', 'morning', 'C11', 'undifferentiated', 3, grouped),
    ]),
    vehicle('BB', [
      entry('weekday', 'afternoon', 'MONSTROS', 'bulky'),
      entry('weekday', 'afternoon', 'SELETIVO', 'recyclable'),
    ]),
  ];
  const circuits = [
    circuit('C10', [1, 2, 3, 4, 5]),
    circuit('C11', [1, 2, 3, 4, 5]),
    circuit('MONSTROS', [1, 2, 3, 4, 5]),
    circuit('SELETIVO', [1, 2, 3, 4, 5]),
  ];
  const occs = buildOccurrences(vehicles, circuits);
  const issues = detectIssues(vehicles, circuits, occs);

  it('a nota "agrupado" tira a linha dos conflitos e cria um aviso informativo', () => {
    expect(issues.filter((i) => i.kind === 'plate_grouped').map((i) => i.plate)).toEqual(
      Array(5).fill('AA'),
    );
    expect(new Set(issues.filter((i) => i.kind === 'plate_overlap').map((i) => i.plate))).toEqual(
      new Set(['BB']),
    );
  });

  it('os blocos distinguem agrupado de conflito e guardam o tipo de recolha', () => {
    const blocks = buildBlocks(occs);
    const c10 = blocks.find((b) => b.key === blockKey(1, 'morning', 'C10'));
    expect(c10?.grouped).toBe(true);
    expect(c10?.overlap).toBe(false);
    expect(c10?.collections).toEqual(['door_to_door']);
    const monstros = blocks.find((b) => b.key === blockKey(1, 'afternoon', 'MONSTROS'));
    expect(monstros?.overlap).toBe(true);
    expect(monstros?.grouped).toBe(false);
    expect(monstros?.collections).toEqual([]);
  });
});
