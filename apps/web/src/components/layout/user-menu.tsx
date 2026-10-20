import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Download, LogOut, UserRound } from 'lucide-react';
import { useState } from 'react';
import type { UserOut } from '@/client';
import { logoutMutation } from '@/client/@tanstack/react-query.gen';
import { InstallIosDialog } from '@/components/install-ios-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { queryClient } from '@/lib/query-client';
import { m } from '@/paraglide/messages';

const initials = (user: UserOut) =>
  (user.name ?? user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export function UserMenu({ user }: { user: UserOut }) {
  const navigate = useNavigate();
  const { canInstall, needsIosSteps, install } = useInstallPrompt();
  const [iosHelp, setIosHelp] = useState(false);
  const logout = useMutation({
    ...logoutMutation(),
    onSettled: async () => {
      queryClient.clear();
      await navigate({ to: '/login' });
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-10 gap-2 px-1.5"
            aria-label={m.common_account_menu()}
          >
            <Avatar className="size-7">
              {user.avatar_url && (
                <AvatarImage src={user.avatar_url} alt="" referrerPolicy="no-referrer" />
              )}
              <AvatarFallback className="bg-primary/10 font-semibold text-[11px] text-primary">
                {initials(user)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="space-y-0.5">
            <p className="truncate font-medium text-sm">
              {user.name ?? m.user_menu_default_name()}
            </p>
            <p className="truncate font-normal text-muted-foreground text-xs">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate({ to: '/account' })}>
            <UserRound /> {m.user_menu_account()}
          </DropdownMenuItem>
          {(canInstall || needsIosSteps) && (
            <DropdownMenuItem onSelect={canInstall ? () => void install() : () => setIosHelp(true)}>
              <Download /> {m.user_menu_install()}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => logout.mutate({})}>
            <LogOut /> {m.user_menu_logout()}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <InstallIosDialog open={iosHelp} onOpenChange={setIosHelp} />
    </>
  );
}
