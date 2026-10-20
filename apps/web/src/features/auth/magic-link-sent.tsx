import { useMutation } from '@tanstack/react-query';
import { ExternalLink, MailCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { requestMagicLinkMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { getLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { FormAlert } from './form-alert';
import { MAGIC_LINK_MINUTES, mailProvider, safeNext, storeLastEmail } from './passwordless';
import { useCountdown } from './use-countdown';

/** Pede o link por email. Usado pelo ecrã de entrada, pelo reenvio e pelo ecrã de link inválido. */
export function useRequestMagicLink() {
  return useMutation({
    ...requestMagicLinkMutation(),
    onSuccess: (_data, vars) => storeLastEmail(vars.body.email),
  });
}

export function magicLinkBody(email: string, next?: string) {
  const target = safeNext(next);
  return { email: email.trim(), locale: getLocale(), ...(target === '/' ? {} : { next: target }) };
}

/**
 * "Enviámos um link para x": o ecrã seguinte ao pedido. Abre a app de email quando o domínio a identifica,
 * deixa reenviar passada a espera (com contagem decrescente) e mudar de email.
 */
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
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [resent, setResent] = useState(false);
  const seconds = useCountdown(sentAt);
  const heading = useRef<HTMLHeadingElement>(null);
  const resend = useRequestMagicLink();
  const provider = mailProvider(email);

  useEffect(() => heading.current?.focus(), []);

  const onResend = () => {
    setResent(false);
    resend.mutate(
      { body: magicLinkBody(email, next) },
      {
        onSuccess: () => {
          setSentAt(Date.now());
          setResent(true);
        },
      },
    );
  };

  return (
    <div className="motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:animate-in space-y-6 duration-300">
      <div className="space-y-3">
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
        <Button asChild className="h-11 w-full font-semibold">
          <a href={provider.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            {m.magic_open_mail({ provider: provider.name })}
          </a>
        </Button>
      )}

      <div className="space-y-3">
        <FormAlert message={resend.isError ? getErrorMessage(resend.error) : null} />
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={seconds > 0 || resend.isPending}
            loading={resend.isPending}
            onClick={onResend}
          >
            {seconds > 0 ? m.magic_resend_in({ seconds }) : m.magic_resend()}
          </Button>
          <Button type="button" variant="ghost" className="h-11" onClick={onChangeEmail}>
            {m.magic_change_email()}
          </Button>
        </div>
        <p role="status" className="min-h-5 text-primary text-xs">
          {resent ? m.magic_resent() : ''}
        </p>
      </div>

      <p className="rounded-lg bg-muted/60 p-3 text-muted-foreground text-xs leading-relaxed">
        {m.magic_spam_tip({ minutes: MAGIC_LINK_MINUTES })}
      </p>
    </div>
  );
}
