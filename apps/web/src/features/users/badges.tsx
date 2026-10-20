import type { UserAdminOut } from '@/client';
import { Badge } from '@/components/ui/badge';
import { m } from '@/paraglide/messages';
import { roleLabel } from './role-picker';

export const approvalLabel = (status: UserAdminOut['approval_status']): string =>
  status === 'pending'
    ? m.users_approval_pending()
    : status === 'rejected'
      ? m.users_approval_rejected()
      : m.users_approval_approved();

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

export function ApprovalBadge({ status }: { status: UserAdminOut['approval_status'] }) {
  return (
    <Badge
      variant={
        status === 'rejected' ? 'destructive' : status === 'pending' ? 'outline' : 'secondary'
      }
      className={status === 'pending' ? 'border-areia bg-areia/20 text-foreground' : undefined}
    >
      {approvalLabel(status)}
    </Badge>
  );
}
