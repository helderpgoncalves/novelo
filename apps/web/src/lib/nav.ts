import {
  BarChart3,
  Boxes,
  FileText,
  GitCompareArrows,
  Layers,
  type LucideIcon,
  MapPinned,
  MessageSquareQuote,
  Route as RouteIcon,
  ScanLine,
  Store,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to?: '/' | '/circuitos';
  icon: LucideIcon;
  soon?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

// A mesma fonte alimenta a sidebar e a navegação móvel. `soon` = no backlog, ainda sem ecrã.
export const NAV: NavSection[] = [
  {
    title: 'Visão geral',
    items: [
      { label: 'Ponto de partida', to: '/', icon: BarChart3 },
      { label: 'Circuitos atuais', to: '/circuitos', icon: RouteIcon },
      { label: 'Mapa da rede', icon: MapPinned, soon: true },
    ],
  },
  {
    title: 'Planeamento',
    items: [
      { label: 'Simulador da rede', icon: Layers, soon: true },
      { label: 'Comparar cenários', icon: GitCompareArrows, soon: true },
      { label: 'E se...?', icon: MessageSquareQuote, soon: true },
    ],
  },
  {
    title: 'Operação',
    items: [
      { label: 'Triagem', icon: ScanLine, soon: true },
      { label: 'Lotes e passaporte', icon: Boxes, soon: true },
      { label: 'Bolsa de fibra', icon: Store, soon: true },
      { label: 'Relatório RAP', icon: FileText, soon: true },
    ],
  },
];
