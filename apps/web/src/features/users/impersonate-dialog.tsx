import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Eye, ShieldAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import type { MeOut, UserAdminOut } from '@/client';
import { getMeQueryKey, startImpersonationMutation } from '@/client/@tanstack/react-query.gen';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';
import { AccountChip } from './account-chip';
import { blockerText } from './blocker-text';
import {
  displayName,
  IMPERSONATION_REASON_MAX,
  IMPERSONATION_REASON_MIN,
  impersonateBlocker,
  isReasonValid,
  reasonLength,
} from './logic';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserAdminOut | null;
  selfId: string;
  /** Já há uma impersonação a decorrer (não se aninha). */
  impersonating: boolean;
}

/** Ver como outra pessoa: motivo obrigatório, aviso do que fica bloqueado e que tudo é auditado. */
export function ImpersonateDialog({ open, onOpenChange, user, selfId, impersonating }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {user && (
          <ImpersonateBody
            user={user}
            blocker={impersonateBlocker(user, selfId, impersonating)}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImpersonateBody({
  user,
  blocker,
  onClose,
}: {
  user: UserAdminOut;
  blocker: ReturnType<typeof impersonateBlocker>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const name = displayName(user);
  const start = useMutation({
    ...startImpersonationMutation(),
    onSuccess: async ({ user: viewed, impersonation }) => {
      // A sessão passa a ser de outra pessoa: nada do admin (listas, resumos, copiloto) pode ficar na cache.
      queryClient.clear();
      const me: MeOut = { ...viewed, impersonation, pending_approvals: null };
      queryClient.setQueryData(getMeQueryKey(), me);
      toast.success(m.imp_started_toast({ name }));
      onClose();
      await navigate({ to: '/' });
    },
  });
  const valid = isReasonValid(reason);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="break-words font-serif text-xl">
          {m.users_imp_title({ name })}
        </DialogTitle>
        <DialogDescription>{m.users_imp_intro()}</DialogDescription>
      </DialogHeader>
      <AccountChip user={user} size="md" />
      {blocker ? (
        <>
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertTitle>{m.users_imp_title({ name })}</AlertTitle>
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
            if (valid) start.mutate({ path: { user_id: user.id }, body: { reason } });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={reasonId}>{m.users_imp_reason_label()}</Label>
            <Textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={IMPERSONATION_REASON_MAX}
              rows={3}
              placeholder={m.users_imp_reason_placeholder()}
              aria-describedby={`${reasonId}-hint`}
              className="min-h-20"
            />
            <p
              id={`${reasonId}-hint`}
              className={`text-xs ${reason && !valid ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {m.users_imp_reason_hint({
                min: IMPERSONATION_REASON_MIN,
                count: reasonLength(reason),
                max: IMPERSONATION_REASON_MAX,
              })}
            </p>
          </div>
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{m.users_imp_blocked_title()}</p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              <li>{m.users_imp_block_account()}</li>
              <li>{m.users_imp_block_data()}</li>
              <li>{m.users_imp_block_admin()}</li>
            </ul>
            <p className="border-t pt-2 text-muted-foreground">{m.users_imp_audited()}</p>
          </div>
          <FormAlert message={start.isError ? getErrorMessage(start.error) : null} />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10" onClick={onClose}>
              {m.common_cancel()}
            </Button>
            <Button
              type="submit"
              className="h-10 font-semibold"
              disabled={!valid}
              loading={start.isPending}
            >
              <Eye aria-hidden="true" />
              {m.users_imp_submit({ name })}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  );
}
