import { beforeEach, describe, expect, it } from 'vitest';
import {
  consumeTourPending,
  hasSeenTour,
  markTourPending,
  markTourSeen,
  shouldAutoOpenTour,
} from './tour-store';

describe('visita guiada', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('é por utilizador', () => {
    markTourSeen('a');
    expect(hasSeenTour('a')).toBe(true);
    expect(hasSeenTour('b')).toBe(false);
  });

  it('abre sozinha para convidados e contas novas, uma só vez', () => {
    expect(shouldAutoOpenTour({ id: 'g', role: 'guest' }, false)).toBe(true);
    expect(shouldAutoOpenTour({ id: 'n', role: 'operator' }, true)).toBe(true);
    expect(shouldAutoOpenTour({ id: 'o', role: 'operator' }, false)).toBe(false);
    markTourSeen('g');
    expect(shouldAutoOpenTour({ id: 'g', role: 'guest' }, true)).toBe(false);
  });

  it('o pedido de uma conta nova consome-se à primeira leitura', () => {
    markTourPending();
    expect(consumeTourPending()).toBe(true);
    expect(consumeTourPending()).toBe(false);
  });
});
