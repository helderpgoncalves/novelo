import { type ReactNode, useCallback, useMemo, useState } from 'react';
import type { UserAdminOut } from '@/client';
import { ApproveDialog } from './approve-dialog';
import { DeactivateDialog } from './deactivate-dialog';
import { DeleteUserDialog } from './delete-user-dialog';
import { ImpersonateDialog } from './impersonate-dialog';
import { RejectDialog } from './reject-dialog';
import { RoleDialog } from './role-dialog';

export type DialogKind = 'delete' | 'role' | 'impersonate' | 'deactivate' | 'approve' | 'reject';

interface State {
  kind: DialogKind;
  open: boolean;
  targets: UserAdminOut[];
}

/**
 * Todos os diálogos de gestão de contas num só sítio: quem os usa pede `show(tipo, pessoas)` e põe `element` na
 * árvore. O alvo mantém-se depois de fechar para o diálogo não "esvaziar" durante a animação de saída.
 */
export function useAccountDialogs(opts: {
  users: UserAdminOut[];
  selfId: string;
  impersonating: boolean;
}): { show: (kind: DialogKind, targets: UserAdminOut[]) => void; element: ReactNode } {
  const { users, selfId, impersonating } = opts;
  const [state, setState] = useState<State>({ kind: 'delete', open: false, targets: [] });
  const show = useCallback(
    (kind: DialogKind, targets: UserAdminOut[]) => setState({ kind, open: true, targets }),
    [],
  );
  const setOpen = useCallback((open: boolean) => setState((s) => ({ ...s, open })), []);

  const element = useMemo(() => {
    const first = state.targets[0] ?? null;
    const is = (kind: DialogKind) => state.open && state.kind === kind;
    return (
      <>
        <DeleteUserDialog
          open={is('delete')}
          onOpenChange={setOpen}
          user={first}
          users={users}
          selfId={selfId}
        />
        <RoleDialog
          open={is('role')}
          onOpenChange={setOpen}
          user={first}
          users={users}
          selfId={selfId}
        />
        <ImpersonateDialog
          open={is('impersonate')}
          onOpenChange={setOpen}
          user={first}
          selfId={selfId}
          impersonating={impersonating}
        />
        <DeactivateDialog
          open={is('deactivate')}
          onOpenChange={setOpen}
          targets={state.targets}
          users={users}
          selfId={selfId}
        />
        <ApproveDialog open={is('approve')} onOpenChange={setOpen} users={state.targets} />
        <RejectDialog open={is('reject')} onOpenChange={setOpen} user={first} />
      </>
    );
  }, [state, users, selfId, impersonating, setOpen]);

  return { show, element };
}
