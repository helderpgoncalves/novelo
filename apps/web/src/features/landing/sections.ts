import { m } from '@/paraglide/messages';

/** Ligações do topo (ecrã largo). `xl`: só a partir de 1280 px, para a barra respirar a 1024 px. */
export function navItems(): { id: string; label: string; xl?: boolean }[] {
  return [
    { id: 'metodo', label: m.landing_nav_method() },
    { id: 'prova', label: m.landing_nav_proof() },
    { id: 'produto', label: m.landing_nav_product() },
    { id: 'funcionalidades', label: m.landing_nav_features(), xl: true },
    { id: 'rigor', label: m.landing_nav_rigor() },
    { id: 'perguntas', label: m.landing_nav_faq(), xl: true },
  ];
}

/** Índice completo (menu móvel e «Nesta página»), pela ordem da página. */
export function tocItems(): { id: string; label: string }[] {
  return [
    { id: 'problema', label: m.landing_problem_eyebrow() },
    { id: 'metodo', label: m.landing_nav_method() },
    { id: 'prova', label: m.landing_nav_proof() },
    { id: 'produto', label: m.landing_nav_product() },
    { id: 'funcionalidades', label: m.landing_nav_features() },
    { id: 'copiloto', label: m.landing_nav_copilot() },
    { id: 'rigor', label: m.landing_nav_rigor() },
    { id: 'equipa', label: m.landing_nav_team() },
    { id: 'perguntas', label: m.landing_nav_faq() },
  ];
}

/** Cada secção observada e o item do topo a que pertence (a pílula fica no grupo). */
export const SECTION_GROUP: Record<string, string> = {
  numeros: 'problema',
  problema: 'problema',
  impacto: 'problema',
  metodo: 'metodo',
  prova: 'prova',
  produto: 'produto',
  funcionalidades: 'funcionalidades',
  copiloto: 'produto',
  rigor: 'rigor',
  dados: 'rigor',
  'para-quem': 'equipa',
  equipa: 'equipa',
  referencias: 'equipa',
  perguntas: 'perguntas',
};

/** Secções sem entrada própria no índice «Nesta página» e o item que as representa. */
export const TOC_ALIAS: Record<string, string> = {
  numeros: 'problema',
  impacto: 'problema',
  dados: 'rigor',
  'para-quem': 'equipa',
  referencias: 'equipa',
};
