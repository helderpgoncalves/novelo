import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';
import { getAuthConfigOptions } from '@/client/@tanstack/react-query.gen';
import { Separator } from '@/components/ui/separator';
import { FormAlert } from '@/features/auth/form-alert';
import { GoogleButton } from '@/features/auth/google-button';
import { LoginForm } from '@/features/auth/login-form';

const ERRORS: Record<string, string> = {
  google: 'Não foi possível entrar com a Google. Tenta de novo.',
  registration_closed: 'O registo está fechado. Pede acesso à equipa.',
  unauthorized: 'Esta conta está inativa.',
  upstream_error: 'A Google não confirmou o teu email. Usa uma conta com email verificado.',
};

export const Route = createFileRoute('/_auth/entrar')({
  validateSearch: z.object({
    next: z.string().startsWith('/').optional().catch(undefined),
    erro: z.string().optional().catch(undefined),
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(getAuthConfigOptions()),
  head: () => ({ meta: [{ title: 'Entrar · Novelo' }] }),
  component: Login,
});

function Login() {
  const { next, erro } = Route.useSearch();
  const { data: config } = useSuspenseQuery(getAuthConfigOptions());

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl">Entrar</h1>
        <p className="text-muted-foreground text-sm">
          Acede à rede de recolha de têxteis de Guimarães.
        </p>
      </div>
      {erro && <FormAlert message={ERRORS[erro] ?? 'Não foi possível entrar. Tenta de novo.'} />}
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
      <LoginForm next={next ?? '/'} />
      {config.registration_open && (
        <p className="text-center text-muted-foreground text-sm">
          Ainda não tens conta?{' '}
          <Link
            to="/criar-conta"
            search={{ next }}
            className="font-medium text-primary hover:underline"
          >
            Criar conta
          </Link>
        </p>
      )}
    </div>
  );
}
