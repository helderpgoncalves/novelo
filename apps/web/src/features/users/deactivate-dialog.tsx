import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { type UserAdminOut, updateUser } from '@/client';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';
import { blockerText } from './blocker-text';
import { invalidateAdminQueries } from './cache';
import { displayName, updateBlocker } from './logic';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Uma ou várias contas (ação em massa); as que não podem mudar (a própria, o último admin) ficam de fora. */
  targets: UserAdminOut[];
  users: UserAdminOut[];
  selfId: string;
}

/** Desativar termina as sessões já: pede confirmação. Reativar é imediato e não passa por aqui. */
export function DeactivateDialog({ open, onOpenChange, targets, users, selfId }: Props) {
  const queryClient = useQueryClient();
  const allowed = targets.filter((t) => updateBlocker(t, users, selfId) === null);
  const firstBlocker = targets[0] ? updateBlocker(targets[0], users, selfId) : null;
  const many = targets.length > 1;
  const update = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        allowed.map((u) =>
          updateUser({ path: { user_id: u.id }, body: { is_active: false }, throwOnError: true }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length === results.length && failed[0])
        throw (failed[0] as PromiseRejectedResult).reason;
      return { ok: results.length - failed.length, failed: failed.length };
    },
    onSuccess: async ({ ok, failed }) => {
      await invalidateAdminQueries(queryClient);
      if (failed > 0) toast.warning(m.users_bulk_partial({ ok, failed }));
      else toast.success(many ? m.users_bulk_done({ ok }) : m.users_updated());
      onOpenChange(false);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">
            {many
              ? m.users_deactivate_title_many({ count: targets.length })
              : m.users_deactivate_title({ name: targets[0] ? displayName(targets[0]) : '' })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {allowed.length === 0 && firstBlocker
              ? blockerText(firstBlocker)
              : many
                ? m.users_deactivate_text_many()
                : m.users_deactivate_text()}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FormAlert message={update.isError ? getErrorMessage(update.error) : null} />
        <AlertDialogFooter>
          <AlertDialogCancel className="h-10">
            {allowed.length === 0 ? m.common_close() : m.common_cancel()}
          </AlertDialogCancel>
          {allowed.length > 0 && (
            <Button
              variant="destructive"
              className="h-10 font-semibold"
              loading={update.isPending}
              onClick={() => update.mutate()}
            >
              {m.users_deactivate()}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
