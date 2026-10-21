import { Link } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import type { MeOut } from '@/client';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { CopilotLauncher } from '@/features/copilot/copilot-launcher';
import { m } from '@/paraglide/messages';
import { UserMenu } from './user-menu';

/**
 * Topo da app. Em telemóvel leva a marca (e o menu só quando não há barra de separadores, ex.: /chat);
 * o preenchimento superior respeita o entalhe e a barra de estado da app instalada.
 */
export function Topbar({
  user,
  showMenuButton,
  onMenuClick,
}: {
  user: MeOut;
  showMenuButton: boolean;
  onMenuClick: () => void;
}) {
  return (
    <header
      data-testid="topbar"
      className="select-none flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-2 border-border/60 border-b bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6 lg:h-[calc(4rem+env(safe-area-inset-top))] lg:px-8"
    >
      <div className="flex min-w-0 items-center gap-1 lg:hidden">
        {showMenuButton && (
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 size-10"
            onClick={onMenuClick}
            aria-label={m.common_open_navigation()}
          >
            <Menu className="size-5" />
          </Button>
        )}
        <Link to="/" aria-label={m.nav_home_aria()} className="flex items-center rounded-md">
          <BrandLogo className="h-5 min-[360px]:h-6" />
        </Link>
      </div>
      <div className="hidden lg:block" />
      <div className="flex shrink-0 items-center gap-1">
        <CopilotLauncher />
        <LanguageSwitcher signedIn />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
