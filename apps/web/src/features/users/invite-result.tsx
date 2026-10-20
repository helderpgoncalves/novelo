import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, MailCheck, MailX, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { InvitationOut } from '@/client';
import { resendInvitationMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';
import { invalidateAdminQueries } from './cache';
import { DeliveryBadge } from './delivery-badge';
import { DELIVERY_META, wentOut } from './email-logic';
import { useInvitationLink } from './use-invitation-link';

/**
 * Depois de convidar: o estado REAL do envio, não um «enviado» otimista. Se o email não saiu, oferece logo
 * «Copiar link» (para enviar por outro canal) e «Tentar de novo».
 */
export function InviteResult({
  invitation,
  onClose,
}: {
  invitation: InvitationOut;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const link = useInvitationLink();
  const [current, setCurrent] = useState(invitation);
  const ok = wentOut(current.delivery_status);

  const retry = useMutation({
    ...resendInvitationMutation(),
    onSuccess: async (inv) => {
      setCurrent(inv);
      await invalidateAdminQueries(queryClient);
      if (wentOut(inv.delivery_status))
        toast.success(m.email_invite_retry_ok({ email: inv.email }));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const Icon = ok ? MailCheck : MailX;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="break-words font-serif text-xl">
          {ok ? m.email_invite_sent_title({ email: current.email }) : m.email_invite_failed_title()}
        </DialogTitle>
        <DialogDescription>
          {ok ? DELIVERY_META[current.delivery_status].hint() : m.email_invite_failed_text()}
        </DialogDescription>
      </DialogHeader>
      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        data-testid="invite-result"
      >
        <Icon
          className={
            ok ? 'mt-0.5 size-5 shrink-0 text-primary' : 'mt-0.5 size-5 shrink-0 text-destructive'
          }
          aria-hidden="true"
        />
        <div className="min-w-0 space-y-2">
          <p className="break-words font-medium text-sm">{current.email}</p>
          <DeliveryBadge
            status={current.delivery_status}
            at={current.last_email_at}
            error={current.delivery_error}
          />
        </div>
      </div>
      <DialogFooter>
        {!ok && (
          <>
            <Button
              variant="outline"
              className="h-10"
              loading={retry.isPending}
              onClick={() => retry.mutate({ path: { invitation_id: current.id } })}
            >
              <RotateCw aria-hidden="true" />
              {m.common_retry()}
            </Button>
            <Button
              variant="outline"
              className="h-10"
              loading={link.pending}
              onClick={() => void link.copy(current)}
            >
              <Link2 aria-hidden="true" />
              {m.email_link_confirm()}
            </Button>
          </>
        )}
        <Button className="h-10 font-semibold" onClick={onClose}>
          {m.email_invite_done()}
        </Button>
      </DialogFooter>
      {link.element}
    </>
  );
}
