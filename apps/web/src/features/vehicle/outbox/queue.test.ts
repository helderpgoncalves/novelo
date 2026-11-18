import { beforeEach, describe, expect, it } from 'vitest';
import { type NewStopOp, type QueueAction, type StopOp, stopQueue } from './queue';

// Sequências construídas à mão: a fila «à espera de sincronização» do ecrã da paragem (#58).
let seq = 0;

beforeEach(() => {
  seq = 0;
});

const open = (stopId: string, at: number): NewStopOp => ({
  id: `op-${++seq}`,
  kind: 'open-stop',
  stopId,
  at,
  payload: { localityId: 'loc-1', parishCode: null },
});

const addUnit = (stopId: string, at: number, code: string): NewStopOp => ({
  id: `op-${++seq}`,
  kind: 'add-unit',
  stopId,
  at,
  payload: { code, source: code.includes('-') && code.length === 36 ? 'label' : 'bag' },
});

const setWeight = (stopId: string, at: number, unitRef: string, weightG: number): NewStopOp => ({
  id: `op-${++seq}`,
  kind: 'set-weight',
  stopId,
  at,
  payload: { unitRef, weightG },
});

const depart = (stopId: string, at: number): NewStopOp => ({
  id: `op-${++seq}`,
  kind: 'departure',
  stopId,
  at,
  payload: {},
});

const dispatchAll = (actions: QueueAction[]): StopOp[] =>
  actions.reduce(stopQueue, { ops: [] }).ops;

describe('fila da paragem «à espera de sincronização»', () => {
  it('uma ronda offline enfileira abrir → saco → peso → partir, pela ordem registada', () => {
    const ops = dispatchAll([
      { type: 'enqueue', op: open('stop-1', 1) },
      { type: 'enqueue', op: addUnit('stop-1', 2, 'SACO-A') },
      { type: 'enqueue', op: setWeight('stop-1', 3, 'SACO-A', 4_200) },
      { type: 'enqueue', op: depart('stop-1', 4) },
    ]);
    expect(ops.map((o) => o.kind)).toEqual(['open-stop', 'add-unit', 'set-weight', 'departure']);
    expect(ops.every((o) => o.status === 'queued')).toBe(true);
    expect(ops.every((o) => o.attempts === 0)).toBe(true);
  });

  it('a fila nunca muda a ordem: o peso de um saco nunca à frente do saco', () => {
    const ops = dispatchAll([
      { type: 'enqueue', op: open('stop-1', 1) },
      { type: 'enqueue', op: addUnit('stop-1', 2, 'SACO-A') },
      // Um segundo saco registado antes de pesar o primeiro (a ordem de registo manda).
      { type: 'enqueue', op: addUnit('stop-1', 3, 'SACO-B') },
      { type: 'enqueue', op: setWeight('stop-1', 4, 'SACO-B', 2_600) },
    ]);
    expect(ops.map((o) => o.payload)).toMatchObject([
      { localityId: 'loc-1' },
      { code: 'SACO-A' },
      { code: 'SACO-B' },
      { unitRef: 'SACO-B', weightG: 2_600 },
    ]);
  });

  it('sincronizar marca a operação a correr e depois feita, com o resultado do servidor', () => {
    const [openOp, ...rest] = dispatchAll([
      { type: 'enqueue', op: open('stop-1', 1) },
      { type: 'enqueue', op: addUnit('stop-1', 2, 'SACO-A') },
      { type: 'mark-syncing', id: 'op-1' },
      { type: 'mark-done', id: 'op-1', result: { lotCode: 'NOV-ABC234' } },
    ]);
    expect(openOp?.status).toBe('done');
    expect(openOp?.result).toEqual({ lotCode: 'NOV-ABC234' });
    expect(rest.every((o) => o.status === 'queued')).toBe(true);
  });

  it('um erro definitivo marca a operação como falhada sem a perder; o operador volta a tentar', () => {
    const [, failed, ...rest] = dispatchAll([
      { type: 'enqueue', op: open('stop-1', 1) },
      { type: 'enqueue', op: addUnit('stop-1', 2, 'SACO-A') },
      { type: 'mark-syncing', id: 'op-2' },
      { type: 'mark-failed', id: 'op-2', error: 'A viatura já partiu desta paragem' },
    ]);
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toContain('já partiu');
    expect(failed?.attempts).toBe(1);
    expect(rest.every((o) => o.status === 'queued')).toBe(true);
  });

  it('voltar a tentar repõe a falhada na fila, mantendo as tentativas contadas', () => {
    const ops = dispatchAll([
      { type: 'enqueue', op: open('stop-1', 1) },
      { type: 'mark-syncing', id: 'op-1' },
      { type: 'mark-failed', id: 'op-1', error: 'rede' },
      { type: 'retry-failed' },
    ]);
    expect(ops[0]?.status).toBe('queued');
    expect(ops[0]?.attempts).toBe(1);
    expect(ops[0]?.error).toBeNull();
  });

  it('as feitas saem com «limpar», as pendentes ficam', () => {
    const ops = dispatchAll([
      { type: 'enqueue', op: open('stop-1', 1) },
      { type: 'enqueue', op: addUnit('stop-1', 2, 'SACO-A') },
      { type: 'mark-syncing', id: 'op-1' },
      { type: 'mark-done', id: 'op-1', result: { lotCode: 'NOV-ABC234' } },
      { type: 'purge-done' },
    ]);
    expect(ops.map((o) => o.kind)).toEqual(['add-unit']);
    expect(ops[0]?.status).toBe('queued');
  });

  it('ao abrir o ecrã, a fila restaura do IndexedDB pela ordem cronológica', () => {
    const saved: StopOp[] = [
      { ...open('stop-2', 30), status: 'queued', attempts: 0, error: null, result: null },
      {
        ...open('stop-1', 10),
        status: 'done',
        attempts: 1,
        error: null,
        result: { lotCode: 'NOV-XYZ789' },
      },
      {
        ...addUnit('stop-1', 20, 'SACO-A'),
        status: 'queued',
        attempts: 0,
        error: null,
        result: null,
      },
    ];
    const ops = stopQueue({ ops: [] }, { type: 'restore', ops: saved });
    // Ordem cronológica (não a ordem do disco); as feitas continuam feitas.
    expect(ops.ops.map((o) => o.at)).toEqual([10, 20, 30]);
    expect(ops.ops[0]?.status).toBe('done');
  });
});
