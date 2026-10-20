import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Download, Eye, LogOut, Route as RouteIcon, Star, UserRound } from 'lucide-react';
import { useState } from 'react';
import type { MeOut } from '@/client';
import { logoutMutation } from '@/client/@tanstack/react-query.gen';
import { GithubMark } from '@/components/github-mark';
import { InstallIosDialog } from '@/components/install-ios-dialog';
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
import { UserAvatar } from '@/components/user-chip';
import { useEndImpersonation } from '@/features/impersonation/impersonation-banner';
import { useImpersonation } from '@/features/impersonation/use-impersonation';
import { stepsFor } from '@/features/onboarding/steps';
import { canResumeTour, openTour, readTourProgress } from '@/features/onboarding/tour-store';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { REPO_URL } from '@/lib/links';
import { displayName } from '@/lib/person';
import { queryClient } from '@/lib/query-client';
import { m } from '@/paraglide/messages';

const TOUR_OPEN_DELAY_MS = 180;

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
            <UserAvatar person={user} className="size-9" decorative />
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
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar person={user} size="md" decorative />
              <div className="min-w-0">
                <p className="truncate font-medium text-sm" title={displayName(user)}>
                  {displayName(user) || m.user_menu_default_name()}
                </p>
                <p
                  className="truncate font-normal text-muted-foreground text-xs"
                  title={user.email}
                >
                  {user.email}
                </p>
              </div>
            </div>
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
          <DropdownMenuItem asChild>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={m.user_menu_source_aria()}
            >
              <GithubMark /> {m.user_menu_source()}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={m.user_menu_star_aria()}
            >
              <Star /> {m.user_menu_star()}
            </a>
          </DropdownMenuItem>
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
