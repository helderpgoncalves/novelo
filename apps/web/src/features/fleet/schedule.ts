import type {
  CircuitOut,
  CollectionType,
  DayGroup,
  LocalityOut,
  Shift,
  Typology,
  VehicleOut,
} from '@/client';

/**
 * Derivações puras do planeamento semanal TIPO da Vitrus (não há datas nem horas reais).
 * O planeamento diz, por grupo de dias (segunda a sexta, sábado, domingo) e turno, que viatura serve que
 * circuito. Os dias da semana de cada circuito vêm do ficheiro de circuitos; a ocorrência de um circuito num
 * dia é a interseção dos dois. Sem dias conhecidos, vale o grupo inteiro (e fica assinalado).
 */

export const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const SHIFTS: readonly Shift[] = ['morning', 'afternoon', 'night'];

export const GROUP_DAYS: Record<DayGroup, readonly number[]> = {
  weekday: [1, 2, 3, 4, 5],
  saturday: [6],
  sunday: [7],
};

/** Tipologias mostradas no calendário, pela ordem da legenda. */
export const TYPOLOGIES: readonly Typology[] = [
  'undifferentiated',
  'organic',
  'recyclable',
  'payt',
  'bulky',
  'support',
  'to_confirm',
];

export interface Occurrence {
  /** Identificador estável: dia, turno, matrícula e circuito. */
  key: string;
  day: number;
  shift: Shift;
  plate: string;
  circuit: string;
  typology: Typology;
  crew: number;
  /** Nota da linha do planeamento da Vitrus (ex.: "Circuito agrupado no planeamento"). */
  note: string | null;
  collection: CollectionType;
  /** Os dias vêm do grupo do planeamento (circuito sem dias conhecidos ou incoerentes). */
  daysAssumed: boolean;
}

export type IssueKind =
  | 'plate_overlap'
  | 'plate_grouped'
  | 'wash_between_flows'
  | 'vehicle_idle'
  | 'circuit_without_vehicle'
  | 'days_assumed';

export interface Issue {
  kind: IssueKind;
  /** Chaves de blocos afetados (`blockKey`), quando aplicável. */
  blocks: string[];
  circuit?: string;
  plate?: string;
  day?: number;
  /** Dias em que o mesmo aviso se repete (depois de `groupIssues`). */
  days?: number[];
  shift?: Shift;
  /** Circuitos ou tipologias envolvidos, para o texto. */
  detail: string[];
}

export interface Block {
  key: string;
  day: number;
  shift: Shift;
  circuit: string;
  typology: Typology;
  plates: string[];
  /** Soma da tripulação, contando cada viatura uma só vez. */
  crew: number;
  /** Tipos de recolha das linhas do planeamento (sem repetidos nem "não especificado"). */
  collections: CollectionType[];
  daysAssumed: boolean;
  /** Conflito real: a mesma viatura em dois circuitos no mesmo turno sem o planeamento os agrupar. */
  overlap: boolean;
  /** Agrupamento planeado: a Vitrus marcou os circuitos como agrupados na mesma saída. */
  grouped: boolean;
  wash: boolean;
}

export interface Filters {
  typologies: Typology[];
  plate?: string;
  circuit?: string;
  locality?: string;
  day?: number;
  shift?: Shift;
}

export const EMPTY_FILTERS: Filters = { typologies: [] };

export const blockKey = (day: number, shift: Shift, circuit: string) =>
  `${day}|${shift}|${circuit}`;

export function buildOccurrences(vehicles: VehicleOut[], circuits: CircuitOut[]): Occurrence[] {
  const byCode = new Map(circuits.map((c) => [c.code, c]));
  const seen = new Set<string>();
  const out: Occurrence[] = [];
  for (const v of vehicles) {
    for (const e of v.schedule) {
      if (e.typology === 'unassigned') continue;
      const group = GROUP_DAYS[e.day_group];
      const known = byCode.get(e.circuit)?.weekdays ?? [];
      const inter = group.filter((d) => known.includes(d));
      const days = inter.length ? inter : group;
      for (const day of days) {
        const key = `${day}|${e.shift}|${v.plate}|${e.circuit}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          key,
          day,
          shift: e.shift,
          plate: v.plate,
          circuit: e.circuit,
          typology: e.typology,
          crew: e.crew,
          note: e.note,
          collection: e.collection_type,
          daysAssumed: inter.length === 0,
        });
      }
    }
  }
  return out.sort(
    (a, b) =>
      a.day - b.day ||
      SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift) ||
      compareCircuit(a.circuit, b.circuit) ||
      a.plate.localeCompare(b.plate),
  );
}

/** Ordena códigos como "C2" antes de "C10" e agrupa os prefixos iguais. */
export function compareCircuit(a: string, b: string): number {
  return a.localeCompare(b, 'pt', { numeric: true, sensitivity: 'base' });
}

export function slotKey(day: number, shift: Shift) {
  return `${day}|${shift}`;
}

/** A nota da Vitrus que confirma que o planeamento junta estes circuitos numa só saída. */
export const isGroupedNote = (note: string | null | undefined) => /agrupad/i.test(note ?? '');

/**
 * A mesma viatura em mais de um circuito no mesmo dia e turno. Se todas as linhas dizem "Circuito agrupado" é um
 * agrupamento planeado (`grouped`); caso contrário é um conflito real a confirmar com a Vitrus.
 */
export function overlapGroups(
  occs: Occurrence[],
): Map<string, { circuits: string[]; grouped: boolean }> {
  const groups = new Map<string, { circuits: Set<string>; grouped: boolean }>();
  for (const o of occs) {
    const k = `${o.day}|${o.shift}|${o.plate}`;
    const g = groups.get(k) ?? { circuits: new Set<string>(), grouped: true };
    g.circuits.add(o.circuit);
    g.grouped &&= isGroupedNote(o.note);
    groups.set(k, g);
  }
  return new Map(
    [...groups]
      .filter(([, g]) => g.circuits.size > 1)
      .map(([k, g]) => [k, { circuits: [...g.circuits], grouped: g.grouped }]),
  );
}

/** Só os conflitos reais (exclui os agrupamentos planeados). */
export function overlaps(occs: Occurrence[]): Map<string, string[]> {
  return new Map(
    [...overlapGroups(occs)].filter(([, g]) => !g.grouped).map(([k, g]) => [k, g.circuits]),
  );
}

/** Viatura com mais de uma tipologia no mesmo dia: exige lavagem da caixa entre fluxos. */
export function washDays(occs: Occurrence[]): Map<string, Typology[]> {
  const groups = new Map<string, Set<Typology>>();
  for (const o of occs) {
    // Apoio e a confirmar não são fluxos de resíduos.
    if (o.typology === 'support' || o.typology === 'to_confirm') continue;
    const k = `${o.day}|${o.plate}`;
    const set = groups.get(k) ?? new Set<Typology>();
    set.add(o.typology);
    groups.set(k, set);
  }
  return new Map([...groups].filter(([, set]) => set.size > 1).map(([k, set]) => [k, [...set]]));
}

export function buildBlocks(occs: Occurrence[], all: Occurrence[] = occs): Block[] {
  const groups = overlapGroups(all);
  const wash = washDays(all);
  const map = new Map<string, Block & { crewByPlate: Map<string, number> }>();
  for (const o of occs) {
    const key = blockKey(o.day, o.shift, o.circuit);
    let b = map.get(key);
    if (!b) {
      b = {
        key,
        day: o.day,
        shift: o.shift,
        circuit: o.circuit,
        typology: o.typology,
        plates: [],
        crew: 0,
        collections: [],
        daysAssumed: false,
        overlap: false,
        grouped: false,
        wash: false,
        crewByPlate: new Map(),
      };
      map.set(key, b);
    }
    if (!b.plates.includes(o.plate)) b.plates.push(o.plate);
    b.crewByPlate.set(o.plate, Math.max(b.crewByPlate.get(o.plate) ?? 0, o.crew));
    b.daysAssumed ||= o.daysAssumed;
    if (o.collection !== 'unspecified' && !b.collections.includes(o.collection))
      b.collections.push(o.collection);
    const g = groups.get(`${o.day}|${o.shift}|${o.plate}`);
    if (g) {
      if (g.grouped) b.grouped = true;
      else b.overlap = true;
    }
    b.wash ||= wash.has(`${o.day}|${o.plate}`);
  }
  return [...map.values()]
    .map(({ crewByPlate, ...b }) => ({
      ...b,
      plates: b.plates.sort(),
      crew: [...crewByPlate.values()].reduce((s, n) => s + n, 0),
    }))
    .sort(
      (a, b) =>
        a.day - b.day ||
        SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift) ||
        compareCircuit(a.circuit, b.circuit),
    );
}

export function groupBySlot<T extends { day: number; shift: Shift }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const i of items) {
    const k = slotKey(i.day, i.shift);
    map.set(k, [...(map.get(k) ?? []), i]);
  }
  return map;
}

export function matchesFilters(
  o: Occurrence,
  f: Filters,
  circuits: Map<string, CircuitOut>,
): boolean {
  if (f.typologies.length && !f.typologies.includes(o.typology)) return false;
  if (f.plate && o.plate !== f.plate) return false;
  if (f.circuit && o.circuit !== f.circuit) return false;
  if (f.day && o.day !== f.day) return false;
  if (f.shift && o.shift !== f.shift) return false;
  if (f.locality && !circuits.get(o.circuit)?.localities.includes(f.locality)) return false;
  return true;
}

export function filterOccurrences(
  occs: Occurrence[],
  f: Filters,
  circuits: CircuitOut[],
): Occurrence[] {
  const map = new Map(circuits.map((c) => [c.code, c]));
  return occs.filter((o) => matchesFilters(o, f, map));
}

export const hasFilters = (f: Filters, ignore: (keyof Filters)[] = []) =>
  (!ignore.includes('typologies') && f.typologies.length > 0) ||
  (['plate', 'circuit', 'locality', 'day', 'shift'] as const).some(
    (k) => !ignore.includes(k) && f[k] !== undefined,
  );

export interface SlotLoad {
  day: number;
  shift: Shift;
  vehicles: number;
  circuits: number;
  crew: number;
  /** Viaturas em uso a dividir pela frota (0 a 1). */
  rate: number;
}

/** Carga por dia e turno: viaturas distintas, circuitos e pessoas, e a taxa face à frota. */
export function loadBySlot(occs: Occurrence[], fleetSize: number): SlotLoad[] {
  const acc = new Map<string, { plates: Map<string, number>; circuits: Set<string> }>();
  for (const o of occs) {
    const k = slotKey(o.day, o.shift);
    const a = acc.get(k) ?? { plates: new Map(), circuits: new Set() };
    a.plates.set(o.plate, Math.max(a.plates.get(o.plate) ?? 0, o.crew));
    a.circuits.add(o.circuit);
    acc.set(k, a);
  }
  return DAYS.flatMap((day) =>
    SHIFTS.map((shift) => {
      const a = acc.get(slotKey(day, shift));
      const vehicles = a?.plates.size ?? 0;
      return {
        day,
        shift,
        vehicles,
        circuits: a?.circuits.size ?? 0,
        crew: a ? [...a.plates.values()].reduce((s, n) => s + n, 0) : 0,
        rate: fleetSize > 0 ? vehicles / fleetSize : 0,
      };
    }),
  );
}

export interface WeekTotals {
  vehicleShifts: number;
  crewShifts: number;
  peak: SlotLoad | null;
}

export function weekTotals(load: SlotLoad[]): WeekTotals {
  const peak = load.reduce<SlotLoad | null>(
    (best, s) => (s.vehicles > (best?.vehicles ?? 0) ? s : best),
    null,
  );
  return {
    vehicleShifts: load.reduce((n, s) => n + s.vehicles, 0),
    crewShifts: load.reduce((n, s) => n + s.crew, 0),
    peak,
  };
}

/** Todos os avisos reais, calculados sobre o planeamento completo (não sobre o que está filtrado). */
export function detectIssues(
  vehicles: VehicleOut[],
  circuits: CircuitOut[],
  occs: Occurrence[],
): Issue[] {
  const issues: Issue[] = [];

  for (const [k, group] of overlapGroups(occs)) {
    const [dayText, shift, plate] = k.split('|') as [string, Shift, string];
    const day = Number(dayText);
    issues.push({
      kind: group.grouped ? 'plate_grouped' : 'plate_overlap',
      blocks: group.circuits.map((c) => blockKey(day, shift, c)),
      plate,
      day,
      shift,
      detail: [...group.circuits].sort(compareCircuit),
    });
  }
  for (const [k, types] of washDays(occs)) {
    const [dayText, plate] = k.split('|') as [string, string];
    const day = Number(dayText);
    const blocks = occs
      .filter((o) => o.day === day && o.plate === plate)
      .map((o) => blockKey(o.day, o.shift, o.circuit));
    issues.push({ kind: 'wash_between_flows', blocks, plate, day, detail: types });
  }
  for (const v of vehicles) {
    if (v.never_assigned)
      issues.push({ kind: 'vehicle_idle', blocks: [], plate: v.plate, detail: [] });
  }
  const scheduled = new Set(occs.map((o) => o.circuit));
  for (const c of circuits) {
    if (!scheduled.has(c.code)) {
      issues.push({ kind: 'circuit_without_vehicle', blocks: [], circuit: c.code, detail: [] });
    }
  }
  const assumed = new Set(occs.filter((o) => o.daysAssumed).map((o) => o.circuit));
  for (const circuit of [...assumed].sort(compareCircuit)) {
    issues.push({ kind: 'days_assumed', blocks: [], circuit, detail: [] });
  }
  return issues;
}

/** Junta o mesmo aviso que se repete em vários dias (mesma viatura, circuitos e turno) numa só linha. */
export function groupIssues(issues: Issue[]): Issue[] {
  const out = new Map<string, Issue>();
  for (const i of issues) {
    if (
      (i.kind !== 'plate_overlap' &&
        i.kind !== 'plate_grouped' &&
        i.kind !== 'wash_between_flows') ||
      i.day === undefined
    ) {
      out.set(`${out.size}|${i.kind}`, i);
      continue;
    }
    const key = [i.kind, i.plate, i.shift ?? '', i.detail.join(',')].join('|');
    const found = out.get(key);
    if (found) {
      found.days = [...(found.days ?? []), i.day].sort((a, b) => a - b);
      found.blocks = [...found.blocks, ...i.blocks];
    } else {
      out.set(key, { ...i, days: [i.day] });
    }
  }
  return [...out.values()];
}

export const issuesOf = (issues: Issue[], kind: IssueKind) => issues.filter((i) => i.kind === kind);

/** Localidades servidas apenas por circuitos sem viatura (as únicas "sem viatura" que os dados permitem saber). */
export function localitiesWithoutVehicle(
  localities: LocalityOut[],
  circuits: CircuitOut[],
): LocalityOut[] {
  const byCode = new Map(circuits.map((c) => [c.code, c]));
  return localities.filter(
    (l) => l.circuits.length > 0 && l.circuits.every((code) => !byCode.get(code)?.vehicles.length),
  );
}

/* ------------------------------------------------------------------ exportação */

export interface CsvRow {
  day: number;
  shift: Shift;
  circuit: string;
  typology: Typology;
  plate: string;
  crew: number;
  localities: string;
}

export function toCsvRows(occs: Occurrence[], circuits: CircuitOut[]): CsvRow[] {
  const byCode = new Map(circuits.map((c) => [c.code, c]));
  return occs.map((o) => ({
    day: o.day,
    shift: o.shift,
    circuit: o.circuit,
    typology: o.typology,
    plate: o.plate,
    crew: o.crew,
    localities: byCode.get(o.circuit)?.localities.join('; ') ?? '',
  }));
}

const ICS_DAY = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

const escapeIcs = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Dobra linhas a 75 octetos, como o RFC 5545 exige (sem partir carateres multi-byte). */
export function foldIcs(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + n > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const icsDate = (d: Date) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

const icsStamp = (d: Date) => `${icsDate(d)}T${d.toISOString().slice(11, 19).replace(/:/g, '')}Z`;

export type IcsMode = 'circuit' | 'vehicle';

export interface IcsLabels {
  shift: Record<Shift, string>;
  typology: Record<Typology, string>;
  /** Aviso de que é um planeamento tipo (vai na descrição de cada evento). */
  notice: string;
  calendarName: string;
  crew: (n: number) => string;
  localities: string;
  vehicle: string;
  circuit: string;
}

/**
 * Calendário .ics com eventos de dia inteiro que se repetem todas as semanas (sem horas: os dados não as têm).
 * Um evento por circuito (ou viatura), turno e conjunto de dias. `now` serve a data de início e os testes.
 */
export function buildIcs(
  occs: Occurrence[],
  circuits: CircuitOut[],
  mode: IcsMode,
  labels: IcsLabels,
  now: Date = new Date(),
): string {
  const byCode = new Map(circuits.map((c) => [c.code, c]));
  const groups = new Map<
    string,
    { subject: string; shift: Shift; days: Set<number>; items: Occurrence[] }
  >();
  for (const o of occs) {
    const subject = mode === 'circuit' ? o.circuit : o.plate;
    const k = `${subject}|${o.shift}`;
    const g = groups.get(k) ?? { subject, shift: o.shift, days: new Set<number>(), items: [] };
    g.days.add(o.day);
    g.items.push(o);
    groups.set(k, g);
  }
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Novelo//Frota semana tipo//PT',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcs(labels.calendarName)}`,
  ];
  const sorted = [...groups.values()].sort(
    (a, b) =>
      compareCircuit(a.subject, b.subject) || SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift),
  );
  for (const g of sorted) {
    const days = [...g.days].sort((a, b) => a - b);
    // Primeira data, a partir de hoje, que cai num dos dias do evento (o RRULE repete-se dali em diante).
    const start = new Date(today);
    for (let i = 0; i < 7; i++) {
      const iso = ((start.getUTCDay() + 6) % 7) + 1;
      if (days.includes(iso)) break;
      start.setUTCDate(start.getUTCDate() + 1);
    }
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const circuitsText = [...new Set(g.items.map((i) => i.circuit))].sort(compareCircuit);
    const platesText = [...new Set(g.items.map((i) => i.plate))].sort();
    const crew = Math.max(...g.items.map((i) => i.crew));
    const typology = g.items[0]?.typology ?? 'undifferentiated';
    const summary =
      mode === 'circuit'
        ? `${g.subject} · ${labels.shift[g.shift]} · ${platesText.join(', ')}`
        : `${g.subject} · ${labels.shift[g.shift]} · ${circuitsText.join(', ')}`;
    const description = [
      labels.notice,
      `${labels.circuit}: ${circuitsText.join(', ')}`,
      `${labels.vehicle}: ${platesText.join(', ')}`,
      `${labels.crew(crew)}`,
      circuitsText.map((c) => byCode.get(c)?.localities.join(', ')).filter(Boolean).length
        ? `${labels.localities}: ${[
            ...new Set(circuitsText.flatMap((c) => byCode.get(c)?.localities ?? [])),
          ].join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:fleet-${mode}-${g.subject.replace(/[^A-Za-z0-9]+/g, '_')}-${g.shift}@novelo.helder.si`,
      `DTSTAMP:${icsStamp(now)}`,
      `DTSTART;VALUE=DATE:${icsDate(start)}`,
      `DTEND;VALUE=DATE:${icsDate(end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => ICS_DAY[d]).join(',')}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `CATEGORIES:${escapeIcs(labels.typology[typology])}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcs).join('\r\n')}\r\n`;
}

/** Dia da semana atual (1 = segunda ... 7 = domingo). */
export const isoWeekday = (date: Date = new Date()) => ((date.getDay() + 6) % 7) + 1;

/**
 * Localidades pela ordem do percurso da Vitrus: circuito a circuito (na ordem dada) e, dentro de cada um, na
 * sequência em que a API as devolve. Cada localidade fica na posição da primeira vez que aparece.
 */
export function routeOrder(codes: string[], circuits: Map<string, CircuitOut>): string[] {
  return [...new Set(codes.flatMap((code) => circuits.get(code)?.localities ?? []))];
}
