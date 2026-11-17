import { beforeEach, describe, expect, it } from 'vitest';
import type { NewStopOp } from './outbox/queue';
import { initialSession, type SessionAction, type StopSession, stopSession } from './session';

let seq = 0;
beforeEach(() => {
  seq = 0;
});

const LABEL_UUID = '9f6e2b1c-1111-4222-8333-444455556666';

const pickLocality: SessionAction = {
  type: 'pick-locality',
  locality: { id: 'loc-1', name: 'Escola de São Torcato', parishCode: '030952' },
};
const open = (at: number): NewStopOp => ({
  id: `op-${++seq}`,
  kind: 'open-stop',
  stopId: 's1',
  at,
  payload: { localityId: 'loc-1', parishCode: null },
});
const addBag = (at: number, code: string): NewStopOp => ({
  id: `op-${++seq}`,
  kind: 'add-unit',
  stopId: 's1',
  at,
  payload: { code, source: 'bag' },
});
const addLabel = (at: number, code: string): NewStopOp => ({
  id: `op-${++seq}`,
  kind: 'add-unit',
  stopId: 's1',
  at,
  payload: { code, source: 'label' },
});
const weigh = (at: number, unitRef: string, weightG: number): NewStopOp => ({
  id: `op-${++seq}`,
  kind: 'set-weight',
  stopId: 's1',
  at,
  payload: { unitRef, weightG },
});
const removeUnit = (at: number, unitRef: string): NewStopOp => ({
  id: `op-${++seq}`,
  kind: 'remove-unit',
  stopId: 's1',
  at,
  payload: { unitRef },
});
const depart = (at: number): NewStopOp => ({
  id: `op-${++seq}`,
  kind: 'departure',
  stopId: 's1',
  at,
  payload: {},
});

const fold = (actions: SessionAction[]): StopSession =>
  actions.reduce(stopSession, initialSession());

describe('sessão da paragem (as operações contam a história)', () => {
  it('o operador escolhe o local; «Cheguei» abre a paragem', () => {
    const session = fold([pickLocality, { type: 'op', op: open(1) }]);
    expect(session.status).toBe('open');
    expect(session.locality?.name).toBe('Escola de São Torcato');
    expect(session.lotCode).toBeNull(); // o código do lote chega com a sincronização
  });

  it('os sacos acumulam: QR lido vira unidade; sem QR, etiqueta à espera de impressão', () => {
    const session = fold([
      pickLocality,
      { type: 'op', op: open(1) },
      { type: 'op', op: addBag(2, 'SACO-A') },
      { type: 'op', op: addLabel(3, LABEL_UUID) },
    ]);
    expect(session.units.map((u) => u.ref)).toEqual(['SACO-A', LABEL_UUID]);
    expect(session.units.map((u) => u.source)).toEqual(['bag', 'label']);
    expect(session.units[0]?.labelPrinted).toBe(true); // saco com QR não precisa de etiqueta
    // A etiqueta imprime-se no dispositivo: o ecrã passa «à espera» para «impressa».
    const printed = fold([
      pickLocality,
      { type: 'op', op: open(1) },
      { type: 'op', op: addLabel(3, LABEL_UUID) },
      { type: 'printed', ref: LABEL_UUID },
    ]);
    expect(printed.units[0]?.labelPrinted).toBe(true);
  });

  it('o mesmo QR não entra duas vezes no lote', () => {
    const session = fold([
      pickLocality,
      { type: 'op', op: open(1) },
      { type: 'op', op: addBag(2, 'SACO-A') },
      { type: 'op', op: addBag(3, 'SACO-A') },
    ]);
    expect(session.units).toHaveLength(1);
  });

  it('peso por saco: a app confirma já somado; corrigir substitui', () => {
    const session = fold([
      pickLocality,
      { type: 'op', op: open(1) },
      { type: 'op', op: addBag(2, 'SACO-A') },
      { type: 'op', op: weigh(3, 'SACO-A', 8_000) },
    ]);
    expect(session.units[0]?.weightG).toBe(8_000);
    // Correção direta por saco: pesar de novo substitui (o prato pesado anula-se).
    const corrected = fold([
      pickLocality,
      { type: 'op', op: open(1) },
      { type: 'op', op: addBag(2, 'SACO-A') },
      { type: 'op', op: weigh(3, 'SACO-A', 8_000) },
      { type: 'op', op: weigh(4, 'SACO-A', 7_900) },
    ]);
    expect(corrected.units[0]?.weightG).toBe(7_900);
  });

  it('remover o saco tira-o do lote (scan enganado)', () => {
    const session = fold([
      pickLocality,
      { type: 'op', op: open(1) },
      { type: 'op', op: addBag(2, 'SACO-A') },
      { type: 'op', op: addBag(3, 'SACO-B') },
      { type: 'op', op: weigh(4, 'SACO-A', 4_200) },
      { type: 'op', op: removeUnit(5, 'SACO-A') },
    ]);
    expect(session.units.map((u) => u.ref)).toEqual(['SACO-B']);
  });

  it('«Partir» fecha e congela: depois disso nenhum saco entra', () => {
    const departed = fold([
      pickLocality,
      { type: 'op', op: open(1) },
      { type: 'op', op: addBag(2, 'SACO-A') },
      { type: 'op', op: weigh(3, 'SACO-A', 4_200) },
      { type: 'op', op: depart(4) },
    ]);
    expect(departed.status).toBe('departed');
    const frozen = fold([
      pickLocality,
      { type: 'op', op: open(1) },
      { type: 'op', op: depart(2) },
      { type: 'op', op: addBag(3, 'SACO-TARDE') },
    ]);
    expect(frozen.units).toEqual([]);
  });

  it('a sincronização reconcilia: código do lote e id da unidade no servidor', () => {
    const session = fold([
      pickLocality,
      { type: 'op', op: open(1) },
      { type: 'op', op: addLabel(2, LABEL_UUID) },
      { type: 'synced', opId: 'op-1', result: { lotCode: 'NOV-ABC234' } },
      { type: 'synced', opId: 'op-2', result: { unitId: 'u-777' }, unitRef: LABEL_UUID },
    ]);
    expect(session.lotCode).toBe('NOV-ABC234');
    expect(session.units[0]?.serverId).toBe('u-777');
  });
});
