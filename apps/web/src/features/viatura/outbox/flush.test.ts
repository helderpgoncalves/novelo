import { beforeEach, describe, expect, it } from 'vitest';
import { flushQueue, type OutboxSender, SenderError } from './flush';
import { type NewStopOp, type QueueAction, type StopOp, stopQueue } from './queue';

let seq = 0;
beforeEach(() => {
  seq = 0;
});

const op = <K extends NewStopOp['kind']>(
  kind: K,
  at: number,
  payload: Extract<NewStopOp, { kind: K }>['payload'],
  stopId = 's1',
): NewStopOp => ({ id: `op-${++seq}`, stopId, kind, at, payload }) as NewStopOp;

const LABEL_UUID = '9f6e2b1c-1111-4222-8333-444455556666';

/** Falso do lado da API: regista as chamadas e obedece ao guião (uma entrada por chamada: ok | network | bad | conflict). */
function fakeSender(
  script: Array<'ok' | 'network' | 'bad' | 'conflict'> = [],
): OutboxSender & { calls: string[] } {
  const calls: string[] = [];
  let step = 0;
  const next = (): 'ok' | 'network' | 'bad' | 'conflict' => script[step++] ?? 'ok';
  const throwIf = (what: 'ok' | 'network' | 'bad' | 'conflict') => {
    if (what === 'network') throw new SenderError('sem rede', { retryable: true });
    if (what === 'bad') throw new SenderError('pedido recusado pela API', { retryable: false });
    if (what === 'conflict') throw new SenderError('QR já no lote', { conflict: true });
  };
  const sender = {
    calls,
    async openStop({ localityId }: { localityId: string }) {
      calls.push(`open:${localityId}`);
      throwIf(next());
      return { lotCode: 'NOV-ABC234' };
    },
    async addUnit({ code }: { lotCode: string; code: string; source: 'bag' | 'label' }) {
      calls.push(`add:${code}`);
      throwIf(next());
      return { unitId: `u-${code}` };
    },
    async setWeight({ weightG }: { lotCode: string; unitId: string; weightG: number }) {
      calls.push(`weight:${weightG}`);
      throwIf(next());
    },
    async removeUnit({ unitId }: { lotCode: string; unitId: string }) {
      calls.push(`remove:${unitId}`);
      throwIf(next());
    },
    async departure({ lotCode }: { lotCode: string }) {
      calls.push(`depart:${lotCode}`);
      throwIf(next());
    },
    async findUnitId(_lotCode: string, code: string) {
      calls.push(`find:${code}`);
      return `u-${code}`;
    },
  };
  return sender;
}

const run = (state: { ops: StopOp[] }, sender: OutboxSender) => flushQueue(state, sender);

/** Fila construída à mão: as operações entram enfileiradas, como o ecrã as regista. */
const queueOf = (ops: NewStopOp[]) =>
  ops
    .map((single): QueueAction => ({ type: 'enqueue', op: single }))
    .reduce(stopQueue, { ops: [] });

describe('despejo da fila (a sincronização, pela ordem de registo)', () => {
  it('uma ronda completa despeja em FIFO: abrir → saco → peso → partir', async () => {
    const state = queueOf([
      op('open-stop', 1, { localityId: 'loc-1', parishCode: null }),
      op('add-unit', 2, { code: 'SACO-A', source: 'bag' }),
      op('set-weight', 3, { unitRef: 'SACO-A', weightG: 4_200 }),
      op('departure', 4, {}),
    ]);
    const sender = fakeSender();
    const { actions, outcome } = await run(state, sender);
    expect(outcome).toEqual({ flushed: 4, done: true });
    expect(sender.calls).toEqual(['open:loc-1', 'add:SACO-A', 'weight:4200', 'depart:NOV-ABC234']);
    // Cada operação: marca a correr, marca feita.
    expect(actions.filter((a) => a.type === 'mark-done')).toHaveLength(4);
    expect(state.ops.every((o) => o.status === 'queued')).toBe(true); // o estado de entrada não se muda
  });

  it('erro transitório a meio: para sem perder nada, o resto continua na fila', async () => {
    const state = queueOf([
      op('open-stop', 1, { localityId: 'loc-1', parishCode: null }),
      op('add-unit', 2, { code: 'SACO-A', source: 'bag' }),
      op('set-weight', 3, { unitRef: 'SACO-A', weightG: 4_200 }),
    ]);
    const sender = fakeSender(['ok', 'network']);
    const { outcome } = await run(state, sender);
    expect(outcome).toEqual({
      flushed: 1,
      done: false,
      retryable: true,
      error: 'sem rede',
      stoppedAt: expect.any(String),
    });
    // A ação não marca falha: a operação segue 'queued' para a próxima tentativa.
    const marks = (outcome as { flushed: number }).flushed;
    expect(marks).toBe(1);
  });

  it('erro definitivo: marca a falhada (o operador vê o motivo) e não despeja o resto', async () => {
    const state = queueOf([
      op('open-stop', 1, { localityId: 'loc-x', parishCode: null }),
      op('add-unit', 2, { code: 'SACO-A', source: 'bag' }),
    ]);
    const sender = fakeSender(['ok', 'bad']);
    const { actions, outcome } = await run(state, sender);
    expect(outcome.done).toBe(false);
    if (!outcome.done) expect(outcome.retryable).toBe(false);
    const failed = actions.find((a) => a.type === 'mark-failed');
    expect(failed && 'error' in failed ? failed.error : null).toContain('recusado');
  });

  it('409 no saco = já lá está (fila repetida): reconcilia pelo código e segue', async () => {
    const state = queueOf([
      op('open-stop', 1, { localityId: 'loc-1', parishCode: null }),
      op('add-unit', 2, { code: LABEL_UUID, source: 'label' }),
      op('set-weight', 3, { unitRef: LABEL_UUID, weightG: 3_800 }),
    ]);
    const sender = fakeSender(['ok', 'conflict']);
    const { actions, outcome } = await run(state, sender);
    expect(outcome.done).toBe(true);
    expect(sender.calls).toContain(`find:${LABEL_UUID}`);
    const doneAdd = actions.filter((a) => a.type === 'mark-done')[1];
    expect(doneAdd && 'result' in doneAdd ? doneAdd.result : null).toEqual({
      unitId: `u-${LABEL_UUID}`,
    });
  });

  it('peso vai sempre ao id do servidor resolvido do add-unit (não à referência local)', async () => {
    const state = queueOf([
      op('open-stop', 1, { localityId: 'loc-1', parishCode: null }),
      op('add-unit', 2, { code: LABEL_UUID, source: 'label' }),
      op('set-weight', 3, { unitRef: LABEL_UUID, weightG: 3_800 }),
    ]);
    const sender = fakeSender();
    const { outcome } = await run(state, sender);
    expect(outcome.done).toBe(true);
    expect(sender.calls).toContain('weight:3800');
    expect(sender.calls.join(' ')).not.toContain(`weight:u-${LABEL_UUID}`); // nunca o id no sítio do peso
  });

  it('remover uma unidade que nunca chegou ao servidor não chama a API', async () => {
    const state = queueOf([
      op('open-stop', 1, { localityId: 'loc-1', parishCode: null }),
      op('remove-unit', 2, { unitRef: 'FANTASMA' }),
    ]);
    const sender = fakeSender();
    const { outcome } = await run(state, sender);
    expect(outcome.done).toBe(true);
    expect(sender.calls).toEqual(['open:loc-1']);
  });
});
