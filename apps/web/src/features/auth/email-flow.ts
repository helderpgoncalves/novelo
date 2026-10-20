import { getErrorCode } from '@/lib/errors';
import { mailtoLink } from '@/lib/support';
import { m } from '@/paraglide/messages';
import { RESEND_SECONDS, secondsLeft } from './passwordless';

/**
 * Lógica pura dos ecrãs «verifica o teu email»: o que fazer quando o envio (ou o reenvio) falha.
 * A API responde 503 `email_unavailable` quando o email não saiu, 409 `email_suppressed` quando o endereço
 * foi devolvido ou marcado como spam e 429 `rate_limited` quando se pede demasiadas vezes.
 */
export type SendFailure = 'unavailable' | 'suppressed' | 'rate_limited' | 'other';

export function classifySendError(error: unknown): SendFailure | null {
  if (error === null || error === undefined) return null;
  switch (getErrorCode(error)) {
    case 'email_unavailable':
      return 'unavailable';
    case 'email_suppressed':
      return 'suppressed';
    case 'rate_limited':
      return 'rate_limited';
    default:
      return 'other';
  }
}

/** Falhas que substituem o ecrã de sucesso por um ecrã de problema com alternativas. */
export const isBlockingFailure = (
  failure: SendFailure | null,
): failure is Extract<SendFailure, 'unavailable' | 'suppressed'> =>
  failure === 'unavailable' || failure === 'suppressed';

/**
 * Início da contagem do reenvio depois de uma falha: um 429 bloqueia o botão por 30 s (a API não diz quanto
 * falta); as outras falhas deixam repetir logo, porque nada foi enviado.
 */
export function cooldownStart(failure: SendFailure | null, now: number): number | null {
  return failure === 'rate_limited' ? now : null;
}

/** Estado do botão «Reenviar»: desativado durante a espera ou o pedido, com o texto adequado. */
export type ResendButton = { disabled: boolean; seconds: number };

export function resendButton(
  sentAt: number,
  now: number,
  pending: boolean,
  cooldown = RESEND_SECONDS,
): ResendButton {
  const seconds = secondsLeft(sentAt, now, cooldown);
  return { disabled: pending || seconds > 0, seconds };
}

/** `mailto:` montado só quando a pessoa clica (o endereço do suporte nunca fica no HTML estático). */
export function supportMailto(email: string, purpose: 'link' | 'reset'): string {
  const subject = m.email_support_subject();
  const body =
    purpose === 'reset'
      ? m.email_support_body_reset({ email })
      : m.email_support_body_link({ email });
  return mailtoLink(subject, body);
}
