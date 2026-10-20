import type { UserAdminOut } from '@/client';
import { Badge } from '@/components/ui/badge';
import { m } from '@/paraglide/messages';
import { roleLabel } from './role-picker';

export const originLabel = (via: UserAdminOut['joined_via']): string => {
  switch (via) {
    case 'google':
      return m.users_origin_google();
    case 'quick_join':
      return m.users_origin_quick_join();
    case 'magic_link':
      return m.users_origin_magic_link();
    case 'invited':
      return m.users_origin_invited();
    default:
      return m.users_origin_password();
  }
};

export function RoleBadge({ role }: { role: UserAdminOut['role'] }) {
  return <Badge variant={role === 'admin' ? 'default' : 'secondary'}>{roleLabel(role)}</Badge>;
}

export type AccountState = 'active' | 'inactive' | 'pending' | 'rejected';

/** Estado único da conta: aprovação primeiro (por aprovar, rejeitada), depois ativa/desativada. */
export const accountState = (
  u: Pick<UserAdminOut, 'approval_status' | 'is_active'>,
): AccountState =>
  u.approval_status === 'pending'
    ? 'pending'
    : u.approval_status === 'rejected'
      ? 'rejected'
      : u.is_active
        ? 'active'
        : 'inactive';

export const stateLabel = (state: AccountState): string =>
  state === 'pending'
    ? m.users_approval_pending()
    : state === 'rejected'
      ? m.users_approval_rejected()
      : state === 'active'
        ? m.users_status_active()
        : m.users_status_inactive();

export function StateBadge({ state }: { state: AccountState }) {
  return (
    <Badge
      variant={state === 'rejected' || state === 'inactive' ? 'destructive' : 'outline'}
      className={state === 'pending' ? 'border-areia bg-areia/20 text-foreground' : undefined}
    >
      {stateLabel(state)}
    </Badge>
  );
}
