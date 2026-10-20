import { useSyncExternalStore } from 'react';

/**
 * Estado global "o copiloto está a gerar": quem gera (por conversa) e que respostas terminaram fora de vista.
 * Vive fora do React para sobreviver a navegar entre páginas, ao painel ⌘K e à troca de conversa.
 * Quem escreve é o gestor de streams (`stream-manager.ts`); o resto da UI só lê através dos hooks.
 */

export const DRAFT_PREFIX = 'draft:';
export const isDraftKey = (key: string) => key.startsWith(DRAFT_PREFIX);

interface Snapshot {
  /** Ids reais das conversas a gerar (as novas, ainda sem id, não entram). */
  threads: ReadonlySet<string>;
  /** Número de gerações em curso, incluindo conversas novas ainda sem id. */
  count: number;
  /** Conversas cuja resposta ficou pronta fora de vista e ainda não foram abertas. */
  unread: ReadonlySet<string>;
}

const EMPTY: ReadonlySet<string> = new Set();
let running = new Set<string>();
let unread: ReadonlySet<string> = EMPTY;
let snapshot: Snapshot = { threads: EMPTY, count: 0, unread: EMPTY };
const listeners = new Set<() => void>();

function publish() {
  const ids = [...running].filter((k) => !isDraftKey(k));
  const same = ids.length === snapshot.threads.size && ids.every((id) => snapshot.threads.has(id));
  snapshot = {
    threads: same ? snapshot.threads : new Set(ids),
    count: running.size,
    unread,
  };
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const get = () => snapshot;

export function setRunning(key: string, on: boolean) {
  if (running.has(key) === on) return;
  const next = new Set(running);
  if (on) next.add(key);
  else next.delete(key);
  running = next;
  publish();
}

/** Uma conversa nova recebeu o id real: passa a contar como conversa identificável. */
export function rekeyRunning(from: string, to: string) {
  if (!running.has(from)) return;
  const next = new Set(running);
  next.delete(from);
  next.add(to);
  running = next;
  publish();
}

export function markUnread(id: string) {
  if (unread.has(id)) return;
  unread = new Set(unread).add(id);
  publish();
}

export function clearUnread(id: string) {
  if (!unread.has(id)) return;
  const next = new Set(unread);
  next.delete(id);
  unread = next;
  publish();
}

export function clearAllUnread() {
  if (unread.size === 0) return;
  unread = EMPTY;
  publish();
}

/** Ids das conversas a gerar neste momento (para o indicador na lista de conversas). */
export function useGeneratingThreadIds(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => get().threads,
    () => EMPTY,
  );
}

/** Há alguma resposta a ser gerada (em qualquer conversa)? */
export function useIsGenerating(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => get().count > 0,
    () => false,
  );
}

/** Conversas com resposta pronta por ler. */
export function useUnreadThreadIds(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => get().unread,
    () => EMPTY,
  );
}

/** Só para testes. */
export function resetGeneration() {
  running = new Set();
  unread = EMPTY;
  snapshot = { threads: EMPTY, count: 0, unread: EMPTY };
  for (const l of listeners) l();
}
