import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { UserAdminOut } from '@/client';
import { approveUser } from '@/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserAvatarStack } from '@/components/user-chip';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';
import { AccountChip } from './account-chip';
import { invalidateAdminQueries } from './cache';
import { ConfirmCheck } from './confirm-check';
import { EmailWarnings } from './email-warnings';
import { displayName, needsAdminConfirm, type Role } from './logic';
import { RolePicker } from './role-picker';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Uma ou várias pessoas (ação em massa): o perfil e o aviso valem para todas. */
  users: UserAdminOut[];
}

export function ApproveDialog({ open, onOpenChange, users }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {users.length > 0 && <ApproveBody users={users} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ApproveBody({ users, onClose }: { users: UserAdminOut[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role>('operator');
  const [notify, setNotify] = useState(true);
  const [confirmAdmin, setConfirmAdmin] = useState(false);
  const [warned, setWarned] = useState<UserAdminOut[] | null>(null);
  const many = users.length > 1;
  const first = users[0];
  const name = first ? displayName(first) : '';
  const approve = useMutation({
    // Várias pessoas: um pedido por pessoa; o resumo diz quantas correram bem.
    mutationFn: async () => {
      const results = await Promise.allSettled(
        users.map((u) =>
          approveUser({
            path: { user_id: u.id },
            body: {
              role,
              notify,
              confirm_admin: needsAdminConfirm(role) ? confirmAdmin : undefined,
            },
            throwOnError: true,
          }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length === results.length) throw (failed[0] as PromiseRejectedResult).reason;
      // Quem foi aprovado mas ficou sem o email: a ação está feita, a pessoa pode não saber.
      const warned = results.flatMap((r) =>
        r.status === 'fulfilled' && r.value.data.email_warning ? [r.value.data] : [],
      );
      return { ok: results.length - failed.length, failed: failed.length, warned };
    },
    onSuccess: async ({ ok, failed, warned: unnotified }) => {
      await invalidateAdminQueries(queryClient);
      if (failed > 0) toast.warning(m.approve_done_partial({ ok, failed }));
      else toast.success(many ? m.approve_done_many({ count: ok }) : m.approve_done({ name }));
      if (unnotified.length > 0) setWarned(unnotified);
      else onClose();
    },
  });
  const ready = !needsAdminConfirm(role) || confirmAdmin;

  if (warned) {
    return (
      <EmailWarnings
        users={warned}
        decision="approved"
        onClose={onClose}
        title={many ? m.approve_title_many({ count: users.length }) : m.approve_done({ name })}
      />
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="break-words font-serif text-xl">
          {many ? m.approve_title_many({ count: users.length }) : m.approve_title({ name })}
        </DialogTitle>
        <DialogDescription className="break-words">{m.approve_text()}</DialogDescription>
      </DialogHeader>
      {many ? <UserAvatarStack people={users} /> : first && <AccountChip user={first} size="md" />}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) approve.mutate();
        }}
      >
        <RolePicker
          value={role}
          onChange={(next) => {
            setRole(next);
            setConfirmAdmin(false);
          }}
          legend={m.approve_role()}
        />
        {needsAdminConfirm(role) && (
          <ConfirmCheck checked={confirmAdmin} onChange={setConfirmAdmin}>
            {m.users_role_admin_confirm({ name: many ? String(users.length) : name })}
          </ConfirmCheck>
        )}
        <ConfirmCheck checked={notify} onChange={setNotify} hint={m.approve_notify_hint()}>
          {m.approve_notify()}
        </ConfirmCheck>
        <FormAlert message={approve.isError ? getErrorMessage(approve.error) : null} />
        <DialogFooter>
          <Button type="button" variant="outline" className="h-10" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button
            type="submit"
            className="h-10 font-semibold"
            disabled={!ready}
            loading={approve.isPending}
          >
            {many ? m.approve_submit_many({ count: users.length }) : m.approve_submit()}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
