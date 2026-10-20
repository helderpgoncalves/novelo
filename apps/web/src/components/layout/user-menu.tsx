import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Download, Eye, LogOut, Route as RouteIcon, UserRound } from 'lucide-react';
import { useState } from 'react';
import type { MeOut } from '@/client';
import { logoutMutation } from '@/client/@tanstack/react-query.gen';
import { InstallIosDialog } from '@/components/install-ios-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEndImpersonation } from '@/features/impersonation/impersonation-banner';
import { useImpersonation } from '@/features/impersonation/use-impersonation';
import { stepsFor } from '@/features/onboarding/steps';
import { canResumeTour, openTour, readTourProgress } from '@/features/onboarding/tour-store';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { queryClient } from '@/lib/query-client';
import { m } from '@/paraglide/messages';

const TOUR_OPEN_DELAY_MS = 180;

const initials = (user: MeOut) =>
  (user.name ?? user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export function UserMenu({ user }: { user: MeOut }) {
  const navigate = useNavigate();
  const { canInstall, needsIosSteps, install } = useInstallPrompt();
  const [iosHelp, setIosHelp] = useState(false);
  const imp = useImpersonation();
  const { end: endImpersonation } = useEndImpersonation();
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
            data-tour="user-menu"
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
            {user.role === 'guest' && (
              <span
                title={m.guest_account_hint()}
                className="hidden rounded-full bg-muted px-2 py-0.5 font-semibold text-[10px] text-muted-foreground uppercase tracking-wide sm:inline"
              >
                {m.guest_badge()}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="space-y-0.5">
            <p className="truncate font-medium text-sm">
              {user.name ?? m.user_menu_default_name()}
            </p>
            <p className="truncate font-normal text-muted-foreground text-xs">{user.email}</p>
            {imp.active && (
              <>
                <Badge className="mt-1 gap-1 bg-areia text-[#14211d] text-[10px] uppercase hover:bg-areia">
                  <Eye aria-hidden="true" />
                  {m.imp_menu_title()}
                </Badge>
                <p className="whitespace-normal pt-1 font-normal text-muted-foreground text-xs leading-relaxed">
                  {m.imp_menu_note({ admin: imp.adminName ?? '' })}
                </p>
              </>
            )}
            {user.role === 'guest' && (
              <>
                <Badge variant="secondary" className="mt-1 text-[10px] uppercase">
                  {m.guest_badge()}
                </Badge>
                <p className="whitespace-normal pt-1 font-normal text-muted-foreground text-xs leading-relaxed">
                  {m.guest_account_hint()}
                </p>
              </>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate({ to: '/account' })}>
            <UserRound /> {m.user_menu_account()}
          </DropdownMenuItem>
          {/* Pequeno atraso: o menu devolve o foco ao botão ao fechar; só depois a introdução o toma. */}
          {canResumeTour(user.id, stepsFor(user.role).length) && (
            <DropdownMenuItem
              onSelect={() =>
                window.setTimeout(() => openTour(readTourProgress(user.id)), TOUR_OPEN_DELAY_MS)
              }
            >
              <RouteIcon /> {m.user_menu_tour_resume()}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => window.setTimeout(() => openTour(0), TOUR_OPEN_DELAY_MS)}
          >
            <RouteIcon /> {m.user_menu_tour()}
          </DropdownMenuItem>
          {(canInstall || needsIosSteps) && (
            <DropdownMenuItem onSelect={canInstall ? () => void install() : () => setIosHelp(true)}>
              <Download /> {m.user_menu_install()}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {imp.active ? (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void endImpersonation('stopped')}
            >
              <LogOut /> {m.imp_exit()}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onSelect={() => logout.mutate({})}>
              <LogOut /> {m.user_menu_logout()}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <InstallIosDialog open={iosHelp} onOpenChange={setIosHelp} />
    </>
  );
}
