import { DitherBand } from '@/components/dither';
import { PublicShell } from '@/components/public-shell';
import { m } from '@/paraglide/messages';
import { Audience, Faq, FinalCta } from './closing';
import { Features } from './features';
import { Hero, Proof } from './hero';
import { Evidence } from './lab';
import { LandingHeader, LandingToc } from './landing-nav';
import { Copilot, DataSources, Impact, ProductShowcase } from './product';
import { useRevealOnScroll } from './reveal';
import { References, Rigor, Team } from './rigor';
import { HowItWorks, Problem } from './story';

const COMMONS_URL =
  'https://commons.wikimedia.org/wiki/File:Costa_-_Penha,_Guimar%C3%A3es_-_20210501194326.jpg';
const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

/** Atribuição obrigatória da fotografia do hero (CC BY-SA 4.0; ver public/landing/CREDITS.md). */
function PhotoCredit() {
  const link =
    'rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <p className="font-mono text-[11px] text-muted-foreground">
      {m.landing_photo_credit()}{' '}
      <a href={COMMONS_URL} target="_blank" rel="noopener noreferrer" className={link}>
        RaquelRosa7, Wikimedia Commons
      </a>
      ,{' '}
      <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className={link}>
        CC BY-SA 4.0
      </a>
      , {m.landing_photo_credit_adapted()}
    </p>
  );
}

/**
 * Página inicial pública (sem sessão): é a "Application home page" do ecrã de consentimento da Google, por isso
 * diz o que o Novelo faz, mostra números reais com fonte, tem Entrar/Criar conta e, no rodapé, Privacidade, Termos
 * e contacto. Sem chamadas à API: todos os números são os dos dados recebidos (Regra Zero). Narrativa de artigo e
 * produto: tese → problema com fontes → método → prova → produto → rigor → equipa e referências.
 */
export function LandingPage() {
  useRevealOnScroll();
  return (
    <PublicShell width="max-w-6xl" header={<LandingHeader />} footerExtra={<PhotoCredit />}>
      <LandingToc />
      <main id="content" data-landing="" data-lp-fonts="" tabIndex={-1} className="outline-none">
        <Hero />
        <DitherBand />
        <Proof />
        <Problem />
        <Impact />
        <HowItWorks />
        <Evidence />
        <ProductShowcase />
        <Features />
        <Copilot />
        <Rigor />
        <DataSources />
        <Audience />
        <Team />
        <References />
        <Faq />
        <FinalCta />
        <DitherBand flip />
      </main>
    </PublicShell>
  );
}
