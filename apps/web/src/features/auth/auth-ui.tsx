import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { rich, slot } from '@/features/home/rich';
import { m } from '@/paraglide/messages';

/** Cabeçalho comum dos ecrãs de entrada: título serifado e um subtítulo curto. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1.5">
      <h1 className="text-3xl">{title}</h1>
      {subtitle && <p className="text-muted-foreground text-sm leading-relaxed">{subtitle}</p>}
    </div>
  );
}

/** Divisor com texto ("ou entra de outra forma"). */
export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-muted-foreground text-xs">
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
      {children}
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}

/** Linha de troca discreta ("Ainda não tens conta? Criar conta"), com alvo de toque de 44 px. */
export function AuthSwitch({ children }: { children: ReactNode }) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-muted-foreground text-sm">
      {children}
    </p>
  );
}

export const authLinkClass =
  'inline-flex min-h-11 items-center rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring';

/** Uma linha discreta, comum a todos os métodos, no fim do cartão. Os dados usados estão na Política de Privacidade. */
export function AuthConsent() {
  const link =
    'rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <p className="text-balance pt-1 text-center text-muted-foreground text-xs leading-relaxed">
      {rich(m.google_consent({ terms: slot('terms'), privacy: slot('privacy') }), {
        terms: (
          <Link to="/terms" className={link}>
            {m.google_consent_terms()}
          </Link>
        ),
        privacy: (
          <Link to="/privacy" className={link}>
            {m.google_consent_privacy()}
          </Link>
        ),
      })}
    </p>
  );
}
