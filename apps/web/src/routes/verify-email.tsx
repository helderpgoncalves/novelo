import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { z } from 'zod';
import { getMeOptions, verifyEmailMutation } from '@/client/@tanstack/react-query.gen';
import { BrandLogo, BrandSpinner } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { queryClient } from '@/lib/query-client';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/verify-email')({
  validateSearch: z.object({ token: z.string().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: m.title_verify() }] }),
  component: VerifyEmail,
});

// Fora dos layouts de entrada e da app: funciona com ou sem sessão iniciada.
function VerifyEmail() {
  const { token } = Route.useSearch();
  const verify = useMutation({
    ...verifyEmailMutation(),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const started = useRef(false);

  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      verify.mutate({ body: { token } });
    }
  }, [token, verify]);

  const state = !token || verify.isError ? 'error' : verify.isSuccess ? 'ok' : 'loading';
  // Com sessão e a conta ainda por aprovar, a boa notícia vem com o próximo passo.
  const me = useQuery({ ...getMeOptions(), enabled: state === 'ok', retry: false });
  const awaitingApproval = me.data !== undefined && me.data.approval_status !== 'approved';

  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm space-y-6 text-center">
        <BrandLogo className="mx-auto h-9" />
        <div
          className="space-y-4 rounded-xl bg-card p-8 ring-1 ring-foreground/10"
          aria-live="polite"
        >
          {state === 'loading' && (
            <>
              <BrandSpinner className="mx-auto size-7" />
              <p className="font-medium">{m.verify_loading()}</p>
            </>
          )}
          {state === 'ok' && (
            <>
              <CheckCircle2 className="mx-auto size-7 text-primary" aria-hidden="true" />
              <h1 className="text-2xl">{m.verify_ok_title()}</h1>
              <p className="text-muted-foreground text-sm">
                {awaitingApproval ? m.verify_ok_pending() : m.verify_ok_text()}
              </p>
              <Button asChild className="w-full">
                {awaitingApproval ? (
                  <Link to="/pending-approval">{m.verify_see_status()}</Link>
                ) : (
                  <Link to="/">{m.verify_open_app()}</Link>
                )}
              </Button>
            </>
          )}
          {state === 'error' && (
            <>
              <XCircle className="mx-auto size-7 text-destructive" aria-hidden="true" />
              <h1 className="text-2xl">{m.verify_error_title()}</h1>
              <p className="text-muted-foreground text-sm">
                {m.verify_error_text({
                  reason: token ? getErrorMessage(verify.error) : m.verify_error_incomplete(),
                })}
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">{m.verify_go_login()}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
