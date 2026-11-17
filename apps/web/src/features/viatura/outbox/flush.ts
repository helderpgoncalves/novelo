/** O despejo da fila: cada operação vai à API pela ordem de registo, uma a uma (cada uma depende da anterior).
 *
 * Devolve as ações para o reducer (`queue.ts`) — não muda estado nem fala com o IndexedDB. Erros:
 *  - transitório (rede): para sem marcar nada — a fila fica intacta para a próxima tentativa;
 *  - definitivo (4xx): marca `failed` com o motivo e para (o resto depende desta operação);
 *  - 409 no saco: já lá está (fila despejada duas vezes) — reconcilia pelo código e segue.
 */
import { type QueueAction, type QueueState, type StopOpResult, stopQueue } from './queue';

/** O lado da API, injetado (nos testes, um falso; na app, o cliente gerado). */
export interface OutboxSender {
  openStop(payload: {
    localityId: string;
    parishCode: string | null;
  }): Promise<{ lotCode: string }>;
  addUnit(payload: {
    lotCode: string;
    code: string;
    source: 'bag' | 'label';
  }): Promise<{ unitId: string }>;
  setWeight(payload: { lotCode: string; unitId: string; weightG: number }): Promise<void>;
  removeUnit(payload: { lotCode: string; unitId: string }): Promise<void>;
  departure(payload: { lotCode: string }): Promise<void>;
  /** Idempotência pelo código: o QR/UUID já está no lote (409) — devolve o id da unidade que lá está. */
  findUnitId(lotCode: string, code: string): Promise<string | null>;
}

export class SenderError extends Error {
  readonly retryable: boolean;
  readonly conflict: boolean;

  constructor(message: string, opts: { retryable?: boolean; conflict?: boolean } = {}) {
    super(message);
    this.name = 'SenderError';
    this.retryable = opts.retryable ?? false;
    this.conflict = opts.conflict ?? false;
  }
}

export type FlushOutcome =
  | { flushed: number; done: true }
  | { flushed: number; done: false; stoppedAt: string; retryable: boolean; error: string };

const stopOutcome = (
  flushed: number,
  op: { id: string; kind: string },
  retryable: boolean,
  error: string,
): FlushOutcome => ({ flushed, done: false, stoppedAt: `${op.kind}:${op.id}`, retryable, error });

/** Procura um resultado já despejado na fila em curso (o lote do `open-stop` desta paragem, o id de um `add-unit`). */
function resultOf(
  working: QueueState,
  match: (op: QueueState['ops'][number]) => boolean,
): StopOpResult | null {
  return working.ops.find(match)?.result ?? null;
}

export async function flushQueue(
  state: QueueState,
  sender: OutboxSender,
): Promise<{ actions: QueueAction[]; outcome: FlushOutcome }> {
  const actions: QueueAction[] = [];
  let working = state;
  let flushed = 0;

  const queue = state.ops.filter((op) => op.status === 'queued');
  for (const op of queue) {
    actions.push({ type: 'mark-syncing', id: op.id });
    working = stopQueue(working, { type: 'mark-syncing', id: op.id });
    try {
      const result = await executeOp(working, op, sender);
      const done: QueueAction = { type: 'mark-done', id: op.id, result };
      actions.push(done);
      working = stopQueue(working, done);
      flushed += 1;
    } catch (error) {
      if (error instanceof SenderError && error.retryable) {
        // Transitório: a operação fica 'queued' (só se desfaz o 'syncing') e o despejo pára aqui.
        return { actions, outcome: stopOutcome(flushed, op, true, error.message) };
      }
      const message = error instanceof Error ? error.message : 'erro a sincronizar';
      actions.push({ type: 'mark-failed', id: op.id, error: message });
      return { actions, outcome: stopOutcome(flushed, op, false, message) };
    }
  }
  return { actions, outcome: { flushed, done: true } };
}

async function executeOp(
  working: QueueState,
  op: QueueState['ops'][number],
  sender: OutboxSender,
): Promise<StopOpResult> {
  const lotResult = resultOf(
    working,
    (candidate) => candidate.kind === 'open-stop' && candidate.stopId === op.stopId,
  );
  const lotCode = lotResult && 'lotCode' in lotResult ? lotResult.lotCode : null;
  const needsLot = op.kind !== 'open-stop';
  if (needsLot && !lotCode)
    throw new SenderError('O lote da paragem ainda não sincronizou', { retryable: true });

  switch (op.kind) {
    case 'open-stop':
      return sender.openStop({
        localityId: op.payload.localityId,
        parishCode: op.payload.parishCode,
      });
    case 'add-unit': {
      try {
        return await sender.addUnit({
          lotCode: lotCode ?? '',
          code: op.payload.code,
          source: op.payload.source,
        });
      } catch (error) {
        if (error instanceof SenderError && error.conflict) {
          // Já está no lote (o despejo correu duas vezes): reconcilia pelo código — é para isto que o QR
          // da etiqueta leva o UUID nu.
          const unitId = await sender.findUnitId(lotCode ?? '', op.payload.code);
          if (unitId) return { unitId };
        }
        throw error;
      }
    }
    case 'set-weight': {
      const unitResult = resultOf(
        working,
        (candidate) =>
          candidate.kind === 'add-unit' &&
          candidate.stopId === op.stopId &&
          candidate.payload.code === op.payload.unitRef,
      );
      const unitId = unitResult && 'unitId' in unitResult ? unitResult.unitId : null;
      if (!unitId) throw new SenderError('A unidade ainda não sincronizou', { retryable: true });
      await sender.setWeight({ lotCode: lotCode ?? '', unitId, weightG: op.payload.weightG });
      return { ok: true };
    }
    case 'remove-unit': {
      const unitResult = resultOf(
        working,
        (candidate) =>
          candidate.kind === 'add-unit' &&
          candidate.stopId === op.stopId &&
          candidate.payload.code === op.payload.unitRef,
      );
      const unitId = unitResult && 'unitId' in unitResult ? unitResult.unitId : null;
      if (unitId) await sender.removeUnit({ lotCode: lotCode ?? '', unitId });
      // Sem id no servidor: a unidade nunca lá chegou — nada a apagar.
      return { removed: true };
    }
    case 'departure': {
      await sender.departure({ lotCode: lotCode ?? '' });
      return { departed: true };
    }
  }
}
