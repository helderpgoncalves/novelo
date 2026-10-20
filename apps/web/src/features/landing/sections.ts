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

/** Índice completo (menu móvel e «Nesta página»), pela ordem da página, com o número editorial de cada secção. */
export function tocItems(): { id: string; n: string; label: string }[] {
  return [
    { id: 'problema', n: '01', label: m.landing_problem_eyebrow() },
    { id: 'metodo', n: '02', label: m.landing_nav_method() },
    { id: 'prova', n: '03', label: m.landing_nav_proof() },
    { id: 'produto', n: '04', label: m.landing_nav_product() },
    { id: 'copiloto', n: '06', label: m.landing_nav_copilot() },
    { id: 'rigor', n: '07', label: m.landing_nav_rigor() },
    { id: 'equipa', n: '08', label: m.landing_nav_team() },
    { id: 'perguntas', n: '09', label: m.landing_nav_faq() },
  ];
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
  'para-quem': 'produto',
  referencias: 'equipa',
};
