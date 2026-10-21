import {
  BadgeCheck,
  Bot,
  ClipboardCheck,
  Compass,
  FileText,
  FlaskConical,
  GitCompareArrows,
  type LucideIcon,
  MapPinned,
  MessagesSquare,
  Network,
  QrCode,
  Route as RouteIcon,
  ScanLine,
  Sigma,
  SlidersHorizontal,
  Truck,
  Users,
  Waypoints,
} from 'lucide-react';
import { m } from '@/paraglide/messages';

export interface NavItem {
  label: () => string;
  to?:
    | '/'
    | '/circuits'
    | '/fleet'
    | '/localities'
    | '/data-quality'
    | '/map'
    | '/municipal'
    | '/chat'
    | '/triage'
    | '/lots'
    | '/reports'
    | '/simulator'
    | '/scenarios'
    | '/pilot'
    | '/validation'
    | '/assumptions'
    | '/users'
    | '/admin/ai';
  icon: LucideIcon;
  /** No backlog, ainda sem ecrã. */
  soon?: boolean;
  adminOnly?: boolean;
  /** Contador à direita do rótulo (pedidos de acesso por aprovar). */
  badge?: 'pending-approvals';
}

export interface NavSection {
  title: () => string;
  items: NavItem[];
}

// A mesma fonte alimenta a sidebar desktop e o menu móvel. A ordem conta a história: o problema e onde está (Decidir),
// porque se acredita nos números (Provar), de onde vêm (Dados da Vitrus), como se opera no piloto e como se presta contas.
export const NAV: NavSection[] = [
  {
    title: () => m.nav_section_decide(),
    items: [
      { label: () => m.nav_baseline(), to: '/', icon: Compass },
      { label: () => m.nav_short_map(), to: '/map', icon: MapPinned },
      { label: () => m.nav_short_simulator(), to: '/simulator', icon: SlidersHorizontal },
      { label: () => m.nav_short_scenarios(), to: '/scenarios', icon: GitCompareArrows },
      { label: () => m.nav_pilot(), to: '/pilot', icon: FlaskConical },
      { label: () => m.nav_chat(), to: '/chat', icon: MessagesSquare },
    ],
  },
  {
    title: () => m.nav_section_prove(),
    items: [
      { label: () => m.nav_validation(), to: '/validation', icon: BadgeCheck },
      { label: () => m.nav_assumptions(), to: '/assumptions', icon: Sigma },
      { label: () => m.nav_data_quality(), to: '/data-quality', icon: ClipboardCheck },
    ],
  },
  {
    title: () => m.nav_section_data(),
    items: [
      { label: () => m.nav_short_circuits(), to: '/circuits', icon: RouteIcon },
      { label: () => m.nav_fleet(), to: '/fleet', icon: Truck },
      { label: () => m.nav_localities(), to: '/localities', icon: Waypoints },
      { label: () => m.nav_municipal(), to: '/municipal', icon: Network },
    ],
  },
  {
    title: () => m.nav_section_operations(),
    items: [
      { label: () => m.nav_triage(), to: '/triage', icon: ScanLine },
      { label: () => m.nav_lots(), to: '/lots', icon: QrCode },
    ],
  },
  {
    title: () => m.nav_section_reporting(),
    items: [{ label: () => m.nav_rap(), to: '/reports', icon: FileText }],
  },
  {
    title: () => m.nav_section_admin(),
    items: [
      {
        label: () => m.nav_users(),
        to: '/users',
        icon: Users,
        adminOnly: true,
        badge: 'pending-approvals',
      },
      { label: () => m.nav_ai_admin(), to: '/admin/ai', icon: Bot, adminOnly: true },
    ],
  },
];
