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

/** Intervalo fixo das verificações: suave para a API e suficiente para quem espera à frente do ecrã. */
export const POLL_MS = 20_000;

/**
 * Intervalo até à próxima verificação do estado, ou `false` para parar: só se pergunta enquanto o pedido está
 * pendente (aprovado ou recusado é final). O React Query já pausa o intervalo com o separador escondido e o
 * ecrã refaz o pedido ao voltar ao separador.
 */
export function pollInterval(status: ApprovalState | undefined): number | false {
  return status === 'approved' || status === 'rejected' ? false : POLL_MS;
}

/** Estado do email «recebemos o teu pedido» enviado a esta conta (vem de `GET /auth/approval-status`). */
export type ConfirmationEmail =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'delayed'
  | 'bounced'
  | 'complained'
  | 'failed'
  | 'skipped'
  | 'none';

export type ConfirmationKind =
  | 'none'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'delayed'
  | 'failed'
  | 'returned';

export interface ConfirmationView {
  kind: ConfirmationKind;
  /** Mostra o botão «Reenviar email» (só quando o email não chegou a sair). */
  canResend: boolean;
  /** Mostra o contacto da equipa (o endereço foi devolvido: reenviar não resolve). */
  canContact: boolean;
}

/**
 * Como apresentar o email de confirmação sem prometer o que não sabemos: `sent` quer dizer «o fornecedor aceitou»
 * e só `delivered` diz que chegou ao servidor de destino. `none` (convites, contas antigas) não mostra nada.
 */
export function confirmationView(status: ConfirmationEmail | undefined): ConfirmationView {
  switch (status) {
    case 'queued':
      return { kind: 'sending', canResend: false, canContact: false };
    case 'sent':
      return { kind: 'sent', canResend: false, canContact: false };
    case 'delivered':
      return { kind: 'delivered', canResend: false, canContact: false };
    case 'delayed':
      return { kind: 'delayed', canResend: false, canContact: false };
    case 'failed':
    case 'skipped':
      return { kind: 'failed', canResend: true, canContact: false };
    case 'bounced':
    case 'complained':
      return { kind: 'returned', canResend: false, canContact: true };
    default:
      return { kind: 'none', canResend: false, canContact: false };
  }
}

/** Espera antes de deixar reenviar o email de confirmação (a API também limita). */
export const CONFIRMATION_RESEND_SECONDS = 30;

/** Pausa antes de entrar na app depois de aprovada: tempo de ler a boa notícia, sem arrastar. */
export const ENTER_DELAY_MS = 1_800;
export const ENTER_DELAY_REDUCED_MS = 900;
