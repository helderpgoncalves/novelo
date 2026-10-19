import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';
import { getAuthConfigOptions } from '@/client/@tanstack/react-query.gen';
import { EmptyState } from '@/components/states';
import { Separator } from '@/components/ui/separator';
import { GoogleButton } from '@/features/auth/google-button';
import { RegisterForm } from '@/features/auth/register-form';

export const Route = createFileRoute('/_auth/criar-conta')({
  validateSearch: z.object({ next: z.string().startsWith('/').optional().catch(undefined) }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(getAuthConfigOptions()),
  head: () => ({ meta: [{ title: 'Criar conta · Novelo' }] }),
  component: Register,
});

function Register() {
  const { next } = Route.useSearch();
  const { data: config } = useSuspenseQuery(getAuthConfigOptions());

  if (!config.registration_open) {
    return (
      <EmptyState
        title="O registo está fechado"
        description="Pede acesso à equipa do Novelo ou entra com uma conta existente."
        action={
          <Link to="/entrar" className="font-medium text-primary text-sm hover:underline">
            Ir para a entrada
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl">Criar conta</h1>
        <p className="text-muted-foreground text-sm">Leva um minuto. Só precisas de um email.</p>
      </div>
      {config.google_enabled && (
        <>
          <GoogleButton next={next} />
          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            <Separator className="flex-1" />
            ou com email
            <Separator className="flex-1" />
          </div>
        </>
      )}
      <RegisterForm next={next ?? '/'} />
      <p className="text-center text-muted-foreground text-sm">
        Já tens conta?{' '}
        <Link to="/entrar" search={{ next }} className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
