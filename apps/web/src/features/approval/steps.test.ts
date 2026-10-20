import { describe, expect, it } from 'vitest';
import { approvalSteps, POLL_FIRST_MS, POLL_MAX_MS, pollDelay } from './steps';

describe('approvalSteps', () => {
  it('à espera, com o email por confirmar: email e aprovação em curso', () => {
    expect(approvalSteps('pending', false)).toEqual([
      { id: 'registered', state: 'done' },
      { id: 'email', state: 'current' },
      { id: 'approval', state: 'current' },
      { id: 'enter', state: 'todo' },
    ]);
  });

  it('com o email confirmado, só a aprovação está em curso', () => {
    const states = approvalSteps('pending', true).map((s) => s.state);
    expect(states).toEqual(['done', 'done', 'current', 'todo']);
  });

  it('aprovada: tudo feito e "Entrar" passa a ser o passo atual', () => {
    const states = approvalSteps('approved', true).map((s) => s.state);
    expect(states).toEqual(['done', 'done', 'done', 'current']);
  });

  it('rejeitada: a aprovação falhou e não se entra', () => {
    const states = approvalSteps('rejected', true).map((s) => s.state);
    expect(states).toEqual(['done', 'done', 'failed', 'todo']);
  });
});

describe('pollDelay', () => {
  it('começa curto, cresce ×1,5 e nunca passa do teto', () => {
    expect(pollDelay(0)).toBe(POLL_FIRST_MS);
    expect(pollDelay(1)).toBe(6_000);
    expect(pollDelay(2)).toBe(9_000);
    expect(pollDelay(3)).toBe(13_500);
    expect(pollDelay(50)).toBe(POLL_MAX_MS);
  });

  it('é monótono e tolera valores estranhos', () => {
    let previous = 0;
    for (let i = 0; i < 12; i++) {
      const delay = pollDelay(i);
      expect(delay).toBeGreaterThanOrEqual(previous);
      previous = delay;
    }
    expect(pollDelay(-3)).toBe(POLL_FIRST_MS);
    expect(pollDelay(Number.NaN)).toBe(POLL_FIRST_MS);
  });
});
