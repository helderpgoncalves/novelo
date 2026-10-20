import { describe, expect, it } from 'vitest';
import { approvalSteps, confirmationView, POLL_MS, pollInterval } from './steps';

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

describe('pollInterval', () => {
  it('pergunta a cada 20 s enquanto o pedido está pendente (ou ainda desconhecido)', () => {
    expect(pollInterval('pending')).toBe(POLL_MS);
    expect(pollInterval(undefined)).toBe(POLL_MS);
    expect(POLL_MS).toBe(20_000);
  });

  it('pára quando a decisão é final', () => {
    expect(pollInterval('approved')).toBe(false);
    expect(pollInterval('rejected')).toBe(false);
  });
});

describe('confirmationView', () => {
  it('não promete mais do que sabe: «enviado» e «entregue» são coisas diferentes', () => {
    expect(confirmationView('sent').kind).toBe('sent');
    expect(confirmationView('delivered').kind).toBe('delivered');
    expect(confirmationView('queued').kind).toBe('sending');
    expect(confirmationView('delayed').kind).toBe('delayed');
  });

  it('só oferece «Reenviar» quando o email não chegou a sair', () => {
    expect(confirmationView('failed')).toEqual({
      kind: 'failed',
      canResend: true,
      canContact: false,
    });
    expect(confirmationView('skipped').canResend).toBe(true);
    for (const ok of ['queued', 'sent', 'delivered', 'delayed'] as const) {
      expect(confirmationView(ok).canResend).toBe(false);
    }
  });

  it('endereço devolvido: não adianta reenviar, oferece o contacto da equipa', () => {
    for (const bad of ['bounced', 'complained'] as const) {
      expect(confirmationView(bad)).toEqual({
        kind: 'returned',
        canResend: false,
        canContact: true,
      });
    }
  });

  it('sem registo (convite, conta antiga) ou valor desconhecido: não mostra nada', () => {
    expect(confirmationView('none').kind).toBe('none');
    expect(confirmationView(undefined).kind).toBe('none');
  });
});
