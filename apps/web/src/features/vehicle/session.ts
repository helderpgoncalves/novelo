/** Estado do ecrã da paragem: as operações contam a história (mesmo offline), o servidor só reconcilia.
 *
 * O ecrã aplica cada operação localmente no instante do registo («o scan manda») e a sincronização traz de
 * volta o código do lote e os ids das unidades. Puras: testam-se com sequências construídas à mão.
 */
import type { NewStopOp, StopOpResult } from './outbox/queue';

/** Referência estável de uma unidade no dispositivo: o QR do saco, ou o UUID da etiqueta impressa. */
export type UnitRef = string;

export interface StopUnit {
  ref: UnitRef;
  source: 'bag' | 'label';
  /** Peso confirmado (gramas): a soma dos pratos ≤ 15 kg que o operador confirmou. */
  weightG: number | null;
  /** A etiqueta saiu da impressora? (saco com QR não precisa; etiqueta imprime-se logo ao registar). */
  labelPrinted: boolean;
  /** id da unidade no servidor, depois de sincronizar (o peso vai a `PUT /lots/{code}/units/{id}`). */
  serverId: string | null;
}

export interface StopLocality {
  id: string;
  name: string;
  parishCode: string | null;
}

export interface StopSession {
  /** `idle` a caminho, `open` («Cheguei»), `departed` («Partir»; unidades congeladas). */
  status: 'idle' | 'open' | 'departed';
  /** id local da paragem (agrupa as operações na fila). */
  stopId: string | null;
  /** Código do lote (`NOV-…`): chega com a sincronização; offline fica nulo. */
  lotCode: string | null;
  locality: StopLocality | null;
  units: StopUnit[];
}

export type SessionAction =
  | { type: 'pick-locality'; locality: StopLocality }
  | { type: 'op'; op: NewStopOp }
  | { type: 'synced'; opId: string; result: StopOpResult; unitRef?: UnitRef }
  | { type: 'printed'; ref: UnitRef };

export const initialSession = (): StopSession => ({
  status: 'idle',
  stopId: null,
  lotCode: null,
  locality: null,
  units: [],
});

/** Marca a etiqueta de uma unidade como impressa no dispositivo. */
export function markPrinted(session: StopSession, ref: UnitRef): StopSession {
  return {
    ...session,
    units: session.units.map((u) => (u.ref === ref ? { ...u, labelPrinted: true } : u)),
  };
}

/** A sessão é o dobrar das operações registadas (e dos resultados da sincronização) sobre o estado vazio. */
export function stopSession(state: StopSession, action: SessionAction): StopSession {
  switch (action.type) {
    case 'pick-locality':
      return { ...state, locality: action.locality };
    case 'op': {
      const { op } = action;
      // Congelado: depois de «Partir» nada entra nem se pesa (o servidor recusaria).
      if (state.status === 'departed') return state;
      switch (op.kind) {
        case 'open-stop':
          if (state.status === 'open') return state;
          return { ...state, status: 'open', stopId: op.id, lotCode: null, units: [] };
        case 'add-unit': {
          // O mesmo QR não entra duas vezes no lote.
          if (state.units.some((u) => u.ref === op.payload.code)) return state;
          return {
            ...state,
            units: [
              ...state.units,
              {
                ref: op.payload.code,
                source: op.payload.source,
                weightG: null,
                labelPrinted: op.payload.source === 'bag',
                serverId: null,
              },
            ],
          };
        }
        case 'set-weight':
          return {
            ...state,
            units: state.units.map((u) =>
              u.ref === op.payload.unitRef ? { ...u, weightG: op.payload.weightG } : u,
            ),
          };
        case 'remove-unit':
          return { ...state, units: state.units.filter((u) => u.ref !== op.payload.unitRef) };
        case 'departure':
          return { ...state, status: 'departed' };
      }
      return state;
    }
    case 'synced': {
      const next =
        'lotCode' in action.result ? { ...state, lotCode: action.result.lotCode } : state;
      if ('unitId' in action.result && action.unitRef) {
        return markUnitId(next, action.unitRef, action.result.unitId);
      }
      return next;
    }
    case 'printed':
      return markPrinted(state, action.ref);
  }
}

function markUnitId(state: StopSession, ref: UnitRef, unitId: string): StopSession {
  return {
    ...state,
    units: state.units.map((u) => (u.ref === ref ? { ...u, serverId: unitId } : u)),
  };
}
