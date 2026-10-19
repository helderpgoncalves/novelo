import {
  BarChart3,
  Bot,
  Boxes,
  FileText,
  FlaskConical,
  GitCompareArrows,
  Layers,
  type LucideIcon,
  MapPinned,
  Radar,
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
    | '/coverage'
    | '/triage'
    | '/lots'
    | '/market'
    | '/brands'
    | '/reports'
    | '/simulator'
    | '/scenarios'
    | '/pilot'
    | '/assumptions'
    | '/users'
    | '/admin/ai';
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
      { label: () => m.nav_coverage(), to: '/coverage', icon: Radar },
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
      { label: () => m.nav_pilot(), to: '/pilot', icon: FlaskConical },
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
    items: [
      { label: () => m.nav_users(), to: '/users', icon: Users, adminOnly: true },
      { label: () => m.nav_ai_admin(), to: '/admin/ai', icon: Bot, adminOnly: true },
    ],
  },
];
