import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { KeyRound, Mail } from 'lucide-react';
import { z } from 'zod';
import { getAuthConfigOptions } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FormAlert } from '@/features/auth/form-alert';
import { GoogleButton } from '@/features/auth/google-button';
import { LoginForm } from '@/features/auth/login-form';
import { MagicLinkFlow } from '@/features/auth/magic-link-flow';
import { readLastEmail } from '@/features/auth/passwordless';
import { getErrorMessage, isErrorCode } from '@/lib/errors';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_auth/login')({
  validateSearch: z.object({
    next: z.string().startsWith('/').optional().catch(undefined),
    error: z.string().optional().catch(undefined),
    // 'expired': chegámos aqui porque a sessão terminou (ver main.tsx e o ecrã de sessão terminada).
    reason: z.enum(['expired']).optional().catch(undefined),
    // O link por email é a entrada principal; `password` mostra o formulário clássico.
    method: z.enum(['password']).optional().catch(undefined),
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(getAuthConfigOptions()),
  head: () => ({ meta: [{ title: m.title_login() }] }),
  component: Login,
});

// O callback do Google volta com ?error=<código da API> ou google_failed.
function loginError(code: string | undefined): string | null {
  if (!code) return null;
  if (code === 'google_failed') return m.login_error_google_failed();
  return isErrorCode(code) ? getErrorMessage({ code }) : m.login_error_generic();
}

function Login() {
  const { next, error, reason, method } = Route.useSearch();
  const { data: config } = useSuspenseQuery(getAuthConfigOptions());
  const usePassword = method === 'password' || !config.magic_link_enabled;

  const createAccount = config.registration_open && (
    <p className="text-center text-muted-foreground text-sm">
      {m.login_no_account()}{' '}
      <Link to="/register" search={{ next }} className="font-medium text-primary hover:underline">
        {m.login_create_account()}
      </Link>
    </p>
  );

  if (!usePassword) {
    return (
      <div className="space-y-6">
        <FormAlert message={loginError(error)} />
        <FormAlert tone="info" message={reason === 'expired' ? m.login_session_expired() : null} />
        <MagicLinkFlow
          next={next}
          alternatives={
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-muted-foreground text-xs">
                <Separator className="flex-1" />
                {m.login_or_other()}
                <Separator className="flex-1" />
              </div>
              <div className="space-y-2">
                {config.google_enabled && <GoogleButton next={next} />}
                <Button asChild variant="outline" className="h-10 w-full gap-2.5 font-medium">
                  <Link to="/login" search={{ next, method: 'password' }}>
                    <KeyRound aria-hidden="true" />
                    {m.login_use_password()}
                  </Link>
                </Button>
              </div>
              {createAccount}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl">{m.login_title()}</h1>
        <p className="text-muted-foreground text-sm">{m.login_subtitle()}</p>
      </div>
      <FormAlert message={loginError(error)} />
      <FormAlert tone="info" message={reason === 'expired' ? m.login_session_expired() : null} />
      {config.google_enabled && (
        <>
          <GoogleButton next={next} />
          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            <Separator className="flex-1" />
            {m.login_or_email()}
            <Separator className="flex-1" />
          </div>
        </>
      )}
      <LoginForm next={next ?? '/'} initialEmail={readLastEmail()} />
      {config.magic_link_enabled && (
        <Button asChild variant="ghost" className="h-10 w-full gap-2.5 font-medium">
          <Link to="/login" search={{ next }}>
            <Mail aria-hidden="true" />
            {m.login_use_link()}
          </Link>
        </Button>
      )}
      {createAccount}
    </div>
  );
}
