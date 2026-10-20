import { PhotoBand } from '@/components/photos';
import { PublicShell } from '@/components/public-shell';
import './landing-assets.generated.css';
import { Audience, Faq, FinalCta } from './closing';
import { Copilot } from './copilot';
import { Features } from './features';
import { LandingFooter } from './footer';
import { Hero } from './hero';
import { Evidence } from './lab';
import { LandingHeader, LandingToc } from './landing-nav';
import { useRevealOnScroll } from './reveal';
import { References, Rigor, Team } from './rigor';
import { Method, Problem } from './story';

/**
 * Página inicial pública (sem sessão): é a "Application home page" do ecrã de consentimento da Google, por isso
 * diz o que o Novelo faz, mostra números reais com fonte, tem Entrar/Criar conta e, no rodapé, Privacidade, Termos
 * e contacto. Sem chamadas à API: todos os números são os dos dados recebidos (Regra Zero). Cada secção tem a sua
 * composição (bento, pipeline, instrumento, bento de produto, lista editorial, janela, livro-razão, linha do tempo):
 * problema → método → prova → produto → para quem → Copiloto → rigor → equipa → referências → perguntas → convite.
 */
export function LandingPage() {
  useRevealOnScroll();
  return (
    <PublicShell width="max-w-6xl" header={<LandingHeader />} footer={<LandingFooter />}>
      <LandingToc />
      <main id="content" data-landing="" data-lp-fonts="" tabIndex={-1} className="outline-none">
        <Hero />
        <Problem />
        <Method />
        <Evidence />
        <Features />
        <Audience />
        <Copilot />
        <Rigor />
        <PhotoBand />
        <Team />
        <References />
        <Faq />
        <FinalCta />
        <PhotoBand flip />
      </main>
    </PublicShell>
  );
}
