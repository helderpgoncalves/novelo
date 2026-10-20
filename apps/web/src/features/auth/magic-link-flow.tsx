import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';
import {
  AUTH_BLOCKS,
  AUTH_CONTROL,
  AUTH_CTA,
  AUTH_FIELDS,
  AUTH_STACK,
  AuthHeading,
} from './auth-ui';
import { classifySendError, isBlockingFailure } from './email-flow';
import { EmailProblem } from './email-problem';
import { FormAlert } from './form-alert';
import { MagicLinkSent, magicLinkBody, useRequestMagicLink } from './magic-link-sent';
import { looksLikeEmail, readLastEmail } from './passwordless';

/** Em ecrãs com rato abre o teclado logo; em telemóvel não, para não tapar o ecrã antes de o ler. */
const canAutofocus = () => window.matchMedia('(pointer: fine)').matches;

/**
 * Entrada principal: um campo de email, um botão, e o ecrã de "verifica o teu email".
 * `alternatives.methods` (divisor, Google, palavra-passe) entra no MESMO grupo de ação que o formulário, com o
 * mesmo passo de 16 px; `alternatives.footer` (criar conta) fica num bloco à parte, por baixo.
 */
export function MagicLinkFlow({
  next,
  alternatives,
}: {
  next?: string;
  alternatives: { methods: ReactNode; footer: ReactNode };
}) {
  const [email, setEmail] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // O último email que se tentou enviar: se o envio falhar, o ecrã de problema fala dele.
  const [attempt, setAttempt] = useState('');
  // Falha que troca o formulário pelo ecrã de problema; fica até a tentativa seguinte correr bem.
  const [blocked, setBlocked] = useState<'unavailable' | 'suppressed' | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const request = useRequestMagicLink();

  // Ao voltar de "usar outro email" o campo volta a ter foco.
  useEffect(() => {
    if (email === null && canAutofocus()) input.current?.focus();
  }, [email]);

  if (email !== null) {
    return (
      <MagicLinkSent
        email={email}
        next={next}
        onChangeEmail={() => {
          setEmail(null);
          request.reset();
        }}
      />
    );
  }

  const submit = (value: string) => {
    setAttempt(value);
    request.send(magicLinkBody(value, next), {
      onSuccess: () => {
        setBlocked(null);
        setEmail(value);
      },
      onError: (error) => {
        const kind = classifySendError(error);
        setBlocked(isBlockingFailure(kind) ? kind : null);
      },
    });
  };

  if (attempt && blocked) {
    return (
      <EmailProblem
        kind={blocked}
        email={attempt}
        purpose="link"
        next={next}
        retrying={request.isPending}
        retryBlocked={request.gate.blocked}
        gateField={request.gate.field}
        onRetry={() => submit(attempt)}
        onChangeEmail={() => {
          setBlocked(null);
          request.reset();
        }}
      />
    );
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Lê do DOM: os gestores de palavras-passe preenchem sem disparar `input`.
    const value = String(new FormData(e.currentTarget).get('email') ?? '').trim();
    if (!value) return setProblem(m.validation_email_required());
    if (!looksLikeEmail(value)) return setProblem(m.validation_email_invalid());
    setProblem(null);
    submit(value);
  };

  return (
    <div className={AUTH_BLOCKS}>
      <AuthHeading title={m.login_title()} subtitle={m.login_magic_subtitle()} />
      <div className={AUTH_STACK}>
        <form onSubmit={onSubmit} className={AUTH_FIELDS} noValidate>
          <FormAlert message={request.isError ? getErrorMessage(request.error) : null} />
          <div className="flex flex-col gap-2">
            <label htmlFor="magic-email" className="font-medium text-sm leading-none">
              {m.login_email()}
            </label>
            <Input
              ref={input}
              id="magic-email"
              name="email"
              type="email"
              autoComplete="email webauthn"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              defaultValue={attempt || readLastEmail()}
              placeholder={m.login_email_placeholder()}
              aria-invalid={problem ? true : undefined}
              aria-describedby="magic-email-problem"
              onChange={() => problem && setProblem(null)}
              className={AUTH_CONTROL}
            />
            <p
              id="magic-email-problem"
              role="alert"
              className="text-destructive text-sm empty:hidden"
            >
              {problem}
            </p>
          </div>
          {request.gate.field}
          <Button
            type="submit"
            className={AUTH_CTA}
            disabled={request.isPending || request.gate.blocked}
            loading={request.isPending || request.gate.busy}
          >
            {m.magic_submit()}
          </Button>
        </form>
        {alternatives.methods}
      </div>
      {alternatives.footer}
    </div>
  );
}
