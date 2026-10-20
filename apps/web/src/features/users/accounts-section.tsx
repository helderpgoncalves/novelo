import { ArrowLeft, UserCheck } from 'lucide-react';
import type { UserAdminOut } from '@/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';
import { PendingPanel } from './pending-panel';
import { UsersTable } from './users-table';

interface Props {
  users: UserAdminOut[];
  currentUserId: string;
  impersonating: boolean;
  refreshing?: boolean;
  /** Vista ativa (vive na URL): todas as contas ou só os pedidos por aprovar. */
  view: 'all' | 'pending';
  onViewChange: (view: 'all' | 'pending') => void;
}

/**
 * Contas com os pedidos por aprovar como vista, não como separador: quando há pedidos, uma faixa em
 * destaque leva à vista de aprovação (aprovar/rejeitar em massa) e de lá volta-se a todas as contas.
 */
export function AccountsSection({
  users,
  currentUserId,
  impersonating,
  refreshing,
  view,
  onViewChange,
}: Props) {
  const pending = users.filter((u) => u.approval_status === 'pending').length;

  if (view === 'pending') {
    return (
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-10 gap-1.5 text-muted-foreground sm:h-8"
          onClick={() => onViewChange('all')}
        >
          <ArrowLeft aria-hidden="true" />
          {m.users_view_all()}
        </Button>
        <PendingPanel
          users={users}
          currentUserId={currentUserId}
          impersonating={impersonating}
          refreshing={refreshing}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pending > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-areia bg-areia/20 px-4 py-3"
        >
          <p className="flex items-center gap-2.5 font-medium text-sm">
            <Badge className="tabular-nums" data-testid="pending-requests-count">
              {pending}
            </Badge>
            {m.users_pending_banner()}
          </p>
          <Button
            size="sm"
            className="h-10 w-full font-semibold sm:h-8 sm:w-auto"
            onClick={() => onViewChange('pending')}
          >
            <UserCheck aria-hidden="true" />
            {m.users_pending_review()}
          </Button>
        </div>
      )}
      <UsersTable
        users={users}
        currentUserId={currentUserId}
        impersonating={impersonating}
        refreshing={refreshing}
      />
    </div>
  );
}
