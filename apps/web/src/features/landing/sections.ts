import { m } from '@/paraglide/messages';

/** Ligações do topo (ecrã largo). `xl`: só a partir de 1280 px, para a barra respirar a 1024 px. */
export function navItems(): { id: string; label: string; xl?: boolean }[] {
  return [
    { id: 'metodo', label: m.landing_nav_method() },
    { id: 'prova', label: m.landing_nav_proof() },
    { id: 'produto', label: m.landing_nav_product() },
    { id: 'copiloto', label: m.landing_nav_copilot(), xl: true },
    { id: 'rigor', label: m.landing_nav_rigor() },
    { id: 'perguntas', label: m.landing_nav_faq(), xl: true },
  ];
}

/** Secções numeradas da página, pela ordem em que aparecem. A numeração sai daqui (índice do menu, «Nesta página» e cabeçalhos). */
const NUMBERED = [
  'problema',
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

/** Número editorial contínuo («01», «02»…) de uma secção, gerado a partir da lista real. */
export function sectionNumber(id: NumberedSection): string {
  return String(NUMBERED.indexOf(id) + 1).padStart(2, '0');
}

const TOC_LABEL: Record<NumberedSection, () => string> = {
  problema: () => m.landing_problem_eyebrow(),
  metodo: () => m.landing_nav_method(),
  prova: () => m.landing_nav_proof(),
  produto: () => m.landing_nav_product(),
  'para-quem': () => m.landing_nav_audience(),
  copiloto: () => m.landing_nav_copilot(),
  rigor: () => m.landing_nav_rigor(),
  equipa: () => m.landing_nav_team(),
  perguntas: () => m.landing_nav_faq(),
};

/** Índice completo (menu móvel e «Nesta página»), pela ordem da página, com o número editorial de cada secção. */
export function tocItems(): { id: NumberedSection; n: string; label: string }[] {
  return NUMBERED.map((id) => ({ id, n: sectionNumber(id), label: TOC_LABEL[id]() }));
}

/** Cada secção observada e o item do topo a que pertence (a pílula fica no grupo). */
export const SECTION_GROUP: Record<string, string> = {
  problema: 'problema',
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
