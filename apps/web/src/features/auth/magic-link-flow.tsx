import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';
import { FormAlert } from './form-alert';
import { MagicLinkSent, magicLinkBody, useRequestMagicLink } from './magic-link-sent';
import { looksLikeEmail, readLastEmail } from './passwordless';

/** Em ecrãs com rato abre o teclado logo; em telemóvel não, para não tapar o ecrã antes de o ler. */
const canAutofocus = () => window.matchMedia('(pointer: fine)').matches;

/**
 * Entrada principal: um campo de email, um botão, e o ecrã de "verifica o teu email".
 * `alternatives` desenha-se por baixo do formulário (Google, palavra-passe, criar conta).
 */
export function MagicLinkFlow({ next, alternatives }: { next?: string; alternatives: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
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

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Lê do DOM: os gestores de palavras-passe preenchem sem disparar `input`.
    const value = String(new FormData(e.currentTarget).get('email') ?? '').trim();
    if (!value) return setProblem(m.validation_email_required());
    if (!looksLikeEmail(value)) return setProblem(m.validation_email_invalid());
    setProblem(null);
    request.mutate({ body: magicLinkBody(value, next) }, { onSuccess: () => setEmail(value) });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl">{m.login_title()}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">{m.login_magic_subtitle()}</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-2" noValidate>
        <FormAlert message={request.isError ? getErrorMessage(request.error) : null} />
        <div className="space-y-2">
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
            defaultValue={readLastEmail()}
            placeholder={m.login_email_placeholder()}
            aria-invalid={problem ? true : undefined}
            aria-describedby="magic-email-problem"
            onChange={() => problem && setProblem(null)}
            className="h-11"
          />
          <p id="magic-email-problem" role="alert" className="min-h-5 text-destructive text-sm">
            {problem}
          </p>
        </div>
        <Button
          type="submit"
          className="h-11 w-full font-semibold"
          disabled={request.isPending}
          loading={request.isPending}
        >
          {m.magic_submit()}
        </Button>
      </form>
      {alternatives}
    </div>
  );
}
