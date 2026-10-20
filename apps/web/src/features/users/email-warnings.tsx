import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, MailWarning, Send, UserRoundPen } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { UserAdminOut } from '@/client';
import { resendUserEmailMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserChip } from '@/components/user-chip';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';
import { invalidateAdminQueries } from './cache';
import { warningText } from './email-logic';

export type Decision = 'approved' | 'rejected';

/** `mailto:` para a pessoa, montado quando se clica: a alternativa quando o email do Novelo não saiu. */
export function contactPersonHref(user: Pick<UserAdminOut, 'email'>, decision: Decision): string {
  const body =
    decision === 'approved'
      ? m.email_warning_contact_approved({ url: window.location.origin })
      : m.email_warning_contact_rejected();
  return `mailto:${encodeURIComponent(user.email).replace('%40', '@')}?subject=${encodeURIComponent(
    m.email_warning_contact_subject(),
  )}&body=${encodeURIComponent(body)}`;
}

/** Uma pessoa cuja decisão ficou feita mas cujo email não saiu: reenviar ou avisar por outro meio. */
function WarningRow({ initial, decision }: { initial: UserAdminOut; decision: Decision }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(initial);
  const resend = useMutation({
    ...resendUserEmailMutation(),
    onSuccess: async (next) => {
      setUser(next);
      await invalidateAdminQueries(queryClient);
      if (!next.email_warning) toast.success(m.email_warning_resent({ email: next.email }));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const warning = user.email_warning;

  return (
    <li
      className="space-y-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
      data-testid="email-warning"
    >
      <UserChip person={user} />
      {warning ? (
        <>
          <p className="flex items-start gap-2 text-sm leading-relaxed" role="alert">
            <MailWarning className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            {warningText(warning)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-10 flex-1 sm:h-8 sm:flex-none"
              loading={resend.isPending}
              onClick={() => resend.mutate({ path: { user_id: user.id } })}
            >
              <Send aria-hidden="true" />
              {m.email_warning_resend()}
            </Button>
            <Button asChild size="sm" variant="outline" className="h-10 flex-1 sm:h-8 sm:flex-none">
              <a href={contactPersonHref(user, decision)}>
                <UserRoundPen aria-hidden="true" />
                {m.email_warning_contact()}
              </a>
            </Button>
          </div>
        </>
      ) : (
        <p className="flex items-center gap-2 text-primary text-sm" role="status">
          <Check className="size-4" aria-hidden="true" />
          {m.email_warning_resent({ email: user.email })}
        </p>
      )}
    </li>
  );
}

/**
 * Resultado de aprovar/recusar quando o email para a pessoa NÃO saiu (a decisão ficou feita): aviso claro, com
 * «Reenviar email» e a alternativa de contactar a pessoa. Nunca fecha sozinho: a pessoa não pode ficar sem saber.
 */
export function EmailWarnings({
  users,
  decision,
  onClose,
  title,
}: {
  users: UserAdminOut[];
  decision: Decision;
  onClose: () => void;
  title: string;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="break-words font-serif text-xl">{title}</DialogTitle>
        <DialogDescription>{m.email_warning_title()}</DialogDescription>
      </DialogHeader>
      <ul className="space-y-2" data-testid="email-warnings">
        {users.map((u) => (
          <WarningRow key={u.id} initial={u} decision={decision} />
        ))}
      </ul>
      <DialogFooter>
        <Button className="h-10 font-semibold" onClick={onClose}>
          {m.email_warning_done()}
        </Button>
      </DialogFooter>
    </>
  );
}
