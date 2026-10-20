import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { GithubMark } from '@/components/github-mark';
import { LanguageSwitcher } from '@/components/language-switcher';
import { PUBLIC_GUTTER, PUBLIC_WIDE } from '@/components/public-shell';
import { ThemeToggle } from '@/components/theme-toggle';
import { CONTACT_EMAIL } from '@/features/legal/content';
import { m } from '@/paraglide/messages';
import { REPO_URL } from './facts';
import { HackathonCover } from './hackathon-cover';
import { HACKATHON_URL } from './photo-credits';

const NEW_TAB = 'noopener noreferrer';

/** Texto só para leitores de ecrã nas ligações que abrem noutro separador. */
function NewTab() {
  return <span className="sr-only"> {m.footer_new_tab()}</span>;
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="lp-kicker pb-1">{title}</h2>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

/**
 * Rodapé da landing. Grelha de 12 colunas em ecrã largo (marca à esquerda, três colunas de ligações à direita), cartão do
 * hackathon, parceiros e barra final com idioma e tema. Em telemóvel as colunas empilham-se em duas e o cartão fica
 * horizontal, por isso o rodapé não passa de um ecrã e meio. As fotografias não têm bloco aqui: os créditos e licenças vivem
 * na página «Créditos e licenças» (ligada na coluna Legal).
 */
export function LandingFooter() {
  return (
    <footer className="lp-ft border-border border-t bg-card/40 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className={`mx-auto w-full ${PUBLIC_WIDE} ${PUBLIC_GUTTER}`}>
        <div className="grid gap-10 pt-10 pb-8 sm:pt-12 sm:pb-10 lg:grid-cols-12 lg:gap-x-8 lg:pt-16 lg:pb-14">
          <div className="flex flex-col gap-5 lg:col-span-4 lg:pr-8">
            <Link
              to="/"
              aria-label="Novelo"
              className="-ml-1 flex min-h-11 items-center self-start rounded-sm px-1 outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              <BrandLogo className="h-8" />
            </Link>
            <p className="max-w-xs text-pretty font-medium font-serif text-[1.375rem] leading-snug tracking-[-0.01em]">
              {m.landing_footer_tagline()}
            </p>
            <ul className="flex flex-wrap gap-x-6 lg:flex-col">
              <li>
                <a href={REPO_URL} target="_blank" rel={NEW_TAB} className="lp-ft-link gap-2.5">
                  <GithubMark className="size-4" />
                  {m.landing_cta_code()}
                  <NewTab />
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="lp-ft-link gap-2.5">
                  <Mail className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  {m.footer_support()}
                  <span className="sr-only">: {CONTACT_EMAIL}</span>
                </a>
              </li>
            </ul>
          </div>

          <nav
            aria-label={m.footer_label()}
            className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:col-span-7 lg:col-start-6"
          >
            <div className="max-sm:row-span-2">
              <Column title={m.footer_col_product()}>
                <li>
                  <a href="#metodo" className="lp-ft-link">
                    {m.landing_nav_method()}
                  </a>
                </li>
                <li>
                  <a href="#prova" className="lp-ft-link">
                    {m.landing_nav_proof()}
                  </a>
                </li>
                <li>
                  <a href="#produto" className="lp-ft-link">
                    {m.landing_nav_product()}
                  </a>
                </li>
                <li>
                  <a href="#copiloto" className="lp-ft-link">
                    {m.landing_nav_copilot()}
                  </a>
                </li>
                <li>
                  <a href="#rigor" className="lp-ft-link">
                    {m.landing_nav_rigor()}
                  </a>
                </li>
                <li>
                  <Link to="/login" className="lp-ft-link lp-ft-strong">
                    {m.landing_sign_in()}
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="lp-ft-link lp-ft-strong">
                    {m.landing_register()}
                  </Link>
                </li>
              </Column>
            </div>
            <Column title={m.footer_col_project()}>
              <li>
                <a href="#equipa" className="lp-ft-link">
                  {m.landing_nav_team()}
                </a>
              </li>
              <li>
                <a href="#referencias" className="lp-ft-link">
                  {m.footer_references()}
                </a>
              </li>
              <li>
                <a href="#perguntas" className="lp-ft-link">
                  {m.landing_nav_faq()}
                </a>
              </li>
              <li>
                <a href={REPO_URL} target="_blank" rel={NEW_TAB} className="lp-ft-link">
                  {m.footer_source()}
                  <NewTab />
                </a>
              </li>
            </Column>
            <Column title={m.footer_col_legal()}>
              <li>
                <Link to="/privacy" className="lp-ft-link">
                  {m.public_nav_privacy()}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="lp-ft-link">
                  {m.public_nav_terms()}
                </Link>
              </li>
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="lp-ft-link">
                  {m.public_nav_contact()}
                  <span className="sr-only">: {CONTACT_EMAIL}</span>
                </a>
              </li>
              <li>
                <Link to="/credits" className="lp-ft-link">
                  {m.footer_credits()}
                </Link>
              </li>
            </Column>
          </nav>
        </div>

        <section aria-labelledby="ft-hack-title" className="lp-ft-card">
          <div className="lp-ft-card-grid">
            <div className="lp-ft-media">
              <HackathonCover
                sizes="(min-width: 1024px) 380px, (min-width: 640px) 40vw, 38vw"
                className="lp-ft-cover"
              />
            </div>
            <div className="flex min-w-0 flex-col justify-center gap-1.5 sm:gap-2">
              <p className="lp-kicker">{m.footer_hack_eyebrow()}</p>
              <h2
                id="ft-hack-title"
                className="font-medium font-serif text-[1.25rem] leading-tight tracking-[-0.015em] sm:text-[1.75rem] lg:text-[2rem]"
              >
                <a
                  href={HACKATHON_URL}
                  target="_blank"
                  rel={NEW_TAB}
                  className="lp-ft-stretch rounded-sm outline-none"
                >
                  Hack4Guimarães 2035
                  <NewTab />
                </a>
              </h2>
              <p className="font-medium text-[0.8125rem] text-primary sm:text-sm">
                {m.footer_hack_challenge()}
              </p>
              <p className="hidden max-w-md text-pretty text-muted-foreground text-sm leading-relaxed sm:block">
                {m.footer_hack_text()}
              </p>
              <span className="lp-ft-cta mt-1 hidden items-center gap-1 font-medium text-sm sm:inline-flex">
                {m.footer_hack_cta()}
                <ArrowUpRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </span>
            </div>
          </div>
          <p className="lp-ft-card-note">{m.footer_hack_organisers()}</p>
        </section>

        <div className="lp-ft-partners">
          <h2 className="lp-kicker">{m.footer_partners_label()}</h2>
          <ul className="flex flex-wrap gap-y-1 text-muted-foreground text-sm">
            <li>{m.footer_partner_vitrus()}</li>
            <li>{m.footer_partner_texvitrus()}</li>
            <li>{m.footer_partner_ine()}</li>
            <li>{m.footer_partner_urbact()}</li>
          </ul>
        </div>

        <div className="lp-ft-bar">
          <p className="lp-ft-copy">{m.landing_footer_note()}</p>
          <p className="lp-ft-made">{m.footer_made_for()}</p>
          <div className="lp-ft-controls">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
