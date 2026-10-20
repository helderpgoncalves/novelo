import { Link, useRouterState } from '@tanstack/react-router';
import {
  House,
  Layers,
  LayoutGrid,
  type LucideIcon,
  MapPinned,
  MessagesSquare,
} from 'lucide-react';
import { usePendingApprovals } from '@/features/users/use-pending-approvals';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

interface Tab {
  to: '/' | '/map' | '/simulator' | '/chat';
  label: () => string;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { to: '/', label: () => m.tab_home(), icon: House },
  { to: '/map', label: () => m.tab_map(), icon: MapPinned },
  { to: '/simulator', label: () => m.tab_simulate(), icon: Layers },
  { to: '/chat', label: () => m.nav_chat(), icon: MessagesSquare },
];

/** Altura útil da barra, sem a zona da barra inicial (que entra como preenchimento). */
export const TAB_BAR_HEIGHT = '3.5rem';

const itemClass =
  'flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 font-medium text-[11px] leading-none text-muted-foreground transition-colors active:bg-accent';

const isActive = (pathname: string, to: Tab['to']) =>
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);

/**
 * Navegação de app em telemóvel: os 4 destinos mais usados + "Mais", que abre a gaveta completa.
 * Vive no fluxo (não fixa), por isso nunca tapa conteúdo; a zona da barra inicial é o seu preenchimento.
 */
export function TabBar({ onMore }: { onMore: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inTabs = TABS.some((t) => isActive(pathname, t.to));
  const pending = usePendingApprovals();

  return (
    <nav
      aria-label={m.nav_tabbar_aria()}
      data-testid="tab-bar"
      className="select-none shrink-0 border-border/60 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="flex items-stretch gap-1 px-2 py-1" style={{ height: TAB_BAR_HEIGHT }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(pathname, tab.to);
          return (
            <li key={tab.to} className="flex min-w-0 flex-1">
              <Link
                to={tab.to}
                className={cn(itemClass, active && 'bg-primary/10 text-primary')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="size-5" aria-hidden="true" strokeWidth={active ? 2.25 : 1.75} />
                <span className="max-w-full truncate">{tab.label()}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex min-w-0 flex-1">
          <button
            type="button"
            onClick={onMore}
            aria-label={
              pending > 0
                ? `${m.nav_more_aria()}. ${m.nav_pending_aria({ count: pending })}`
                : m.nav_more_aria()
            }
            aria-haspopup="dialog"
            className={cn(itemClass, !inTabs && 'bg-primary/10 text-primary')}
          >
            <span className="relative">
              <LayoutGrid
                className="size-5"
                aria-hidden="true"
                strokeWidth={!inTabs ? 2.25 : 1.75}
              />
              {pending > 0 && (
                <span
                  aria-hidden="true"
                  data-testid="pending-badge-more"
                  className="-top-1.5 -right-2.5 absolute grid h-4 min-w-4 place-items-center rounded-full bg-areia px-1 font-semibold text-[#14211d] text-[10px] tabular-nums"
                >
                  {pending > 99 ? '99+' : pending}
                </span>
              )}
            </span>
            <span>{m.nav_more()}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
