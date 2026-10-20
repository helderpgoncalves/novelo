import { useSyncExternalStore } from 'react';
import { storage } from '@/features/auth/passwordless';

/** Visita guiada: "já vista" por utilizador (localStorage) e o pedido de abertura, partilhado pela app. */
const seenKey = (userId: string) => `novelo.tour.seen.${userId}`;
const PENDING_KEY = 'novelo.tour.pending';

export const hasSeenTour = (userId: string): boolean => storage.read(seenKey(userId)) === '1';
export const markTourSeen = (userId: string): void => storage.write(seenKey(userId), '1');

/** Quem acabou de criar conta vê a visita uma vez (marcado pelo registo, lido na primeira entrada). */
export function markTourPending(): void {
  try {
    window.sessionStorage.setItem(PENDING_KEY, '1');
  } catch {
    // sem armazenamento: não há visita automática, o menu continua a oferecê-la
  }
}
export function consumeTourPending(): boolean {
  try {
    const pending = window.sessionStorage.getItem(PENDING_KEY) === '1';
    window.sessionStorage.removeItem(PENDING_KEY);
    return pending;
  } catch {
    return false;
  }
}

/** Convidados e contas novas veem a visita sozinhos uma vez; o resto só a pedido. */
export const shouldAutoOpenTour = (user: { id: string; role: string }, pending: boolean): boolean =>
  !hasSeenTour(user.id) && (user.role === 'guest' || pending);

let open = false;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export function setTourOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  emit();
}

export const openTour = (): void => setTourOpen(true);

export function useTourOpen(): boolean {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => open,
    () => false,
  );
}
