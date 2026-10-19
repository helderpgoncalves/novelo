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
  ShieldCheck,
  Store,
  Truck,
  Users,
  Waypoints,
} from 'lucide-react';
import { m } from '@/paraglide/messages';

export interface NavItem {
  label: () => string;
  to?: '/' | '/circuits' | '/fleet' | '/localities' | '/data-quality' | '/users';
  icon: LucideIcon;
  /** No backlog, ainda sem ecrã. */
  soon?: boolean;
  adminOnly?: boolean;
}

export interface NavSection {
  title: () => string;
  items: NavItem[];
}

// A mesma fonte alimenta a sidebar desktop e o menu móvel.
export const NAV: NavSection[] = [
  {
    title: () => m.nav_section_overview(),
    items: [
      { label: () => m.nav_baseline(), to: '/', icon: BarChart3 },
      { label: () => m.nav_circuits(), to: '/circuits', icon: RouteIcon },
      { label: () => m.nav_fleet(), to: '/fleet', icon: Truck },
      { label: () => m.nav_localities(), to: '/localities', icon: Waypoints },
      { label: () => m.nav_data_quality(), to: '/data-quality', icon: ShieldCheck },
      { label: () => m.nav_map(), icon: MapPinned, soon: true },
    ],
  },
  {
    title: () => m.nav_section_planning(),
    items: [
      { label: () => m.nav_simulator(), icon: Layers, soon: true },
      { label: () => m.nav_scenarios(), icon: GitCompareArrows, soon: true },
      { label: () => m.nav_whatif(), icon: MessageSquareQuote, soon: true },
    ],
  },
  {
    title: () => m.nav_section_operations(),
    items: [
      { label: () => m.nav_triage(), icon: ScanLine, soon: true },
      { label: () => m.nav_lots(), icon: Boxes, soon: true },
      { label: () => m.nav_market(), icon: Store, soon: true },
      { label: () => m.nav_rap(), icon: FileText, soon: true },
    ],
  },
  {
    title: () => m.nav_section_admin(),
    items: [{ label: () => m.nav_users(), to: '/users', icon: Users, adminOnly: true }],
  },
];
