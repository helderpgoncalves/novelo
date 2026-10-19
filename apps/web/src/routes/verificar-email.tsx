import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { z } from 'zod';
import { verifyEmailMutation } from '@/client/@tanstack/react-query.gen';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api-error';
import { queryClient } from '@/lib/query-client';

export const Route = createFileRoute('/verificar-email')({
  validateSearch: z.object({ token: z.string().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: 'Confirmar email · Novelo' }] }),
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

  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <BrandLogo className="justify-center" />
        <div
          className="space-y-4 rounded-xl bg-card p-8 ring-1 ring-foreground/10"
          aria-live="polite"
        >
          {state === 'loading' && (
            <>
              <Loader2 className="mx-auto size-7 animate-spin text-primary" aria-hidden="true" />
              <p className="font-medium">A confirmar o teu email…</p>
            </>
          )}
          {state === 'ok' && (
            <>
              <CheckCircle2 className="mx-auto size-7 text-primary" aria-hidden="true" />
              <h1 className="text-2xl">Email confirmado</h1>
              <p className="text-muted-foreground text-sm">A tua conta está protegida.</p>
              <Button asChild className="w-full">
                <Link to="/">Abrir o Novelo</Link>
              </Button>
            </>
          )}
          {state === 'error' && (
            <>
              <XCircle className="mx-auto size-7 text-destructive" aria-hidden="true" />
              <h1 className="text-2xl">Link inválido</h1>
              <p className="text-muted-foreground text-sm">
                {token ? getErrorMessage(verify.error) : 'O link está incompleto.'} Entra na tua
                conta e pede um novo link.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/entrar">Ir para a entrada</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
