import { PublicShell } from '@/components/public-shell';
import { Audience, Faq, FinalCta } from './closing';
import { Hero, Proof } from './hero';
import { LandingActions, LandingMenu, LandingNav } from './landing-nav';
import { Copilot, DataSources, Impact } from './product';
import { useRevealOnScroll } from './reveal';
import { Features, HowItWorks, Problem } from './story';

/**
 * Página inicial pública (sem sessão): é a "Application home page" do ecrã de consentimento da Google, por isso
 * diz o que o Novelo faz, mostra números reais com fonte, tem Entrar/Criar conta e, no rodapé, Privacidade, Termos
 * e contacto. Sem chamadas à API: todos os números são os dos dados recebidos (Regra Zero).
 */
export function LandingPage() {
  useRevealOnScroll();
  return (
    <PublicShell
      width="max-w-6xl"
      nav={<LandingNav />}
      actions={<LandingActions />}
      menu={<LandingMenu />}
    >
      <main id="content" data-landing="" tabIndex={-1} className="outline-none">
        <Hero />
        <Proof />
        <Problem />
        <HowItWorks />
        <Features />
        <Copilot />
        <DataSources />
        <Impact />
        <Audience />
        <Faq />
        <FinalCta />
      </main>
    </PublicShell>
  );
}
