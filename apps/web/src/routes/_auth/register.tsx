import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';
import { getAuthConfigOptions } from '@/client/@tanstack/react-query.gen';
import { EmptyState } from '@/components/states';
import { Separator } from '@/components/ui/separator';
import { GoogleButton } from '@/features/auth/google-button';
import { RegisterForm } from '@/features/auth/register-form';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_auth/register')({
  validateSearch: z.object({ next: z.string().startsWith('/').optional().catch(undefined) }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(getAuthConfigOptions()),
  head: () => ({ meta: [{ title: m.title_register() }] }),
  component: Register,
});

function Register() {
  const { next } = Route.useSearch();
  const { data: config } = useSuspenseQuery(getAuthConfigOptions());

  if (!config.registration_open) {
    return (
      <EmptyState
        title={m.register_closed_title()}
        description={m.register_closed_text()}
        action={
          <Link to="/login" className="font-medium text-primary text-sm hover:underline">
            {m.register_go_login()}
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl">{m.register_title()}</h1>
        <p className="text-muted-foreground text-sm">{m.register_subtitle()}</p>
      </div>
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
      <RegisterForm next={next ?? '/'} />
      <p className="text-center text-muted-foreground text-sm">
        {m.register_have_account()}{' '}
        <Link to="/login" search={{ next }} className="font-medium text-primary hover:underline">
          {m.register_login()}
        </Link>
      </p>
    </div>
  );
}
