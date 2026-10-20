import { PhotoBand, PhotoCredits } from '@/components/photos';
import { PublicShell } from '@/components/public-shell';
import './landing-assets.generated.css';
import { Audience, Faq, FinalCta } from './closing';
import { Features } from './features';
import { Hero, Proof } from './hero';
import { Evidence } from './lab';
import { LandingHeader, LandingToc } from './landing-nav';
import { Copilot, DataSources, Impact, ProductShowcase } from './product';
import { useRevealOnScroll } from './reveal';
import { References, Rigor, Team } from './rigor';
import { HowItWorks, Problem } from './story';

/**
 * Página inicial pública (sem sessão): é a "Application home page" do ecrã de consentimento da Google, por isso
 * diz o que o Novelo faz, mostra números reais com fonte, tem Entrar/Criar conta e, no rodapé, Privacidade, Termos
 * e contacto. Sem chamadas à API: todos os números são os dos dados recebidos (Regra Zero). Narrativa de artigo e
 * produto: tese → problema com fontes → método → prova → produto → rigor → equipa e referências.
 */
export function LandingPage() {
  useRevealOnScroll();
  return (
    <PublicShell width="max-w-6xl" header={<LandingHeader />} footerExtra={<PhotoCredits />}>
      <LandingToc />
      <main id="content" data-landing="" data-lp-fonts="" tabIndex={-1} className="outline-none">
        <Hero />
        <PhotoBand />
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
        <PhotoBand flip />
      </main>
    </PublicShell>
  );
}
