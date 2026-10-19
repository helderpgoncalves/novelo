import { Menu } from 'lucide-react';
import type { UserOut } from '@/client';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { CopilotLauncher } from '@/features/copilot/copilot-launcher';
import { m } from '@/paraglide/messages';
import { UserMenu } from './user-menu';

export function Topbar({ user, onMenuClick }: { user: UserOut; onMenuClick: () => void }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-border/60 border-b bg-background/80 px-4 backdrop-blur sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="size-9 lg:hidden"
        onClick={onMenuClick}
        aria-label={m.common_open_navigation()}
      >
        <Menu className="size-5" />
      </Button>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-1">
        <CopilotLauncher />
        <LanguageSwitcher signedIn />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
