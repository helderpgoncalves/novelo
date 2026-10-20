import { beforeEach, describe, expect, it } from 'vitest';
import { computePlacement, preferredSide, sheetBottomOffset } from './placement';
import { checklistProgress } from './starter-checklist';
import { clampStep, stepIdsFor } from './steps';
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
    expect(canResumeTour('u', 9)).toBe(false);
    writeTourProgress('u', 4);
    expect(readTourProgress('u')).toBe(4);
    expect(canResumeTour('u', 9)).toBe(true);
    writeTourProgress('u', 8); // último passo: nada a retomar
    expect(canResumeTour('u', 9)).toBe(false);
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

describe('introdução guiada: passos por papel', () => {
  it('o convidado tem a versão curta', () => {
    expect(stepIdsFor('guest')).toEqual(['welcome', 'simulator', 'copilot', 'map', 'finish']);
  });

  it('o operador vê a completa, sem a gestão de pessoas', () => {
    const ids = stepIdsFor('operator');
    expect(ids[0]).toBe('welcome');
    expect(ids.at(-1)).toBe('finish');
    expect(ids).toContain('scenarios');
    expect(ids).toContain('report');
    expect(ids).not.toContain('users');
  });

  it('o administrador acrescenta as pessoas e acessos', () => {
    const admin = stepIdsFor('admin');
    expect(admin).toContain('users');
    expect(admin.length).toBe(stepIdsFor('operator').length + 1);
  });

  it('um papel desconhecido cai na visita do operador', () => {
    expect(stepIdsFor('qualquer')).toEqual(stepIdsFor('operator'));
  });

  it('o índice fica sempre dentro dos passos', () => {
    expect(clampStep(99, 5)).toBe(4);
    expect(clampStep(-1, 5)).toBe(0);
    expect(clampStep(Number.NaN, 5)).toBe(0);
    expect(clampStep(2.7, 5)).toBe(2);
  });
});

describe('introdução guiada: posição do cartão', () => {
  const vp = { width: 1280, height: 800 };
  const card = { width: 360, height: 240 };

  it('junto da barra lateral abre para a direita, com a seta no alvo', () => {
    const target = { x: 12, y: 300, width: 232, height: 40 };
    const p = computePlacement(target, card, vp);
    expect(p.side).toBe('right');
    expect(p.x).toBe(target.x + target.width + 14);
    expect(p.arrow).toBeCloseTo(target.y + target.height / 2 - p.y, 5);
  });

  it('no topo abre para baixo e nunca sai do ecrã', () => {
    const target = { x: 1100, y: 8, width: 120, height: 40 };
    const p = computePlacement(target, card, vp);
    expect(p.side).toBe('bottom');
    expect(p.x + card.width).toBeLessThanOrEqual(vp.width - 12);
    expect(p.y).toBeGreaterThanOrEqual(12);
  });

  it('num ecrã estreito escolhe um lado onde caiba', () => {
    const narrow = { width: 700, height: 500 };
    const target = { x: 600, y: 200, width: 80, height: 40 };
    const p = computePlacement(target, card, narrow);
    expect(['left', 'bottom', 'top']).toContain(p.side);
    expect(p.x).toBeGreaterThanOrEqual(12);
  });

  it('preferência por lado', () => {
    expect(preferredSide({ x: 0, y: 100, width: 250, height: 700 }, vp)).toBe('right');
    expect(preferredSide({ x: 900, y: 0, width: 100, height: 40 }, vp)).toBe('bottom');
  });

  it('em telemóvel a folha sobe acima de um alvo na barra inferior', () => {
    const phone = { width: 390, height: 844 };
    const tab = { x: 100, y: 770, width: 80, height: 56 };
    expect(sheetBottomOffset(tab, phone)).toBe(phone.height - tab.y + 14);
    expect(sheetBottomOffset({ x: 300, y: 10, width: 60, height: 40 }, phone)).toBe(0);
    expect(sheetBottomOffset(null, phone)).toBe(0);
  });
});

describe('primeiros passos', () => {
  it('conta só os passos conhecidos e completa-se com os três', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 3, complete: false });
    expect(checklistProgress(['map', 'outro'])).toEqual({ done: 1, total: 3, complete: false });
    expect(checklistProgress(['scenario', 'copilot', 'map']).complete).toBe(true);
  });
});
