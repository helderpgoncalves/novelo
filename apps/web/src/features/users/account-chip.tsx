import { memo, type ReactNode } from 'react';
import type { UserAdminOut } from '@/client';
import { type UserAvatarSize, UserChip } from '@/components/user-chip';
import { accountState, stateLabel } from './badges';

interface Props {
  user: Pick<UserAdminOut, 'name' | 'email' | 'approval_status' | 'is_active' | 'id'> & {
    avatar_url?: string | null;
  };
  /** O id da sessão: marca «Tu» na própria conta. */
  selfId?: string;
  size?: UserAvatarSize;
  variant?: 'stacked' | 'inline';
  children?: ReactNode;
}

/** Uma conta: avatar com indicador de estado (por aprovar, desativada, recusada), nome, email e «Tu». */
export const AccountChip = memo(function AccountChip({
  user,
  selfId,
  size = 'sm',
  variant,
  children,
}: Props) {
  const state = accountState(user);
  return (
    <UserChip
      person={user}
      size={size}
      variant={variant}
      status={state}
      statusLabel={stateLabel(state)}
      you={selfId !== undefined && user.id === selfId}
    >
      {children}
    </UserChip>
  );
});
