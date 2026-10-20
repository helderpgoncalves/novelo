import { type ReactNode, useEffect, useRef } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LegalLinks } from '@/components/public-shell';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

interface ErrorScreenProps {
  eyebrow: string;
  title: string;
  /** Número grande e decorativo (404, 403). */
  code?: string;
  children?: ReactNode;
  actions?: ReactNode;
  /** `page`: ocupa o ecrã, só quando nada mais a envolve (erro da raiz); `panel`: dentro de qualquer outro layout (app, entrada), sem logótipo nem altura própria. */
  layout?: 'page' | 'panel';
}

/**
 * Esqueleto de todos os ecrãs de erro: eyebrow, título serifado, texto e ações. O foco vai para o título ao
 * montar (quem usa leitor de ecrã ouve-o, quem usa teclado começa aqui), por isso o contentor não leva `role="alert"`:
 * só as falhas inesperadas (500) anunciam a mensagem como alerta, no texto, e os estados esperados (404, 403,
 * offline) não gritam.
 */
export function ErrorScreen({
  eyebrow,
  title,
  code,
  children,
  actions,
  layout = 'panel',
}: ErrorScreenProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  const page = layout === 'page';
  const body = (
    <div
      className={cn(
        'flex w-full max-w-lg flex-col items-center gap-3 text-center sm:gap-4',
        // `my-auto` centra o bloco na vertical dentro de qualquer contentor flex (página, formulário de entrada).
        'my-auto',
        page ? 'py-4' : 'py-2 sm:py-8',
      )}
    >
      {code && (
        <p
          aria-hidden="true"
          className="select-none font-medium font-serif text-5xl text-areia tabular-nums leading-none sm:text-7xl"
        >
          {code}
        </p>
      )}
      <div className="space-y-2">
        <p className="eyebrow">{eyebrow}</p>
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-balance text-2xl outline-none sm:text-3xl lg:text-4xl"
        >
          {title}
        </h1>
      </div>
      {children && (
        <div className="max-w-md space-y-2 text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base">
          {children}
        </div>
      )}
      {actions && (
        <div className="mt-1 flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center [&_button]:min-h-11 [&_a]:min-h-11">
          {actions}
        </div>
      )}
    </div>
  );

  if (!page) return body;

  // Página inteira (só quando nada mais a envolve): exatamente o ecrã, em coluna: topo, bloco central, rodapé.
  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))]">
      <header className="relative flex h-11 shrink-0 items-center justify-center">
        <BrandLogo className="h-6" />
        <div className="absolute inset-y-0 right-0 flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      {body}
      <footer className="flex shrink-0 flex-col items-center gap-0 text-center">
        <LegalLinks className="text-xs [&_a]:min-h-8 [&_ul]:justify-center" />
        <p className="whitespace-nowrap text-[11px] text-muted-foreground">{m.auth_footer()}</p>
      </footer>
    </div>
  );
}
