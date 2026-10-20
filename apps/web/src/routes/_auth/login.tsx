import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { KeyRound, Mail } from 'lucide-react';
import { z } from 'zod';
import { getAuthConfigOptions } from '@/client/@tanstack/react-query.gen';
import { NoPending } from '@/components/app-loading';
import { Button } from '@/components/ui/button';
import {
  AUTH_BLOCKS,
  AUTH_BUTTON,
  AUTH_BUTTONS,
  AUTH_STACK,
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
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_auth/login')({
  validateSearch: z.object({
    next: z.string().startsWith('/').optional().catch(undefined),
    error: z.string().optional().catch(undefined),
    // 'expired': chegámos aqui porque a sessão terminou (ver main.tsx e o ecrã de sessão terminada).
    reason: z.enum(['expired', 'invite']).optional().catch(undefined),
    // O link por email é a entrada principal; `password` mostra o formulário clássico.
    method: z.enum(['password']).optional().catch(undefined),
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(getAuthConfigOptions()),
  // O ecrã de entrada é público: sem esqueleto de carregamento.
  pendingComponent: NoPending,
  head: () => ({ meta: [{ title: m.title_login() }] }),
  component: Login,
});

// O callback do Google volta com ?error=<código da API> ou google_failed.
function loginError(code: string | undefined): string | null {
  if (!code) return null;
  if (code === 'google_failed') return m.login_error_google_failed();
  return isErrorCode(code) ? getErrorMessage({ code }) : m.login_error_generic();
}

const reasonMessage = (reason: 'expired' | 'invite' | undefined): string | null =>
  reason === 'expired'
    ? m.login_session_expired()
    : reason === 'invite'
      ? m.auth_invite_reason()
      : null;

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

  // Alternativas ao método principal. `methods` (divisor, Google e o outro método) entra no mesmo grupo de ação do
  // formulário, com o mesmo passo de 16 px; `footer` (criar conta) fica num bloco à parte. Os termos e a política
  // estão no rodapé da página, por isso não se repetem aqui.
  const alternative = (to: 'password' | 'link') => ({
    methods: (
      <>
        <AuthDivider>{m.login_or_other()}</AuthDivider>
        <div className={AUTH_BUTTONS}>
          {config.google_enabled && <GoogleButton next={next} />}
          {(to === 'password' || config.magic_link_enabled) && (
            <Button asChild variant="outline" className={cn(AUTH_BUTTON, 'gap-3')}>
              <Link
                to="/login"
                search={to === 'password' ? { next, method: 'password' } : { next }}
              >
                {to === 'password' ? <KeyRound aria-hidden="true" /> : <Mail aria-hidden="true" />}
                {to === 'password' ? m.login_use_password() : m.login_use_link()}
              </Link>
            </Button>
          )}
        </div>
      </>
    ),
    footer: createAccount,
  });

  if (!usePassword) {
    return (
      <div className={AUTH_BLOCKS}>
        <FormAlert message={loginError(error)} />
        <FormAlert tone="info" message={reasonMessage(reason)} />
        <MagicLinkFlow next={next} alternatives={alternative('password')} />
      </div>
    );
  }

  const alternatives = alternative('link');

  return (
    <div className={AUTH_BLOCKS}>
      <AuthHeading title={m.login_title()} subtitle={m.login_subtitle()} />
      <FormAlert message={loginError(error)} />
      <FormAlert tone="info" message={reasonMessage(reason === 'invite' ? undefined : reason)} />
      <div className={AUTH_STACK}>
        <LoginForm next={next ?? '/'} initialEmail={readLastEmail()} />
        {alternatives.methods}
      </div>
      {alternatives.footer}
    </div>
  );
}
