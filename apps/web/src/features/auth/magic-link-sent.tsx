import { useMutation } from '@tanstack/react-query';
import { ExternalLink, MailCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MagicLinkRequest } from '@/client';
import { requestMagicLinkMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { getLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { AUTH_BLOCKS, AUTH_BUTTON, AUTH_BUTTONS, AUTH_CTA } from './auth-ui';
import {
  classifySendError,
  cooldownStart,
  isBlockingFailure,
  type SendFailure,
} from './email-flow';
import { EmailProblem } from './email-problem';
import { FormAlert } from './form-alert';
import { MAGIC_LINK_MINUTES, mailProvider, safeNext, storeLastEmail } from './passwordless';
import { useCountdown } from './use-countdown';
import { type TurnstileGate, useTurnstile } from './use-turnstile';

/** Pede o link por email. Usado pelo ecrã de entrada, pelo reenvio e pelo ecrã de link inválido. */
export function useRequestMagicLink() {
  const gate = useTurnstile('magic_link');
  const mutation = useMutation({
    ...requestMagicLinkMutation(),
    onSuccess: (_data, vars) => storeLastEmail(vars.body.email),
  });
  /** Pede o link com um token Turnstile novo (uso único) e trata os erros de captcha. */
  const send = (
    body: MagicLinkRequest,
    options?: { onSuccess?: () => void; onError?: (error: unknown) => void },
  ) =>
    mutation.mutate(
      { body, headers: gate.consume() },
      {
        onSuccess: options?.onSuccess,
        onError: (error) => {
          gate.onApiError(error);
          options?.onError?.(error);
        },
      },
    );
  return { ...mutation, gate, send };
}

export function magicLinkBody(email: string, next?: string) {
  const target = safeNext(next);
  return { email: email.trim(), locale: getLocale(), ...(target === '/' ? {} : { next: target }) };
}

/** O pedido de reenvio, já com o email (e o resto) preenchido: o ecrã só sabe «enviar de novo». */
export interface ResendRequest {
  send: (options: { onSuccess: () => void; onError: (error: unknown) => void }) => void;
  isPending: boolean;
  gate: TurnstileGate;
}

interface SentProps {
  email: string;
  next?: string;
  title?: string;
  text?: string;
  /** Dica no fim (por omissão a do link de entrada). */
  tip?: string;
  /** `link` = entrada; `reset` = recuperar palavra-passe (muda as alternativas e o email ao suporte). */
  purpose?: 'link' | 'reset';
  request: ResendRequest;
  onChangeEmail: () => void;
}

/**
 * «Verifica o teu email»: o ecrã seguinte ao pedido. Diz o que pedimos (sem prometer que chegou), abre a app de
 * email quando o domínio a identifica e deixa reenviar passada a espera (contagem de 30 s). Se o reenvio falhar
 * por o email não sair (503) ou o endereço estar bloqueado (409), troca-se pelo ecrã de problema com alternativas;
 * se for limite de pedidos (429), avisa e volta a bloquear o botão.
 */
export function EmailSent({
  email,
  next,
  title,
  text,
  tip,
  purpose = 'link',
  request,
  onChangeEmail,
}: SentProps) {
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [resent, setResent] = useState(false);
  // A última falha do reenvio fica até haver outra tentativa a correr bem: o ecrã de problema não pisca.
  const [failure, setFailure] = useState<{ kind: SendFailure; error: unknown } | null>(null);
  const seconds = useCountdown(sentAt);
  const heading = useRef<HTMLHeadingElement>(null);
  const provider = mailProvider(email);

  useEffect(() => heading.current?.focus(), []);

  const onResend = () => {
    setResent(false);
    request.send({
      onSuccess: () => {
        setFailure(null);
        setSentAt(Date.now());
        setResent(true);
      },
      onError: (error) => {
        const kind = classifySendError(error) ?? 'other';
        setFailure({ kind, error });
        // Um 429 recomeça a contagem: a API não diz quanto falta.
        const start = cooldownStart(kind, Date.now());
        if (start !== null) setSentAt(start);
      },
    });
  };

  if (failure && isBlockingFailure(failure.kind)) {
    return (
      <EmailProblem
        kind={failure.kind}
        email={email}
        purpose={purpose}
        next={next}
        retrying={request.isPending}
        onRetry={onResend}
        gateField={request.gate.field}
        retryBlocked={request.gate.blocked}
        onChangeEmail={onChangeEmail}
      />
    );
  }

  const problem =
    failure?.kind === 'rate_limited'
      ? m.email_sent_rate_limited()
      : failure?.kind === 'other'
        ? getErrorMessage(failure.error)
        : null;

  return (
    <div
      className={cn(
        AUTH_BLOCKS,
        'motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:animate-in duration-300',
      )}
    >
      <div className="flex flex-col gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <h1 ref={heading} tabIndex={-1} className="text-3xl outline-none">
          {title ?? m.magic_sent_title()}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {text ?? m.magic_sent_text()}
        </p>
        <p className="break-all font-medium text-sm" data-testid="magic-sent-email">
          {email}
        </p>
      </div>

      {provider && (
        <Button asChild className={AUTH_CTA}>
          <a href={provider.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            {m.magic_open_mail({ provider: provider.name })}
          </a>
        </Button>
      )}

      <div className={AUTH_BUTTONS}>
        <FormAlert message={problem} />
        {request.gate.field}
        <Button
          type="button"
          variant="outline"
          className={AUTH_BUTTON}
          disabled={seconds > 0 || request.isPending || request.gate.blocked}
          loading={request.isPending}
          onClick={onResend}
        >
          {seconds > 0 ? m.magic_resend_in({ seconds }) : m.magic_resend()}
        </Button>
        <Button type="button" variant="ghost" className={AUTH_BUTTON} onClick={onChangeEmail}>
          {m.magic_change_email()}
        </Button>
        <p role="status" className="text-center text-primary text-xs empty:hidden">
          {resent ? m.magic_resent() : ''}
        </p>
      </div>

      <div className="space-y-2 rounded-lg bg-muted/60 p-3 text-muted-foreground text-xs leading-relaxed">
        <p>{tip ?? m.magic_spam_tip({ minutes: MAGIC_LINK_MINUTES })}</p>
        <p>{m.email_sent_invite_tip()}</p>
      </div>
    </div>
  );
}

/** «Verifica o teu email» do link de entrada: reenvia pelo mesmo pedido do ecrã de entrada. */
export function MagicLinkSent({
  email,
  next,
  title,
  text,
  onChangeEmail,
}: {
  email: string;
  next?: string;
  title?: string;
  text?: string;
  onChangeEmail: () => void;
}) {
  const resend = useRequestMagicLink();
  const request: ResendRequest = {
    send: (options) => resend.send(magicLinkBody(email, next), options),
    isPending: resend.isPending,
    gate: resend.gate,
  };
  return (
    <EmailSent
      email={email}
      next={next}
      title={title}
      text={text}
      request={request}
      onChangeEmail={onChangeEmail}
    />
  );
}
