// PROTOTIPO (#50) — ecrã de paragem da viatura. CODIGO DESCARTAVEL: nunca promover.
// Modelo em memoria que encena as decisoes fechadas:
//  - #34 lote de recolha nasce na viatura, UM POR PARAGEM; pesagem unica se couber
//    na balança (15 kg), senao PARTES SOMADAS; etiqueta impressa SO quando nao ha QR de saco.
//  - #35 modo B: QR de conta mão a mão -> etiqueta de doador; anónimos = lote sem doador.
//  - #33 balança KERN 6/15 kg, impressora Zebra BLE; offline append-only + sync quando a rede volta.
//  - recolha a pedido 1:1: o lote E aquele saco (peso medido por saco).
// Nota: strings hardcoded pt-PT (MVP e so pt-PT; prototipo descartavel, nao polui o paraglide).

export type EncounterKind = 'bag-qr' | 'account-qr' | 'anonymous-bag';
export type BagKind = 'qr' | 'account' | 'anonymous';
export type StopKind = 'escola' | 'local' | 'pedido';
export type SyncState = 'open' | 'pending' | 'synced';

/** Um encontro = algo que existe fisicamente na paragem, antes do scan. */
export interface Encounter {
  what: EncounterKind;
  massG: number;
}

export interface RouteStop {
  site: string;
  kind: StopKind;
  detail: string;
  encounters: Encounter[];
}

export interface Bag {
  id: string;
  kind: BagKind;
  title: string;
  massG: number; // massa "real" (mundo simulado); o condutor so a conhece depois de pesar
  labelPrintedAt?: number;
  /** So na recolha a pedido (1:1: o lote e o saco). */
  bagWeightG?: number;
}

export interface Weighing {
  id: string;
  bagIds: string[];
  readingG: number;
  at: number;
}

export interface StopRecord {
  code: string;
  site: string;
  kind: StopKind;
  detail: string;
  bags: Bag[];
  weighings: Weighing[];
  consumed: number; // encontros ja consumidos pelo scanner
  openedAt: number;
  closedAt?: number;
  sync: SyncState;
}

export interface SimState {
  scenario: ScenarioId;
  online: boolean;
  team: string;
  routeName: string;
  route: RouteStop[];
  cursor: number; // paragem atual (primeira nao fechada)
  record: StopRecord | null; // paragem aberta (ou null a caminho da seguinte)
  history: StopRecord[]; // fechadas, mais recente primeiro
  lastEvent: string;
  lastWeigh: { ok: boolean; readingG: number } | null;
  seq: number;
}

export type ScenarioId = 'escola' | 'pesado' | 'modob' | 'pedido' | 'off';

export const SCALE_MAX_G = 15_000; // KERN IXC 10K-3M, faixa 6/15 kg

export const SCENARIOS: Array<{ id: ScenarioId; label: string; watch: string }> = [
  {
    id: 'escola',
    label: 'Escola · 3 sacos QR',
    watch: 'Caminho feliz do modo A: três sacos com QR, cabe numa pesagem só.',
  },
  {
    id: 'pesado',
    label: 'Local público · pesado',
    watch: '46,8 kg não cabem na balança: obriga a pesar em partes e somar.',
  },
  {
    id: 'modob',
    label: 'Modo B · mão a mão',
    watch: 'QR de conta (crédito) + sacos anónimos: etiqueta impressa em ambos.',
  },
  {
    id: 'pedido',
    label: 'A pedido · 1:1',
    watch: 'O lote E o saco: peso medido atribuído ao saco, composição exata.',
  },
  {
    id: 'off',
    label: 'Sem rede',
    watch: 'Tudo funciona offline; 2 registos ficam «à espera de sincronização».',
  },
];

/** Fila tipica para as paragens seguintes (contexto da rota; o cenario foca a atual). */
const NEXT_UP: Array<[EncounterKind, number]> = [
  ['bag-qr', 2_600],
  ['bag-qr', 2_200],
  ['anonymous-bag', 1_800],
];

function stop(
  site: string,
  kind: StopKind,
  detail: string,
  encounters: Array<[EncounterKind, number]> = [],
): RouteStop {
  return { site, kind, detail, encounters: encounters.map(([what, massG]) => ({ what, massG })) };
}

function closed(record: StopRecord, online: boolean): StopRecord {
  return {
    ...record,
    closedAt: record.closedAt ?? Date.now(),
    sync: online ? 'synced' : 'pending',
  };
}

function makeRecord(s: RouteStop, seq: number): StopRecord {
  return {
    code: `LT-${9000 + seq}`,
    site: s.site,
    kind: s.kind,
    detail: s.detail,
    bags: [],
    weighings: [],
    consumed: 0,
    openedAt: Date.now(),
    sync: 'open',
  };
}

/** Constroi o estado inicial de um cenario (rota do dia + historico pre-carregado). */
export function buildScenario(id: ScenarioId): SimState {
  const base = {
    scenario: id,
    team: 'Equipa · viatura T1 (têxtil, sem compactação) · condutor: M. Sá',
    routeName: 'Rota T1 · terça, 17 nov',
    cursor: 0,
    record: null,
    lastEvent: '',
    lastWeigh: null,
    seq: 1,
  };
  switch (id) {
    case 'escola':
      return {
        ...base,
        online: true,
        route: [
          stop('Escola de São Torcato', 'escola', 'São Torcato · sacos no recreio', [
            ['bag-qr', 2_600],
            ['bag-qr', 2_400],
            ['bag-qr', 2_800],
          ]),
          stop('Junta de Airão Santa Maria', 'local', 'Airão Santa Maria', NEXT_UP),
          stop('Escola de Pevidém', 'escola', 'Pevidém · 2 turnos', NEXT_UP),
        ],
        history: [],
      };
    case 'pesado': {
      const record = makeRecord(stop('Escola de Selho', 'escola', 'São Jorge de Selho', []), 1);
      return {
        ...base,
        online: true,
        route: [
          stop('Junta de Airão Santa Maria', 'local', 'Airão Santa Maria · contentores cheios', [
            ['bag-qr', 5_400],
            ['bag-qr', 5_400],
            ['bag-qr', 5_400],
            ['bag-qr', 5_400],
            ['bag-qr', 5_400],
            ['bag-qr', 5_400],
          ]),
          stop('Escola de Pevidém', 'escola', 'Pevidém', NEXT_UP),
        ],
        history: [closed({ ...record, bags: [], weighings: [], sync: 'open' }, true)],
      };
    }
    case 'modob':
      return {
        ...base,
        online: true,
        route: [
          stop('Mercado de Pevidém', 'local', 'Pevidém · entrega em mao, sem sacos da plataforma', [
            ['account-qr', 3_100],
            ['anonymous-bag', 1_800],
            ['anonymous-bag', 1_900],
          ]),
          stop('Escola de São Torcato', 'escola', 'São Torcato', NEXT_UP),
        ],
        history: [],
      };
    case 'pedido':
      return {
        ...base,
        online: true,
        route: [
          stop('Rua do Amial 12', 'pedido', 'Polvoreira · pedido #4218 · 1 saco · corte às 48 h', [
            ['bag-qr', 3_400],
          ]),
          stop('Junta de Airão Santa Maria', 'local', 'Airão Santa Maria', NEXT_UP),
        ],
        history: [],
      };
    case 'off': {
      const h1 = closed(
        makeRecord(stop('Escola de São Torcato', 'escola', 'São Torcato', []), 1),
        false,
      );
      const h2 = closed(
        makeRecord(stop('Junta de Airão Santa Maria', 'local', 'Airão Santa Maria', []), 2),
        false,
      );
      return {
        ...base,
        online: false,
        route: [
          stop('Escola de Pevidém', 'escola', 'Pevidém · 2 sacos no portão', [
            ['bag-qr', 2_600],
            ['bag-qr', 2_400],
          ]),
          stop('Mercado de Pevidém', 'local', 'Pevidém', NEXT_UP),
        ],
        history: [
          { ...h2, bags: [], weighings: [], sync: 'pending' },
          { ...h1, bags: [], weighings: [], sync: 'pending' },
        ],
      };
    }
  }
}

export type Action =
  | { type: 'reset'; scenario: ScenarioId }
  | { type: 'open-stop' }
  | { type: 'scan' }
  | { type: 'print-label'; bagId: string }
  | { type: 'weigh'; bagIds: string[] }
  | { type: 'unweigh'; weighingId: string }
  | { type: 'drop-bag'; bagId: string }
  | { type: 'close-stop' }
  | { type: 'set-online'; online: boolean };

function bagFrom(kind: EncounterKind, seq: number): Omit<Bag, 'id'> & { id: string } {
  switch (kind) {
    case 'bag-qr':
      return {
        id: `sg-${seq}`,
        kind: 'qr',
        title: `Saco #${9000 + seq}`,
        massG: 0,
      };
    case 'account-qr':
      return {
        id: `ct-${seq}`,
        kind: 'account',
        title: `Doador ${4000 + seq} (QR de conta)`,
        massG: 0,
      };
    case 'anonymous-bag':
      return { id: `an-${seq}`, kind: 'anonymous', title: `Saco anónimo ${seq}`, massG: 0 };
  }
}

export function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case 'reset':
      return buildScenario(action.scenario);

    case 'open-stop': {
      const s = state.route[state.cursor];
      if (!s || state.record) return state;
      return {
        ...state,
        record: makeRecord(s, state.seq + 10 * (state.cursor + 1)),
        lastEvent: `Paragem aberta: ${s.site}.`,
      };
    }

    case 'scan': {
      const rec = state.record;
      const s = state.route[state.cursor];
      if (!rec || !s || rec.closedAt) return state;
      const enc = s.encounters[rec.consumed];
      if (!enc) return { ...state, lastEvent: 'Nada mais à vista para escanear.' };
      const bag: Bag = { ...bagFrom(enc.what, state.seq), massG: enc.massG };
      const seq = state.seq + 1;
      const what =
        enc.what === 'bag-qr'
          ? `${bag.title} — QR lido, sem etiqueta.`
          : enc.what === 'account-qr'
            ? `${bag.title} — crédito só com pesagem; etiqueta de doador.`
            : `${bag.title} — sem QR: precisa de etiqueta impressa.`;
      return {
        ...state,
        seq,
        record: { ...rec, bags: [...rec.bags, bag], consumed: rec.consumed + 1 },
        lastEvent: what,
        lastWeigh: null,
      };
    }

    case 'print-label': {
      const rec = state.record;
      if (!rec) return state;
      const bag = rec.bags.find((b) => b.id === action.bagId);
      if (!bag || bag.kind === 'qr' || bag.labelPrintedAt) return state;
      return {
        ...state,
        record: {
          ...rec,
          bags: rec.bags.map((b) =>
            b.id === action.bagId ? { ...b, labelPrintedAt: Date.now() } : b,
          ),
        },
        lastEvent: `Etiqueta ${bag.id.toUpperCase()} impressa (Zebra ZQ511, BLE).`,
      };
    }

    case 'weigh': {
      const rec = state.record;
      if (!rec || action.bagIds.length === 0) return state;
      const sum = action.bagIds.reduce(
        (acc, id) => acc + (rec.bags.find((b) => b.id === id)?.massG ?? 0),
        0,
      );
      if (sum > SCALE_MAX_G) {
        return {
          ...state,
          lastWeigh: { ok: false, readingG: sum },
          lastEvent: 'Sobrecarga: o prato passa 15 kg. Pese em partes (1 a 1, 2 a 2, ...).',
        };
      }
      const seq = state.seq + 1;
      const weighing: Weighing = {
        id: `w-${seq}`,
        bagIds: action.bagIds,
        readingG: sum,
        at: Date.now(),
      };
      // A pedido 1:1: o lote E o saco -> o peso fica no saco.
      const bags =
        rec.kind === 'pedido' && action.bagIds.length === 1 && rec.bags.length === 1
          ? rec.bags.map((b) => (b.id === action.bagIds[0] ? { ...b, bagWeightG: sum } : b))
          : rec.bags;
      return {
        ...state,
        seq,
        record: { ...rec, bags, weighings: [...rec.weighings, weighing] },
        lastWeigh: { ok: true, readingG: sum },
        lastEvent: `Leitura: ${formatKg(sum)} (${action.bagIds.length} saco${action.bagIds.length > 1 ? 's' : ''}).`,
      };
    }

    case 'unweigh': {
      const rec = state.record;
      if (!rec) return state;
      return {
        ...state,
        record: { ...rec, weighings: rec.weighings.filter((w) => w.id !== action.weighingId) },
        lastEvent: 'Pesagem removida.',
      };
    }

    case 'drop-bag': {
      const rec = state.record;
      if (!rec) return state;
      const bag = rec.bags.find((b) => b.id === action.bagId);
      // A pesagem e do prato inteiro: se o saco saiu, a leitura dessa pesagem perde sentido.
      const weighed = rec.weighings.some((w) => w.bagIds.includes(action.bagId));
      return {
        ...state,
        record: {
          ...rec,
          bags: rec.bags.filter((b) => b.id !== action.bagId),
          weighings: rec.weighings
            .filter((w) => !w.bagIds.includes(action.bagId))
            .map((w) => ({ ...w, bagIds: w.bagIds.filter((id) => id !== action.bagId) })),
        },
        lastEvent: bag
          ? weighed
            ? `${bag.title} removido — pesagem desse prato anulada, pesar de novo.`
            : `${bag.title} removido do lote.`
          : '',
      };
    }

    case 'close-stop': {
      const rec = state.record;
      if (!rec || rec.closedAt) return state;
      const uncovered = uncoveredBags(rec).length;
      const done = closed(rec, state.online);
      const cursor = state.cursor + 1;
      return {
        ...state,
        cursor,
        record: null,
        history: [done, ...state.history],
        lastEvent:
          `Paragem fechada: ${formatKg(totalG(done))}, ${done.bags.length} sacos. ` +
          (state.online
            ? 'Registo sincronizado.'
            : 'Registo guardado no dispositivo — à espera de sincronização.') +
          (uncovered > 0 ? ` Aviso: ${uncovered} saco(s) ficaram sem pesar.` : ''),
      };
    }

    case 'set-online': {
      const history = action.online
        ? state.history.map((h) => (h.sync === 'pending' ? { ...h, sync: 'synced' as const } : h))
        : state.history;
      return {
        ...state,
        online: action.online,
        history,
        lastEvent: action.online
          ? 'Rede de volta (Background Sync): registos pendentes sincronizados.'
          : 'Sem rede: pesagem e impressão continuam a trabalhar (BLE e local).',
      };
    }
  }
}

// ---------- seletores ----------

export function totalG(rec: StopRecord): number {
  return rec.weighings.reduce((acc, w) => acc + w.readingG, 0);
}

/** Sacos que ainda não entraram em nenhuma pesagem. */
export function uncoveredBags(rec: StopRecord): Bag[] {
  const covered = new Set(rec.weighings.flatMap((w) => w.bagIds));
  return rec.bags.filter((b) => !covered.has(b.id));
}

/** Sacos sem QR de saco (modo B ou anónimos): etiqueta impressa. */
export function labelBags(rec: StopRecord): Bag[] {
  return rec.bags.filter((b) => b.kind !== 'qr');
}

/** Agrupamento automatico do prato (variante C): greedy first-fit, pratos <= 15 kg. */
export function autoPlates(rec: StopRecord): string[][] {
  const plates: Array<{ ids: string[]; g: number }> = [];
  for (const bag of rec.bags) {
    const fit = plates.find((p) => p.g + bag.massG <= SCALE_MAX_G);
    if (fit) {
      fit.ids.push(bag.id);
      fit.g += bag.massG;
    } else {
      plates.push({ ids: [bag.id], g: bag.massG });
    }
  }
  return plates.map((p) => p.ids);
}

// ---------- utilidades ----------

export function formatKg(g: number): string {
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(g / 1000)} kg`;
}

export function formatTime(t: number): string {
  return new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' }).format(t);
}
