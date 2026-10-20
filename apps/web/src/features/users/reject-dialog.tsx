import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import type { UserAdminOut } from '@/client';
import { rejectUserMutation } from '@/client/@tanstack/react-query.gen';
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
import { invalidateAdminQueries } from './cache';
import { ConfirmCheck } from './confirm-check';
import { EmailWarnings } from './email-warnings';
import { displayName, normalizeText, REJECT_REASON_MAX } from './logic';

export function RejectDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserAdminOut | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {user && <RejectBody user={user} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RejectBody({ user, onClose }: { user: UserAdminOut; onClose: () => void }) {
  const queryClient = useQueryClient();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(false);
  const [warned, setWarned] = useState<UserAdminOut | null>(null);
  const name = displayName(user);
  const reject = useMutation({
    ...rejectUserMutation(),
    onSuccess: async (decided) => {
      await invalidateAdminQueries(queryClient);
      toast.success(m.reject_done({ name }));
      // O email (se foi pedido) não saiu: fica o aviso com «Reenviar email» e o contacto direto.
      if (decided.email_warning) setWarned(decided);
      else onClose();
    },
  });

  if (warned) {
    return (
      <EmailWarnings
        users={[warned]}
        decision="rejected"
        onClose={onClose}
        title={m.reject_done({ name })}
      />
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="break-words font-serif text-xl">
          {m.reject_title({ name })}
        </DialogTitle>
        <DialogDescription className="break-words">{m.reject_text()}</DialogDescription>
      </DialogHeader>
      <AccountChip user={user} size="md" />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          reject.mutate({
            path: { user_id: user.id },
            body: { reason: normalizeText(reason) || null, notify },
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={reasonId}>{m.reject_reason()}</Label>
          <Textarea
            id={reasonId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={REJECT_REASON_MAX}
            rows={3}
            className="min-h-20"
          />
          <p className="text-muted-foreground text-xs">
            {m.reject_reason_hint({ count: reason.length, max: REJECT_REASON_MAX })}
          </p>
        </div>
        <ConfirmCheck checked={notify} onChange={setNotify}>
          {m.reject_notify()}
        </ConfirmCheck>
        <FormAlert message={reject.isError ? getErrorMessage(reject.error) : null} />
        <DialogFooter>
          <Button type="button" variant="outline" className="h-10" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button
            type="submit"
            variant="destructive"
            className="h-10 font-semibold"
            loading={reject.isPending}
          >
            {m.reject_submit()}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
