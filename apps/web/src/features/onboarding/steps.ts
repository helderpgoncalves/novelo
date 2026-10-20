import {
  Database,
  FileText,
  GitCompareArrows,
  Hand,
  Layers,
  LifeBuoy,
  type LucideIcon,
  MapPinned,
  MessagesSquare,
  Sparkles,
  Users,
} from 'lucide-react';
import { m } from '@/paraglide/messages';

export type TourStepId =
  | 'welcome'
  | 'simulator'
  | 'scenarios'
  | 'copilot'
  | 'map'
  | 'data'
  | 'report'
  | 'users'
  | 'help'
  | 'finish';

export interface TourStep {
  id: TourStepId;
  kind: 'welcome' | 'spot' | 'finish';
  icon: LucideIcon;
  /** Seletores CSS por ordem de preferência; o primeiro visível ganha. Sem nenhum visível, o passo fica centrado. */
  targets: readonly string[];
  /** Quando o alvo só existe no menu «Mais» do telemóvel. */
  moreHint?: boolean;
  title: () => string;
  text: (ctx: { shortcut: string }) => string;
}

/** Ligações da navegação (barra lateral em desktop, barra de separadores em telemóvel). */
const nav = (to: string) => [
  `aside a[data-tour="nav:${to}"]`,
  `[data-testid="tab-bar"] a[data-tour="nav:${to}"]`,
  // sem barra lateral nem separadores visíveis (ex.: telemóvel): o botão «Mais» abre a gaveta completa
];
const MORE = '[data-testid="tab-bar"] button[aria-haspopup="dialog"]';

const STEPS: Record<TourStepId, TourStep> = {
  welcome: {
    id: 'welcome',
    kind: 'welcome',
    icon: Hand,
    targets: [],
    title: () => m.tour_welcome_title(),
    text: () => m.tour_welcome_text(),
  },
  simulator: {
    id: 'simulator',
    kind: 'spot',
    icon: Layers,
    targets: nav('/simulator'),
    title: () => m.tour_sim_title(),
    text: () => m.tour_sim_text(),
  },
  scenarios: {
    id: 'scenarios',
    kind: 'spot',
    icon: GitCompareArrows,
    targets: [...nav('/scenarios'), MORE],
    moreHint: true,
    title: () => m.tour_scenarios_title(),
    text: () => m.tour_scenarios_text(),
  },
  copilot: {
    id: 'copilot',
    kind: 'spot',
    icon: MessagesSquare,
    targets: ['[data-tour="copilot"]'],
    title: () => m.tour_copilot_title(),
    text: ({ shortcut }) => m.tour_copilot_text({ shortcut }),
  },
  map: {
    id: 'map',
    kind: 'spot',
    icon: MapPinned,
    targets: nav('/map'),
    title: () => m.tour_map_title(),
    text: () => m.tour_map_text(),
  },
  data: {
    id: 'data',
    kind: 'spot',
    icon: Database,
    targets: [...nav('/assumptions'), ...nav('/data-quality'), MORE],
    moreHint: true,
    title: () => m.tour_data_title(),
    text: () => m.tour_data_text(),
  },
  report: {
    id: 'report',
    kind: 'spot',
    icon: FileText,
    targets: [...nav('/reports'), MORE],
    moreHint: true,
    title: () => m.tour_report_title(),
    text: () => m.tour_report_text(),
  },
  users: {
    id: 'users',
    kind: 'spot',
    icon: Users,
    targets: [...nav('/users'), MORE],
    moreHint: true,
    title: () => m.tour_users_title(),
    text: () => m.tour_users_text(),
  },
  help: {
    id: 'help',
    kind: 'spot',
    icon: LifeBuoy,
    targets: ['[data-tour="user-menu"]'],
    title: () => m.tour_help_title(),
    text: () => m.tour_help_text(),
  },
  finish: {
    id: 'finish',
    kind: 'finish',
    icon: Sparkles,
    targets: [],
    title: () => m.tour_finish_title(),
    text: () => m.tour_finish_text(),
  },
};

/** O convidado (QR, pouco tempo) tem uma visita curta; operador e administrador, a completa (o administrador vê ainda as pessoas). */
const BY_ROLE: Record<'guest' | 'operator' | 'admin', readonly TourStepId[]> = {
  guest: ['welcome', 'simulator', 'copilot', 'map', 'finish'],
  operator: [
    'welcome',
    'simulator',
    'scenarios',
    'copilot',
    'map',
    'data',
    'report',
    'help',
    'finish',
  ],
  admin: [
    'welcome',
    'simulator',
    'scenarios',
    'copilot',
    'map',
    'data',
    'report',
    'users',
    'help',
    'finish',
  ],
};

/** Os seletores de todos os passos (para os testes). */
export const allSteps = (): TourStep[] => Object.values(STEPS);

export const stepIdsFor = (role: string): readonly TourStepId[] =>
  role === 'guest' ? BY_ROLE.guest : role === 'admin' ? BY_ROLE.admin : BY_ROLE.operator;

export const stepsFor = (role: string): TourStep[] => stepIdsFor(role).map((id) => STEPS[id]);

/** Mantém o índice dentro dos passos do papel (o papel pode mudar entre sessões). */
export const clampStep = (index: number, total: number): number =>
  Math.min(Math.max(Number.isFinite(index) ? Math.trunc(index) : 0, 0), Math.max(total - 1, 0));

/** Primeiros passos do checklist, por ordem. */
export const CHECKLIST_ITEMS = ['scenario', 'copilot', 'map'] as const;
export type ChecklistId = (typeof CHECKLIST_ITEMS)[number];
