import { m } from '@/paraglide/messages';

/** Ligações do topo (ecrã largo). `xl`: só a partir de 1280 px, para a barra respirar a 1024 px. */
export function navItems(): { id: string; label: string; xl?: boolean }[] {
  return [
    { id: 'mapa', label: m.landing_nav_map() },
    { id: 'metodo', label: m.landing_nav_method() },
    { id: 'prova', label: m.landing_nav_proof() },
    { id: 'produto', label: m.landing_nav_product() },
    { id: 'copiloto', label: m.landing_nav_copilot(), xl: true },
    { id: 'rigor', label: m.landing_nav_rigor() },
    { id: 'perguntas', label: m.landing_nav_faq(), xl: true },
  ];
}

/** Secções da página, pela ordem em que aparecem. A numeração só serve a etiqueta mono dos cabeçalhos; a navegação não a mostra. */
const NUMBERED = [
  'problema',
  'mapa',
  'metodo',
  'prova',
  'produto',
  'para-quem',
  'copiloto',
  'rigor',
  'equipa',
  'perguntas',
] as const;

export type NumberedSection = (typeof NUMBERED)[number];

/** Número editorial («01», «02»…) de uma secção, só para a etiqueta do cabeçalho dela. */
export function sectionNumber(id: NumberedSection): string {
  return String(NUMBERED.indexOf(id) + 1).padStart(2, '0');
}

const TOC_LABEL: Record<NumberedSection, () => string> = {
  problema: () => m.landing_problem_eyebrow(),
  mapa: () => m.landing_nav_map(),
  metodo: () => m.landing_nav_method(),
  prova: () => m.landing_nav_proof(),
  produto: () => m.landing_nav_product(),
  'para-quem': () => m.landing_nav_audience(),
  copiloto: () => m.landing_nav_copilot(),
  rigor: () => m.landing_nav_rigor(),
  equipa: () => m.landing_nav_team(),
  perguntas: () => m.landing_nav_faq(),
};

/** Índice completo (menu móvel e «Nesta página»), pela ordem da página, sem numeração. */
export function tocItems(): { id: NumberedSection; label: string }[] {
  return NUMBERED.map((id) => ({ id, label: TOC_LABEL[id]() }));
}

/** Cada secção observada e o item do topo a que pertence (a pílula fica no grupo). */
export const SECTION_GROUP: Record<string, string> = {
  problema: 'problema',
  mapa: 'mapa',
  metodo: 'metodo',
  prova: 'prova',
  produto: 'produto',
  'para-quem': 'produto',
  copiloto: 'copiloto',
  rigor: 'rigor',
  equipa: 'equipa',
  referencias: 'equipa',
  perguntas: 'perguntas',
};

/** Secções sem entrada própria no índice «Nesta página» e o item que as representa. */
export const TOC_ALIAS: Record<string, string> = {
  referencias: 'equipa',
};
