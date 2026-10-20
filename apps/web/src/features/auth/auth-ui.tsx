import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { rich, slot } from '@/features/home/rich';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

/**
 * Escala de espaçamento ÚNICA do fluxo de autenticação (mobile e desktop iguais):
 * `AUTH_BLOCKS` entre blocos (cabeçalho, formulário, alternativas), `AUTH_FIELDS` entre campos de um formulário,
 * `AUTH_BUTTONS` entre botões empilhados. Dentro de um campo (rótulo, controlo, ajuda) usa-se sempre `gap-2`.
 */
export const AUTH_BLOCKS = 'flex flex-col gap-6';
export const AUTH_FIELDS = 'flex flex-col gap-5';
export const AUTH_BUTTONS = 'flex flex-col gap-3';

/** Altura e peso comuns a todos os botões e campos (alvo de toque de 44 px). */
export const AUTH_CONTROL = 'h-11';
export const AUTH_BUTTON = 'h-11 w-full font-medium';
export const AUTH_CTA = 'h-11 w-full font-semibold disabled:opacity-70';

/** Cabeçalho comum dos ecrãs de entrada: título serifado e um subtítulo curto. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-2">
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

const STRENGTH_LABEL = [
  () => m.pw_strength_weak(),
  () => m.pw_strength_fair(),
  () => m.pw_strength_good(),
  () => m.pw_strength_strong(),
] as const;

/** 0 a 3: comprimento mínimo, comprimento folgado e mistura de tipos de caracteres. Só orienta; a API decide. */
export function passwordScore(value: string, min: number): number {
  if (value.length === 0) return -1;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
  if (value.length < min) return 0;
  let score = 1;
  if (value.length >= min + 4 || kinds >= 3) score = 2;
  if (value.length >= min + 4 && kinds >= 3) score = 3;
  return score;
}

/** Indicador discreto de força da palavra-passe: 4 barras e uma palavra (nunca só a cor). */
export function PasswordStrength({ value, min }: { value: string; min: number }) {
  const score = passwordScore(value, min);
  const tone = ['bg-destructive', 'bg-areia', 'bg-primary/70', 'bg-primary'][Math.max(score, 0)];
  return (
    <div className="flex items-center gap-3" data-testid="password-strength">
      <div className="flex flex-1 gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full bg-border transition-colors',
              i <= score && tone,
            )}
          />
        ))}
      </div>
      <p className="min-w-24 text-right text-muted-foreground text-xs" aria-live="polite">
        <span className="sr-only">{m.pw_strength_label()}: </span>
        {score >= 0 ? STRENGTH_LABEL[score]?.() : ''}
      </p>
    </div>
  );
}
