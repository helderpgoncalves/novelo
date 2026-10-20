import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { CONTACT_EMAIL } from '@/features/legal/content';
import { m } from '@/paraglide/messages';

const linkClass =
  'inline-flex min-h-11 items-center rounded-sm text-muted-foreground underline-offset-4 outline-none transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring';

/** Ligações legais e de contacto: visíveis em todas as páginas públicas (a Google exige-as na página inicial). */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label={m.public_nav_label()} className={className}>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-0">
        <li>
          <Link to="/privacy" className={linkClass}>
            {m.public_nav_privacy()}
          </Link>
        </li>
        <li>
          <Link to="/terms" className={linkClass}>
            {m.public_nav_terms()}
          </Link>
        </li>
        <li>
          <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
            {m.public_nav_contact()}
            <span className="sr-only">: {CONTACT_EMAIL}</span>
          </a>
        </li>
      </ul>
    </nav>
  );
}

/** Estrutura das páginas públicas (sem sessão): topo com marca, idioma e tema; rodapé com Privacidade, Termos e contacto. */
export function PublicShell({
  children,
  actions,
  width = 'max-w-5xl',
}: {
  children: ReactNode;
  /** Botões à direita do topo (ex.: Entrar). */
  actions?: ReactNode;
  width?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header
        className={`mx-auto flex w-full items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-6 ${width}`}
      >
        <Link to="/" aria-label="Novelo">
          <BrandLogo className="h-8" />
        </Link>
        <div className="flex items-center gap-1">
          {actions}
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-border border-t bg-card/40 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className={`mx-auto flex w-full flex-col gap-3 px-4 py-5 sm:px-6 ${width}`}>
          <LegalLinks className="text-xs" />
          <p className="text-muted-foreground text-xs">{m.landing_footer_note()}</p>
        </div>
      </footer>
    </div>
  );
}
