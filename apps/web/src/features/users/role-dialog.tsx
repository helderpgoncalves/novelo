import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { UserAdminOut } from '@/client';
import { updateUserMutation } from '@/client/@tanstack/react-query.gen';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';
import { blockerText } from './blocker-text';
import { invalidateAdminQueries } from './cache';
import { ConfirmCheck } from './confirm-check';
import { displayName, needsAdminConfirm, type Role, updateBlocker } from './logic';
import { RolePicker } from './role-picker';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserAdminOut | null;
  users: UserAdminOut[];
  selfId: string;
}

/** Mudar o perfil. Dar o papel de administrador exige uma confirmação explícita (a API também a pede). */
export function RoleDialog({ open, onOpenChange, user, users, selfId }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {user && (
          <RoleBody
            user={user}
            blocker={updateBlocker(user, users, selfId)}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RoleBody({
  user,
  blocker,
  onClose,
}: {
  user: UserAdminOut;
  blocker: ReturnType<typeof updateBlocker>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role>(user.role);
  const [confirmAdmin, setConfirmAdmin] = useState(false);
  const name = displayName(user);
  const update = useMutation({
    ...updateUserMutation(),
    onSuccess: async () => {
      await invalidateAdminQueries(queryClient);
      toast.success(m.users_updated());
      onClose();
    },
  });
  const grantsAdmin = needsAdminConfirm(role) && user.role !== 'admin';
  const changed = role !== user.role;
  const ready = changed && (!grantsAdmin || confirmAdmin);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="break-words font-serif text-xl">
          {m.users_role_title({ name })}
        </DialogTitle>
        <DialogDescription className="break-words">{user.email}</DialogDescription>
      </DialogHeader>
      {blocker ? (
        <>
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertDescription>{blockerText(blocker)}</AlertDescription>
          </Alert>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10" onClick={onClose}>
              {m.common_close()}
            </Button>
          </DialogFooter>
        </>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready)
              update.mutate({
                path: { user_id: user.id },
                body: { role, confirm_admin: grantsAdmin ? confirmAdmin : undefined },
              });
          }}
        >
          <RolePicker value={role} onChange={setRole} legend={m.users_role_label()} />
          {grantsAdmin && (
            <ConfirmCheck checked={confirmAdmin} onChange={setConfirmAdmin}>
              {m.users_role_admin_confirm({ name })}
            </ConfirmCheck>
          )}
          {!changed && <p className="text-muted-foreground text-xs">{m.users_role_unchanged()}</p>}
          <FormAlert message={update.isError ? getErrorMessage(update.error) : null} />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10" onClick={onClose}>
              {m.common_cancel()}
            </Button>
            <Button
              type="submit"
              className="h-10 font-semibold"
              disabled={!ready}
              loading={update.isPending}
            >
              {m.users_role_submit()}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  );
}
