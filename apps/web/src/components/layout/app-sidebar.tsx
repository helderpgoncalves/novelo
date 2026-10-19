import { Link } from '@tanstack/react-router';
import { BrandLogo } from '@/components/brand-logo';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { NAV } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

function NavList({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const sections = NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || role === 'admin'),
  })).filter((section) => section.items.length > 0);
  return (
    <nav aria-label={m.nav_main_aria()} className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.title()}>
          <p className="mb-1.5 px-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
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
                    activeOptions={{ exact: item.to === '/' }}
                    className={cn(
                      'flex h-9 items-center gap-2.5 rounded-lg px-2 text-muted-foreground text-sm transition-colors',
                      'hover:bg-sidebar-accent hover:text-foreground',
                    )}
                    activeProps={{
                      className:
                        'bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary',
                    }}
                  >
                    <Icon className="size-4" />
                    {item.label()}
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
          <BrandLogo />
        </Link>
      </div>
      <NavList role={role} onNavigate={onNavigate} />
      <div className="border-sidebar-border border-t p-4">
        <p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
          {m.sidebar_event()}
        </p>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
          {m.sidebar_challenge()}
        </p>
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
      <aside className="hidden w-64 shrink-0 border-sidebar-border border-r bg-sidebar lg:block">
        <SidebarBody role={role} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">{m.nav_sheet_title()}</SheetTitle>
          <SheetDescription className="sr-only">{m.nav_sheet_description()}</SheetDescription>
          <SidebarBody role={role} onNavigate={() => onMobileOpenChange(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
