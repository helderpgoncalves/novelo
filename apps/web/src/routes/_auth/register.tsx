import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { DoorOpen, Info } from 'lucide-react';
import { z } from 'zod';
import {
  getAuthConfigOptions,
  getRegistrationInfoOptions,
} from '@/client/@tanstack/react-query.gen';
import { NoPending } from '@/components/app-loading';
import { EmptyState } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AUTH_BLOCKS,
  AUTH_STACK,
  AuthConsent,
  AuthDivider,
  AuthHeading,
  AuthSwitch,
  authLinkClass,
} from '@/features/auth/auth-ui';
import { GoogleButton } from '@/features/auth/google-button';
import { RegisterForm } from '@/features/auth/register-form';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_auth/register')({
  validateSearch: z.object({ next: z.string().startsWith('/').optional().catch(undefined) }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(getAuthConfigOptions()),
  // O ecrã de entrada é público: sem esqueleto de carregamento.
  pendingComponent: NoPending,
  head: () => ({ meta: [{ title: m.title_register() }] }),
  component: Register,
});

function Register() {
  const { next } = Route.useSearch();
  const { data: config } = useSuspenseQuery(getAuthConfigOptions());
  // Registo aberto (definição do administrador): a conta nova entra logo. A configuração já o reflete; o pedido
  // público confirma-o sem esperar por ela.
  const info = useQuery({ ...getRegistrationInfoOptions(), staleTime: 30_000 });
  const open = info.data?.open ?? config.approval_required === false;

  if (!config.registration_open) {
    return (
      <EmptyState
        title={m.register_closed_title()}
        description={m.register_closed_text()}
        action={
          <Link to="/login" className={authLinkClass}>
            {m.register_go_login()}
          </Link>
        }
      />
    );
  }

  return (
    <div className={AUTH_BLOCKS}>
      <AuthHeading title={m.register_title()} subtitle={m.register_subtitle()} />
      {open ? (
        <Alert
          role="note"
          data-testid="register-open-notice"
          className="border-primary/30 bg-primary/[0.06]"
        >
          <DoorOpen className="text-primary" />
          <AlertDescription className="text-foreground">
            {m.register_open_notice()}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert role="note" data-testid="register-approval-notice">
          <Info />
          <AlertDescription>{m.register_approval_notice()}</AlertDescription>
        </Alert>
      )}
      <div className={AUTH_STACK}>
        <RegisterForm next={next ?? '/'} />
        {config.google_enabled && (
          <>
            <AuthDivider>{m.login_or_other()}</AuthDivider>
            <GoogleButton next={next} mode="signup" />
          </>
        )}
      </div>
      <AuthSwitch>
        {m.register_have_account()}
        <Link to="/login" search={{ next }} className={authLinkClass}>
          {m.register_login()}
        </Link>
      </AuthSwitch>
      <AuthConsent />
    </div>
  );
}
