import { Link } from '@tanstack/react-router';
import { BrandLogo } from '@/components/brand-logo';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { usePendingApprovals } from '@/features/users/use-pending-approvals';
import { NAV } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

function PendingBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <>
      <span
        aria-hidden="true"
        data-testid="pending-badge"
        className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-areia px-1.5 font-semibold text-[#14211d] text-[11px] tabular-nums"
      >
        {count > 99 ? '99+' : count}
      </span>
      <span className="sr-only">{m.nav_pending_aria({ count })}</span>
    </>
  );
}

function NavList({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const pending = usePendingApprovals();
  const sections = NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || role === 'admin'),
  })).filter((section) => section.items.length > 0);
  return (
    <nav
      aria-label={m.nav_main_aria()}
      className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4"
    >
      {sections.map((section) => (
        <div key={section.title()}>
          <p className="mb-1 px-2.5 font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
            {section.title()}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              if (!item.to) {
                return (
                  <li key={item.label()}>
                    <span
                      aria-disabled="true"
                      className="flex h-9 cursor-not-allowed items-center gap-2.5 rounded-lg px-2 text-muted-foreground/70 text-sm"
                    >
                      <Icon className="size-4" />
                      <span className="flex-1 truncate">{item.label()}</span>
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-areia"
                        title={m.nav_soon()}
                        role="img"
                        aria-label={m.nav_soon()}
                      />
                    </span>
                  </li>
                );
              }
              return (
                <li key={item.label()}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    data-tour={`nav:${item.to}`}
                    activeOptions={{ exact: item.to === '/' }}
                    className={cn(
                      'flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-muted-foreground text-sm transition-colors lg:h-9',
                      'hover:bg-sidebar-accent hover:text-foreground',
                    )}
                    activeProps={{
                      className:
                        'bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary',
                    }}
                  >
                    <Icon className="size-4" />
                    {item.label()}
                    {item.badge === 'pending-approvals' && <PendingBadge count={pending} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-sidebar-border border-b px-5">
        <Link to="/" onClick={onNavigate} aria-label={m.nav_home_aria()}>
          <BrandLogo className="h-6" />
        </Link>
      </div>
      <NavList role={role} onNavigate={onNavigate} />
      <div className="border-sidebar-border border-t px-5 py-4">
        <p className="font-semibold text-[10px] text-primary uppercase tracking-[0.18em]">
          {m.sidebar_event()}
        </p>
        <p className="mt-1 font-serif text-[15px] text-foreground leading-tight">
          {m.sidebar_challenge()}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{m.sidebar_data()}</p>
      </div>
    </div>
  );
}

export function AppSidebar({
  role,
  mobileOpen,
  onMobileOpenChange,
}: {
  role: string;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 select-none border-sidebar-border border-r bg-sidebar pt-[env(safe-area-inset-top)] lg:block">
        <SidebarBody role={role} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-[18rem] max-w-[85vw] select-none gap-0 bg-sidebar p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetTitle className="sr-only">{m.nav_sheet_title()}</SheetTitle>
          <SheetDescription className="sr-only">{m.nav_sheet_description()}</SheetDescription>
          <SidebarBody role={role} onNavigate={() => onMobileOpenChange(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
