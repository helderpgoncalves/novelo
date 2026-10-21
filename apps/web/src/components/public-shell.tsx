import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { CONTACT_EMAIL } from '@/features/legal/content';
import { m } from '@/paraglide/messages';

/** Margens laterais únicas das páginas públicas (16 px em telemóvel). Cabeçalho, secções e rodapé usam-nas. */
export const PUBLIC_GUTTER = 'px-4 sm:px-6 lg:px-8';
/** Largura máxima do conteúdo da landing. */
export const PUBLIC_WIDE = 'max-w-6xl';

const linkClass =
  'inline-flex min-h-11 items-center rounded-sm text-muted-foreground underline-offset-4 outline-none transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring';

/** Ligações legais e de contacto: visíveis em todas as páginas públicas (a Google exige-as na página inicial). */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label={m.public_nav_label()} className={className}>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-0 sm:gap-x-5">
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
        <li>
          <Link to="/credits" className={linkClass}>
            {m.public_nav_credits()}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/**
 * Estrutura das páginas públicas (sem sessão): topo fixo com marca, navegação, idioma e tema; rodapé com
 * Privacidade, Termos, contacto e Créditos (o mesmo do ecrã de entrada).
 */
export function PublicShell({
  children,
  actions,
  nav,
  menu,
  header,
  footer,
  width = 'max-w-5xl',
}: {
  children: ReactNode;
  /** Botões à direita do topo a partir de `md` (ex.: Entrar, Criar conta). */
  actions?: ReactNode;
  /** Navegação do topo em ecrãs largos (`lg`). */
  nav?: ReactNode;
  /** Botão do menu em ecrãs estreitos (< `lg`). */
  menu?: ReactNode;
  /** Substitui o topo por omissão (a landing traz o seu, fixo e transparente). */
  header?: ReactNode;
  /** Substitui o rodapé compacto por omissão (a landing traz o seu, completo). */
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <a
        href="#content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {m.common_skip_to_content()}
      </a>
      {header ?? (
        <header className="sticky top-0 z-40 border-border/60 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className={`mx-auto flex h-16 w-full items-center gap-3 ${PUBLIC_GUTTER} ${width}`}>
            <Link
              to="/"
              aria-label="Novelo"
              className="flex min-h-11 shrink-0 items-center rounded-sm"
            >
              <BrandLogo className="h-8" />
            </Link>
            {nav && <div className="hidden flex-1 justify-center lg:flex">{nav}</div>}
            <div className={`ml-auto flex items-center gap-1 ${nav ? 'lg:ml-0' : ''}`}>
              {actions}
              <div className="flex items-center [&_button]:size-11">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
              {menu}
            </div>
          </div>
        </header>
      )}
      <div className="flex-1">{children}</div>
      {footer ?? (
        <footer className="border-border border-t bg-card/40 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className={`mx-auto flex w-full flex-col gap-6 py-10 ${PUBLIC_GUTTER} ${width}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3">
                <BrandLogo className="h-7 self-start" />
                <p className="max-w-sm text-pretty text-muted-foreground text-sm">
                  {m.landing_footer_tagline()}
                </p>
              </div>
              <LegalLinks className="text-sm" />
            </div>
            <p className="border-border border-t pt-5 text-muted-foreground text-xs">
              {m.landing_footer_note()}
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
