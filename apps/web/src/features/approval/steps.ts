/** Lógica pura do ecrã de espera: passos visíveis e ritmo das verificações. Sem React, testada à parte. */

export type ApprovalState = 'pending' | 'approved' | 'rejected';
export type StepId = 'registered' | 'email' | 'approval' | 'enter';
export type StepState = 'done' | 'current' | 'todo' | 'failed';

export interface Step {
  id: StepId;
  state: StepState;
}

/**
 * Registo feito → Email verificado → Aprovação → Entrar. O email e a aprovação correm em paralelo (um administrador
 * pode aprovar antes de o email ser confirmado), por isso ambos podem estar "em curso" ao mesmo tempo.
 */
export function approvalSteps(status: ApprovalState, emailVerified: boolean): Step[] {
  return [
    { id: 'registered', state: 'done' },
    { id: 'email', state: emailVerified ? 'done' : 'current' },
    {
      id: 'approval',
      state: status === 'approved' ? 'done' : status === 'rejected' ? 'failed' : 'current',
    },
    { id: 'enter', state: status === 'approved' ? 'current' : 'todo' },
  ];
}

export const POLL_FIRST_MS = 4_000;
export const POLL_MAX_MS = 20_000;

/**
 * Intervalo até à próxima verificação: começa curto (quem acabou de pedir costuma esperar à frente do ecrã) e
 * abranda ×1,5 a cada tentativa até 20 s, para não martelar a API de quem deixa a página aberta horas.
 */
export function pollDelay(attempt: number): number {
  const n = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  return Math.min(POLL_MAX_MS, Math.round(POLL_FIRST_MS * 1.5 ** n));
}

/** Pausa antes de entrar na app depois de aprovada: tempo de ler a boa notícia, sem arrastar. */
export const ENTER_DELAY_MS = 1_800;
export const ENTER_DELAY_REDUCED_MS = 900;
