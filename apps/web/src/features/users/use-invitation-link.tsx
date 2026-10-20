import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createInvitationLink, type InvitationOut } from '@/client';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { invalidateAdminQueries } from './cache';
import { copyFromPromise } from './clipboard';

interface Manual {
  url: string;
  expiresAt: string;
}

/**
 * Copiar o link de um convite (`POST /users/invitations/{id}/link`): gera um link novo (o anterior deixa de
 * funcionar), copia-o UMA vez e não o guarda nem o mostra em listas. Se o browser não deixar copiar sozinho,
 * mostra-o uma só vez num diálogo para copiar à mão.
 *
 * `ask(inv)` pede confirmação (o link já enviado deixa de funcionar); `copy(inv)` copia logo.
 */
export function useInvitationLink() {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState<InvitationOut | null>(null);
  const [manual, setManual] = useState<Manual | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  const copy = useCallback(
    async (inv: InvitationOut): Promise<boolean> => {
      if (busy.current) return false;
      busy.current = true;
      setPending(true);
      try {
        // O pedido e a cópia começam no mesmo gesto do utilizador (o Safari só copia assim).
        const request = createInvitationLink({
          path: { invitation_id: inv.id },
          throwOnError: true,
        }).then((r) => r.data);
        const copied = copyFromPromise(request.then((d) => d.url));
        let data: Awaited<typeof request>;
        try {
          data = await request;
        } catch (error) {
          toast.error(getErrorMessage(error));
          return false;
        }
        await invalidateAdminQueries(queryClient);
        if (await copied) {
          toast.success(m.email_link_copied({ when: formatDateTime(data.expires_at) }));
        } else {
          setManual({ url: data.url, expiresAt: data.expires_at });
        }
        return true;
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [queryClient],
  );

  const element = (
    <>
      <AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">
              {m.email_link_title({ email: asking?.email ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{m.email_link_text()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10">{m.common_cancel()}</AlertDialogCancel>
            <Button
              className="h-10 font-semibold"
              loading={pending}
              onClick={() => {
                const target = asking;
                setAsking(null);
                if (target) void copy(target);
              }}
            >
              {m.email_link_confirm()}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ManualLinkDialog manual={manual} onClose={() => setManual(null)} />
    </>
  );

  return { ask: setAsking, copy, pending, element };
}

function ManualLinkDialog({ manual, onClose }: { manual: Manual | null; onClose: () => void }) {
  const id = useId();
  return (
    <Dialog open={manual !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{m.email_link_manual_title()}</DialogTitle>
          <DialogDescription>{m.email_link_manual_text()}</DialogDescription>
        </DialogHeader>
        {manual && (
          <div className="space-y-2">
            <Label htmlFor={id}>{m.email_link_manual_label()}</Label>
            <Input
              id={id}
              readOnly
              value={manual.url}
              className="h-10 font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <p className="text-muted-foreground text-xs">
              {m.email_link_valid({ when: formatDateTime(manual.expiresAt) })}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button className="h-10 font-semibold" onClick={onClose}>
            {m.email_invite_done()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
