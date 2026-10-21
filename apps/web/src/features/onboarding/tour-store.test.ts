import { beforeEach, describe, expect, it } from 'vitest';
import { checklistProgress } from './starter-checklist';
import {
  canResumeTour,
  clearTourProgress,
  consumeTourPending,
  getTourState,
  hasSeenTour,
  markTourPending,
  markTourSeen,
  openTour,
  readTourProgress,
  resetTourState,
  setTourIndex,
  setTourOpen,
  shouldAutoOpenTour,
  writeTourProgress,
} from './tour-store';

describe('introdução guiada: estado', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetTourState();
  });

  it('o cache local é por utilizador', () => {
    markTourSeen('a');
    expect(hasSeenTour('a')).toBe(true);
    expect(hasSeenTour('b')).toBe(false);
  });

  it('abre sozinha para convidados, contas novas e entradas por convite, QR ou link', () => {
    expect(shouldAutoOpenTour({ id: 'g', role: 'guest' }, false)).toBe(true);
    expect(shouldAutoOpenTour({ id: 'n', role: 'operator' }, true)).toBe(true);
    expect(shouldAutoOpenTour({ id: 'i', role: 'operator', joined_via: 'invited' }, false)).toBe(
      true,
    );
    expect(shouldAutoOpenTour({ id: 'o', role: 'operator', joined_via: 'password' }, false)).toBe(
      false,
    );
    // Google: com o registo aberto a conta entra logo, sem o sinal do formulário de registo.
    expect(shouldAutoOpenTour({ id: 'gg', role: 'operator', joined_via: 'google' }, false)).toBe(
      true,
    );
  });

  it('o servidor manda: vista noutro dispositivo não volta a abrir', () => {
    const seenElsewhere = {
      id: 'g',
      role: 'guest',
      onboarding: { tour_seen_at: '2026-10-20T10:00:00Z' },
    };
    expect(shouldAutoOpenTour(seenElsewhere, true)).toBe(false);
    markTourSeen('g2');
    expect(shouldAutoOpenTour({ id: 'g2', role: 'guest' }, true)).toBe(false);
  });

  it('nunca abre durante uma impersonação', () => {
    expect(
      shouldAutoOpenTour({ id: 'g', role: 'guest', impersonation: { active: true } }, true),
    ).toBe(false);
  });

  it('o pedido de uma conta nova consome-se à primeira leitura', () => {
    markTourPending();
    expect(consumeTourPending()).toBe(true);
    expect(consumeTourPending()).toBe(false);
  });

  it('guarda o progresso para retomar e limpa-o ao concluir', () => {
    expect(canResumeTour('u', 6)).toBe(false);
    writeTourProgress('u', 3);
    expect(readTourProgress('u')).toBe(3);
    expect(canResumeTour('u', 6)).toBe(true);
    writeTourProgress('u', 5); // último passo: nada a retomar
    expect(canResumeTour('u', 6)).toBe(false);
    clearTourProgress('u');
    expect(readTourProgress('u')).toBe(0);
  });

  it('o passo e a abertura vivem no store e sobrevivem a quem os lê', () => {
    openTour(3);
    expect(getTourState()).toEqual({ open: true, index: 3 });
    setTourIndex(-2);
    expect(getTourState().index).toBe(0);
    setTourOpen(false);
    expect(getTourState().open).toBe(false);
  });
});

describe('primeiros passos', () => {
  it('conta só os passos conhecidos e completa-se com os três', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 3, complete: false });
    expect(checklistProgress(['map', 'outro'])).toEqual({ done: 1, total: 3, complete: false });
    expect(checklistProgress(['scenario', 'copilot', 'map']).complete).toBe(true);
  });
});
