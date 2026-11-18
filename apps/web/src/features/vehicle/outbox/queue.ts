/** A fila de saída da paragem (reducer puro): tudo o que o operador registou e ainda não chegou ao servidor.
 *
 * O ecrã da viatura trabalha offline-first: cada operação («Cheguei», saco, peso, «Partir») enfileira-se e
 * aplica-se logo no dispositivo; a sincronização despeja pela ordem de registo quando a rede volta
 * (Background Sync / evento `online`). A persistência (IndexedDB) está em `store.ts`; aqui só o estado.
 */

export type StopOpKind = 'open-stop' | 'add-unit' | 'set-weight' | 'remove-unit' | 'departure';

/** Resultado que a sincronização traz para reconciliar o dispositivo com o servidor. */
export type StopOpResult =
  | { lotCode: string }
  | { unitId: string }
  | { removed: true }
  | { departed: true }
  | { ok: true };

export type StopOpStatus = 'queued' | 'syncing' | 'done' | 'failed';

/** O que distingue cada operação, fechado por tipo (a `kind` é que manda, como nos schemas da API). */
type OpShape<P> = { id: string; stopId: string; at: number; payload: P };

/** Operação nova, ainda sem estado de sincronização. */
export type NewStopOp =
  | (OpShape<{ localityId: string; parishCode: string | null }> & { kind: 'open-stop' })
  | (OpShape<{
      /** QR lido do saco, ou o UUID que o dispositivo gerou para a etiqueta impressa. */ code: string;
      source: 'bag' | 'label';
    }> & { kind: 'add-unit' })
  | (OpShape<{
      /** Referência estável da unidade no dispositivo (QR do saco ou UUID da etiqueta). */ unitRef: string;
      weightG: number;
    }> & { kind: 'set-weight' })
  | (OpShape<{ unitRef: string }> & { kind: 'remove-unit' })
  | (OpShape<Record<string, never>> & { kind: 'departure' });

/** O estado de sincronização que o reducer mantém por cima de cada operação. */
type SyncFields = {
  status: StopOpStatus;
  attempts: number;
  error: string | null;
  result: StopOpResult | null;
};

/** Operação registada no dispositivo (a intersecção distribui: continua fechada por `kind`). */
export type StopOp = NewStopOp & SyncFields;

export type QueueAction =
  | { type: 'enqueue'; op: NewStopOp }
  | { type: 'mark-syncing'; id: string }
  | { type: 'requeue'; id: string }
  | { type: 'mark-done'; id: string; result: StopOpResult }
  | { type: 'mark-failed'; id: string; error: string }
  | { type: 'retry-failed' }
  | { type: 'purge-done' }
  | { type: 'restore'; ops: StopOp[] };

export interface QueueState {
  ops: StopOp[];
}

const newOp = (op: NewStopOp): StopOp => ({
  ...op,
  status: 'queued',
  attempts: 0,
  error: null,
  result: null,
});

const byAt = (a: StopOp, b: StopOp) => a.at - b.at;

const updateById = (ops: StopOp[], id: string, patch: (op: StopOp) => StopOp): StopOp[] =>
  ops.map((op) => (op.id === id ? patch(op) : op));

/** O estado da fila: operações pela ordem de registo; cada ação devolve um estado novo (imutável). */
export function stopQueue(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'enqueue':
      return { ops: [...state.ops, newOp(action.op)] };
    case 'mark-syncing':
      return { ops: updateById(state.ops, action.id, (op) => ({ ...op, status: 'syncing' })) };
    case 'requeue':
      // Falha transitória: a operação volta a 'queued' (o despejo seguinte tenta-a outra vez).
      return { ops: updateById(state.ops, action.id, (op) => ({ ...op, status: 'queued' })) };
    case 'mark-done':
      return {
        ops: updateById(state.ops, action.id, (op) => ({
          ...op,
          status: 'done',
          result: action.result,
          error: null,
        })),
      };
    case 'mark-failed':
      return {
        ops: updateById(state.ops, action.id, (op) => ({
          ...op,
          status: 'failed',
          attempts: op.attempts + 1,
          error: action.error,
        })),
      };
    case 'retry-failed':
      return {
        ops: state.ops.map((op) =>
          op.status === 'failed' ? { ...op, status: 'queued', error: null } : op,
        ),
      };
    case 'purge-done':
      return { ops: state.ops.filter((op) => op.status !== 'done') };
    case 'restore':
      // Do IndexedDB volta em ordem cronológica, feitas incluídas (o ecrã reconcilia por cima).
      return { ops: [...action.ops].sort(byAt) };
  }
  return state;
}

/** Operações à espera de ir ao servidor (em curso ou na fila): o número que o operador vê. */
export function pendingOps(state: QueueState): StopOp[] {
  return state.ops.filter((op) => op.status !== 'done');
}

export function pendingCount(state: QueueState): number {
  return pendingOps(state).length;
}
