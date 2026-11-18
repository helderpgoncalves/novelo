/** O controlo do ecrã da paragem: cola a fila (`outbox/`), a sessão (`session.ts`) e os gatilhos de rede.
 *
 * Cada gesto do operador enfileira uma operação (aplicada logo à sessão, offline incluído) e pede um
 * despejo; a sincronização reconcilia a sessão com o que a API devolveu (código do lote, ids das unidades).
 * O dispositivo (balança/impressora) fica fora daqui: o ecrã fala com a porta (`device/port.ts`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionAction, StopLocality, StopSession, UnitRef } from '../session';
import { initialSession, stopSession } from '../session';
import { flushQueue } from './flush';
import {
  type NewStopOp,
  pendingCount,
  type QueueAction,
  type QueueState,
  stopQueue,
} from './queue';
import { apiSender } from './sender';
import { loadOps, replaceOps } from './store';
import { initOutboxSync } from './sync-trigger';

/** id local (op/paragem): uuid no dispositivo; fallback determinístico para os testes sem WebCrypto completa. */
export const localId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID();
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export function useStopController() {
  const [queue, setQueue] = useState<QueueState>({ ops: [] });
  const [session, setSession] = useState<StopSession>(initialSession);
  const [restored, setRestored] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const queueRef = useRef<QueueState>({ ops: [] });
  const sessionRef = useRef<StopSession>(initialSession());
  const flushingRef = useRef(false);

  const apply = useCallback((queueActions: QueueAction[], sessionActions: SessionAction[] = []) => {
    const before = queueRef.current;
    const nextQueue = queueActions.reduce(stopQueue, before);
    let nextSession = sessionActions.reduce(stopSession, sessionRef.current);
    // Reconciliação: os resultados da sincronização atualizam a sessão (código do lote, id por unidade).
    for (const action of queueActions) {
      if (action.type !== 'mark-done') continue;
      const op = before.ops.find((candidate) => candidate.id === action.id);
      if (!op) continue;
      if (op.kind === 'open-stop') {
        nextSession = stopSession(nextSession, {
          type: 'synced',
          opId: op.id,
          result: action.result,
        });
      } else if (op.kind === 'add-unit') {
        nextSession = stopSession(nextSession, {
          type: 'synced',
          opId: op.id,
          result: action.result,
          unitRef: op.payload.code,
        });
      }
    }
    queueRef.current = nextQueue;
    sessionRef.current = nextSession;
    setQueue(nextQueue);
    setSession(nextSession);
    void replaceOps(nextQueue.ops).catch(() => undefined);
    return nextQueue;
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current) return; // um despejo de cada vez (as operações dependem umas das outras)
    flushingRef.current = true;
    setSyncing(true);
    try {
      // As falhadas tentam de novo em cada despejo (o operador pediu, ou a rede voltou).
      if (queueRef.current.ops.some((op) => op.status === 'failed')) {
        apply([{ type: 'retry-failed' }]);
      }
      const { actions, outcome } = await flushQueue(queueRef.current, apiSender);
      apply(actions);
      if (outcome.done || outcome.retryable) return;
      // Definitivo: fica visível no ecrã («falhou», com o motivo) — o despejo não insiste em loop.
    } finally {
      flushingRef.current = false;
      setSyncing(false);
    }
  }, [apply]);

  // A fila restaura do dispositivo ao abrir o ecrã; os gatilhos de rede ligam-se uma vez.
  useEffect(() => {
    let alive = true;
    void loadOps()
      .then((ops) => {
        if (!alive) return;
        apply([{ type: 'restore', ops }]);
        setRestored(true);
      })
      .catch(() => setRestored(true));
    const cleanup = initOutboxSync(() => void flush());
    return () => {
      alive = false;
      cleanup();
    };
  }, [apply, flush]);

  const enqueue = useCallback(
    (op: NewStopOp) => {
      apply([{ type: 'enqueue', op }], [{ type: 'op', op }]);
      void flush();
    },
    [apply, flush],
  );

  const pickLocality = useCallback((locality: StopLocality) => {
    const next = stopSession(sessionRef.current, { type: 'pick-locality', locality });
    sessionRef.current = next;
    setSession(next);
  }, []);

  const arrive = useCallback(
    (parishCode: string | null) => {
      if (!sessionRef.current.locality) return;
      enqueue({
        id: localId(),
        stopId: localId(),
        kind: 'open-stop',
        at: Date.now(),
        payload: { localityId: sessionRef.current.locality.id, parishCode },
      });
    },
    [enqueue],
  );

  const recordUnit = useCallback(
    (code: string, source: 'bag' | 'label') => {
      const stopId = sessionRef.current.stopId;
      if (!stopId) return;
      enqueue({
        id: localId(),
        stopId,
        kind: 'add-unit',
        at: Date.now(),
        payload: { code, source },
      });
    },
    [enqueue],
  );

  const confirmWeight = useCallback(
    (unitRef: UnitRef, weightG: number) => {
      const stopId = sessionRef.current.stopId;
      if (!stopId) return;
      enqueue({
        id: localId(),
        stopId,
        kind: 'set-weight',
        at: Date.now(),
        payload: { unitRef, weightG },
      });
    },
    [enqueue],
  );

  const removeUnitOp = useCallback(
    (unitRef: UnitRef) => {
      const stopId = sessionRef.current.stopId;
      if (!stopId) return;
      enqueue({ id: localId(), stopId, kind: 'remove-unit', at: Date.now(), payload: { unitRef } });
    },
    [enqueue],
  );

  const departOp = useCallback(() => {
    const stopId = sessionRef.current.stopId;
    if (!stopId) return;
    enqueue({ id: localId(), stopId, kind: 'departure', at: Date.now(), payload: {} });
  }, [enqueue]);

  const markPrintedRef = useCallback((ref: UnitRef) => {
    const next = stopSession(sessionRef.current, { type: 'printed', ref });
    sessionRef.current = next;
    setSession(next);
  }, []);

  const purgeDone = useCallback(() => apply([{ type: 'purge-done' }]), [apply]);

  /** Nova paragem: limpa a sessão local (a fila fica com o histórico; o IndexedDB mantém tudo). */
  const newStop = useCallback(() => {
    const fresh = initialSession();
    sessionRef.current = fresh;
    setSession(fresh);
  }, []);

  return {
    queue,
    session,
    restored,
    syncing,
    pending: pendingCount(queue),
    failedCount: queue.ops.filter((op) => op.status === 'failed').length,
    pickLocality,
    arrive,
    recordUnit,
    confirmWeight,
    removeUnitOp,
    departOp,
    markPrintedRef,
    purgeDone,
    newStop,
    flush,
  };
}
