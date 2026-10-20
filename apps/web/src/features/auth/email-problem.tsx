import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { KeyRound, LifeBuoy, MailX } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { getAuthConfigOptions } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { AUTH_BLOCKS, AUTH_BUTTON, AUTH_BUTTONS, AUTH_CTA, AuthDivider } from './auth-ui';
import type { SendFailure } from './email-flow';
import { supportMailto } from './email-flow';
import { GoogleButton } from './google-button';

interface Props {
  /** `unavailable` = o email não saiu (503); `suppressed` = o endereço está bloqueado (409). */
  kind: Extract<SendFailure, 'unavailable' | 'suppressed'>;
  email: string;
  /** Para onde vai o mailto do suporte e que alternativas faz sentido oferecer. */
  purpose: 'link' | 'reset';
  next?: string;
  retrying?: boolean;
  /** Só quando tentar de novo pode resolver (indisponível); com o endereço bloqueado não se oferece. */
  onRetry?: () => void;
  /** Campo do Turnstile (o reenvio também o exige quando está ativo) e se o botão deve esperar por ele. */
  gateField?: ReactNode;
  retryBlocked?: boolean;
  onChangeEmail: () => void;
}

/**
 * O email NÃO saiu. Em vez do ecrã de sucesso, diz-se a verdade e dão-se saídas: tentar de novo, entrar com
 * o Google, entrar com a palavra-passe ou escrever ao suporte. Ninguém fica à espera de um email que não vem.
 */
export function EmailProblem({
  kind,
  email,
  purpose,
  next,
  retrying,
  onRetry,
  gateField,
  retryBlocked,
  onChangeEmail,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const config = useQuery({ ...getAuthConfigOptions(), staleTime: 5 * 60_000 });
  useEffect(() => heading.current?.focus(), []);

  const suppressed = kind === 'suppressed';
  const google = config.data?.google_enabled === true;

  return (
    <div
      role="alert"
      data-testid="email-problem"
      data-kind={kind}
      className={cn(
        AUTH_BLOCKS,
        'motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:animate-in duration-300',
      )}
    >
      <div className="flex flex-col gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-areia/25 text-foreground">
          <MailX className="size-6" aria-hidden="true" />
        </span>
        <h1 ref={heading} tabIndex={-1} className="text-3xl outline-none">
          {suppressed ? m.email_problem_suppressed_title() : m.email_problem_unavailable_title()}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {suppressed
            ? m.email_problem_suppressed_text({ email })
            : m.email_problem_unavailable_text({ email })}
        </p>
      </div>

      <div className={AUTH_BUTTONS}>
        {gateField}
        {!suppressed && onRetry && (
          <Button
            type="button"
            className={AUTH_CTA}
            loading={retrying}
            disabled={retrying || retryBlocked}
            onClick={onRetry}
          >
            {m.email_problem_retry()}
          </Button>
        )}
        <Button
          type="button"
          variant={suppressed ? 'default' : 'outline'}
          className={suppressed ? AUTH_CTA : AUTH_BUTTON}
          onClick={onChangeEmail}
        >
          {m.magic_change_email()}
        </Button>
      </div>

      <div className={AUTH_BUTTONS}>
        <AuthDivider>{m.email_problem_alternatives()}</AuthDivider>
        {google && <GoogleButton next={next} />}
        {purpose === 'link' && (
          <Button asChild variant="outline" className={cn(AUTH_BUTTON, 'gap-3')}>
            <Link to="/login" search={{ next, method: 'password' }}>
              <KeyRound aria-hidden="true" />
              {m.login_use_password()}
            </Link>
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className={cn(AUTH_BUTTON, 'gap-3')}
          // O endereço do suporte só é montado ao clicar: nunca fica no HTML estático.
          onClick={() => window.location.assign(supportMailto(email, purpose))}
        >
          <LifeBuoy aria-hidden="true" />
          {m.email_problem_support()}
        </Button>
      </div>
    </div>
  );
}
