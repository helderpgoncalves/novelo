import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { KeyRound, Mail } from 'lucide-react';
import { z } from 'zod';
import { getAuthConfigOptions } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import {
  AuthConsent,
  AuthDivider,
  AuthHeading,
  AuthSwitch,
  authLinkClass,
} from '@/features/auth/auth-ui';
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
    <AuthSwitch>
      {m.login_no_account()}
      <Link to="/register" search={{ next }} className={authLinkClass}>
        {m.login_create_account()}
      </Link>
    </AuthSwitch>
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
              <AuthDivider>{m.login_or_other()}</AuthDivider>
              {config.google_enabled && <GoogleButton next={next} />}
              <div className="space-y-1 pt-1">
                <Button
                  asChild
                  variant="ghost"
                  className="h-11 w-full gap-2 font-medium text-muted-foreground hover:text-foreground"
                >
                  <Link to="/login" search={{ next, method: 'password' }}>
                    <KeyRound aria-hidden="true" />
                    {m.login_use_password()}
                  </Link>
                </Button>
                {createAccount}
              </div>
              <AuthConsent />
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeading title={m.login_title()} subtitle={m.login_subtitle()} />
      <FormAlert message={loginError(error)} />
      <FormAlert tone="info" message={reason === 'expired' ? m.login_session_expired() : null} />
      <LoginForm next={next ?? '/'} initialEmail={readLastEmail()} />
      {config.google_enabled && (
        <div className="space-y-4">
          <AuthDivider>{m.login_or_other()}</AuthDivider>
          <GoogleButton next={next} />
        </div>
      )}
      <div className="space-y-1">
        {config.magic_link_enabled && (
          <Button
            asChild
            variant="ghost"
            className="h-11 w-full gap-2 font-medium text-muted-foreground hover:text-foreground"
          >
            <Link to="/login" search={{ next }}>
              <Mail aria-hidden="true" />
              {m.login_use_link()}
            </Link>
          </Button>
        )}
        {createAccount}
      </div>
      <AuthConsent />
    </div>
  );
}
