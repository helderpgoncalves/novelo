import {
  BarChart3,
  Boxes,
  FileText,
  GitCompareArrows,
  Layers,
  type LucideIcon,
  MapPinned,
  Route as RouteIcon,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Tags,
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
    | '/triage'
    | '/lots'
    | '/market'
    | '/brands'
    | '/reports'
    | '/simulator'
    | '/scenarios'
    | '/assumptions'
    | '/users';
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
      { label: () => m.nav_map(), to: '/map', icon: MapPinned },
    ],
  },
  {
    title: () => m.nav_section_data(),
    items: [
      { label: () => m.nav_circuits(), to: '/circuits', icon: RouteIcon },
      { label: () => m.nav_fleet(), to: '/fleet', icon: Truck },
      { label: () => m.nav_localities(), to: '/localities', icon: Waypoints },
      { label: () => m.nav_data_quality(), to: '/data-quality', icon: ShieldCheck },
    ],
  },
  {
    title: () => m.nav_section_planning(),
    items: [
      { label: () => m.nav_simulator(), to: '/simulator', icon: Layers },
      { label: () => m.nav_scenarios(), to: '/scenarios', icon: GitCompareArrows },
      { label: () => m.nav_assumptions(), to: '/assumptions', icon: SlidersHorizontal },
    ],
  },
  {
    title: () => m.nav_section_operations(),
    items: [
      { label: () => m.nav_triage(), to: '/triage', icon: ScanLine },
      { label: () => m.nav_lots(), to: '/lots', icon: Boxes },
      { label: () => m.nav_market(), to: '/market', icon: Store },
      { label: () => m.nav_brands(), to: '/brands', icon: Tags },
    ],
  },
  {
    title: () => m.nav_section_reporting(),
    items: [{ label: () => m.nav_rap(), to: '/reports', icon: FileText }],
  },
  {
    title: () => m.nav_section_admin(),
    items: [{ label: () => m.nav_users(), to: '/users', icon: Users, adminOnly: true }],
  },
];
