import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { LinkIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getMeQueryKey, verifyMagicLinkMutation } from '@/client/@tanstack/react-query.gen';
import { BrandLogo, BrandSpinner } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LegalLinks } from '@/components/public-shell';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';
import { AUTH_BUTTONS, AUTH_CTA } from './auth-ui';
import { FormAlert } from './form-alert';
import { MagicLinkSent, magicLinkBody, useRequestMagicLink } from './magic-link-sent';
import { MAGIC_LINK_MINUTES, readLastEmail, safeNext } from './passwordless';

/**
 * Destino do link do email. Consome o token uma só vez (o `ref` aguenta o StrictMode e as rotas repetidas),
 * tira-o do URL de imediato e só depois pede a sessão. Sucesso segue para `next` sem ecrã intermédio novo.
 */
export function MagicLinkPage({
  urlToken,
  clearToken,
}: {
  urlToken: string | undefined;
  clearToken: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const token = useRef(urlToken);
  const started = useRef(false);
  const [requested, setRequested] = useState<string | null>(null);
  const lastEmail = useRef(readLastEmail());
  const verify = useMutation({
    ...verifyMagicLinkMutation(),
    onSuccess: async ({ user, next }) => {
      queryClient.clear(); // nada da sessão anterior (outra conta) fica na cache
      queryClient.setQueryData(getMeQueryKey(), user);
      await navigate({
        to: user.approval_status === 'approved' ? safeNext(next) : '/pending-approval',
        replace: true,
      });
    },
  });
  const renew = useRequestMagicLink();

  const { mutate } = verify;
  const run = useCallback(() => {
    if (token.current) mutate({ body: { token: token.current } });
  }, [mutate]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (urlToken) {
      token.current = urlToken;
      clearToken();
      run();
    }
    // `started` garante uma só verificação por visita, mesmo com as dependências a mudar a cada render.
  }, [urlToken, clearToken, run]);

  const code = getErrorCode(verify.error);
  const state = !token.current
    ? 'bad'
    : verify.isError
      ? code === 'invalid_token' || code === 'validation_error'
        ? 'bad'
        : 'failed'
      : 'loading';

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr_auto] px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <BrandLogo className="h-8" />
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-col justify-center py-8">
        {requested ? (
          <MagicLinkSent
            email={requested}
            onChangeEmail={() => {
              setRequested(null);
              lastEmail.current = '';
            }}
          />
        ) : state === 'loading' ? (
          <div role="status" aria-live="polite" className="flex flex-col gap-4 text-center">
            <BrandSpinner className="mx-auto size-8" />
            <h1 className="text-2xl">
              {verify.isSuccess ? m.magic_verify_done() : m.magic_verify_title()}
            </h1>
            <p className="text-muted-foreground text-sm">{m.magic_verify_text()}</p>
          </div>
        ) : (
          <div className="motion-safe:fade-in-0 motion-safe:animate-in duration-300 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <span className="flex size-12 items-center justify-center rounded-full bg-areia/25 text-foreground">
                <LinkIcon className="size-6" aria-hidden="true" />
              </span>
              <h1 className="text-3xl">
                {state === 'bad' ? m.magic_bad_title() : m.magic_failed_title()}
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {state === 'bad'
                  ? token.current
                    ? m.magic_bad_text({ minutes: MAGIC_LINK_MINUTES })
                    : m.magic_bad_incomplete()
                  : getErrorMessage(verify.error)}
              </p>
            </div>
            <div className={AUTH_BUTTONS}>
              <FormAlert message={renew.isError ? getErrorMessage(renew.error) : null} />
              {state === 'bad' && lastEmail.current && renew.gate.field}
              {state === 'failed' && (
                <Button className={AUTH_CTA} loading={verify.isPending} onClick={run}>
                  {m.common_retry()}
                </Button>
              )}
              {state === 'bad' && lastEmail.current && (
                <Button
                  className={AUTH_CTA}
                  loading={renew.isPending}
                  disabled={renew.gate.blocked}
                  onClick={() => {
                    const email = lastEmail.current;
                    renew.send(magicLinkBody(email), { onSuccess: () => setRequested(email) });
                  }}
                >
                  {renew.gate.verifying
                    ? m.turnstile_verifying()
                    : m.magic_request_new_to({ email: lastEmail.current })}
                </Button>
              )}
              <Button
                asChild
                variant={state === 'bad' && lastEmail.current ? 'ghost' : 'default'}
                className={AUTH_CTA}
              >
                <Link to="/login">
                  {state === 'bad' && lastEmail.current
                    ? m.magic_other_email()
                    : m.magic_request_new()}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </main>
      <LegalLinks className="text-xs [&_ul]:justify-center" />
    </div>
  );
}
