import { useSyncExternalStore } from 'react';
import { storage } from '@/features/auth/passwordless';

/**
 * Estado da introdução guiada. A fonte de verdade é o servidor (`onboarding.tour_seen_at`, vale em todos os
 * dispositivos); o `localStorage` é só cache (evita um piscar antes de a conta chegar) e guarda o ponto onde
 * a pessoa ficou, para retomar. O pedido de abertura e o passo atual vivem aqui para sobreviverem à navegação.
 */
const seenKey = (userId: string) => `novelo.tour.seen.${userId}`;
// `story`: a apresentação de seis passos (o progresso da visita antiga, com outros passos, não se retoma).
const progressKey = (userId: string) => `novelo.story.progress.${userId}`;
const PENDING_KEY = 'novelo.tour.pending';

export const hasSeenTour = (userId: string): boolean => storage.read(seenKey(userId)) === '1';
export const markTourSeen = (userId: string): void => storage.write(seenKey(userId), '1');
export const forgetTourSeen = (userId: string): void => storage.write(seenKey(userId), '0');

/** Último passo em que a pessoa ficou (0 = sem progresso). */
export function readTourProgress(userId: string): number {
  const n = Number.parseInt(storage.read(progressKey(userId)) ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
export const writeTourProgress = (userId: string, step: number): void =>
  storage.write(progressKey(userId), String(Math.max(0, Math.trunc(step))));
export const clearTourProgress = (userId: string): void => storage.write(progressKey(userId), '0');

/** Há um ponto onde retomar (saltou a meio, não terminou). */
export const canResumeTour = (userId: string, total: number): boolean => {
  const p = readTourProgress(userId);
  return p > 0 && p < total - 1;
};

/** Quem acabou de criar conta vê a introdução uma vez (marcado pelo registo, lido na primeira entrada). */
export function markTourPending(): void {
  try {
    window.sessionStorage.setItem(PENDING_KEY, '1');
  } catch {
    // sem armazenamento: não há abertura automática, o menu continua a oferecê-la
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

export interface AutoOpenUser {
  id: string;
  role: string;
  joined_via?: string;
  onboarding?: { tour_seen_at?: string | null } | null;
  impersonation?: { active?: boolean } | null;
}

/**
 * Contas que chegam de um convite, QR, link por email ou Google (com o registo aberto entram logo) veem a introdução mesmo
 * sem o sinal de registo. A palavra-passe não: as contas dos testes e do administrador semeado entram assim e nunca a veem
 * sozinhas (um teste pede-a com o sinal de registo, ver `markTourPending`).
 */
const ARRIVED_VIA = new Set(['quick_join', 'invited', 'magic_link', 'google']);

/**
 * Abre sozinha à primeira utilização: ainda não vista no servidor (nem no cache local) e a conta é nova
 * (convidado, registo/convite/aprovação que deixaram o sinal, ou entrada por convite, QR ou link por email).
 * Nunca durante uma impersonação: um administrador a ver como outra pessoa não gasta a introdução dela.
 */
export function shouldAutoOpenTour(user: AutoOpenUser, pending: boolean): boolean {
  if (user.impersonation?.active) return false;
  if (user.onboarding?.tour_seen_at) return false;
  if (hasSeenTour(user.id)) return false;
  return (
    user.role === 'guest' ||
    pending ||
    (user.joined_via !== undefined && ARRIVED_VIA.has(user.joined_via))
  );
}

interface TourState {
  open: boolean;
  index: number;
}
let state: TourState = { open: false, index: 0 };
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};
const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};

export const getTourState = (): TourState => state;

function set(next: Partial<TourState>): void {
  if (
    (next.open === undefined || next.open === state.open) &&
    (next.index === undefined || next.index === state.index)
  )
    return;
  state = { ...state, ...next };
  emit();
}

export const setTourOpen = (open: boolean): void => set({ open });
export const setTourIndex = (index: number): void => set({ index: Math.max(0, Math.trunc(index)) });

/** Abre a introdução no passo dado (0 = do princípio). */
export function openTour(index = 0): void {
  set({ open: true, index: Math.max(0, Math.trunc(index)) });
}

export function useTourState(): TourState {
  return useSyncExternalStore(subscribe, getTourState, getTourState);
}
export const useTourOpen = (): boolean => useTourState().open;

/** Só para testes. */
export function resetTourState(): void {
  state = { open: false, index: 0 };
  emit();
}
