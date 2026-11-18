import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { DispatchRequest } from '@/client';
import {
  dispatchCollectionRequestMutation,
  listCollectionRequestsQueryKey,
} from '@/client/@tanstack/react-query.gen';
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
import { Textarea } from '@/components/ui/textarea';
import { getErrorCode } from '@/lib/errors';
import { m } from '@/paraglide/messages';

/** O despacho do gestor numa exceção: agendar com data (pode sair da ronda pedida) ou recusar com motivo.
 * Fora de ronda, fora do prazo, urgência e recolha especial saem todos por esta mesma porta. */
export function DispatchDialog({
  requestId,
  action,
  currentDate,
  open,
  onOpenChange,
}: {
  requestId: string;
  action: Extract<DispatchRequest['action'], 'schedule' | 'reject'>;
  currentDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(currentDate);
  const [reason, setReason] = useState('');
  const dispatch = useMutation({
    ...dispatchCollectionRequestMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listCollectionRequestsQueryKey() });
      onOpenChange(false);
      toast(
        action === 'schedule'
          ? m.collection_requests_toast_scheduled()
          : m.collection_requests_toast_rejected(),
      );
    },
    onError: (error) =>
      toast(`${m.collection_requests_toast_dispatch_failed()} ${getErrorCode(error) ?? ''}`),
  });

  const submit = () => {
    dispatch.mutate({
      path: { request_id: requestId },
      body:
        action === 'schedule'
          ? { action, requested_date: date, reason: reason.trim() || undefined }
          : { action, reason: reason.trim() || undefined },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action === 'schedule'
              ? m.collection_requests_dispatch_schedule_title()
              : m.collection_requests_dispatch_reject_title()}
          </DialogTitle>
          <DialogDescription>
            {action === 'schedule'
              ? m.collection_requests_dispatch_schedule_description()
              : m.collection_requests_dispatch_reject_description()}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {action === 'schedule' && (
            <div className="space-y-1.5">
              <Label htmlFor="dispatch-date">{m.collection_requests_field_date()}</Label>
              <Input
                id="dispatch-date"
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 text-base"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="dispatch-reason">
              {action === 'reject'
                ? m.collection_requests_field_reason_required()
                : m.collection_requests_field_note()}
            </Label>
            <Textarea
              id="dispatch-reason"
              value={reason}
              maxLength={280}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                action === 'reject'
                  ? m.collection_requests_reason_placeholder()
                  : m.collection_requests_note_placeholder()
              }
              className="min-h-20 text-base"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
            {m.collection_requests_cancel()}
          </Button>
          <Button
            className="h-10"
            variant={action === 'reject' ? 'destructive' : 'default'}
            disabled={
              dispatch.isPending ||
              (action === 'reject' && reason.trim() === '') ||
              (action === 'schedule' && !date)
            }
            onClick={submit}
          >
            {dispatch.isPending
              ? m.collection_requests_saving()
              : action === 'schedule'
                ? m.collection_requests_dispatch_schedule_confirm()
                : m.collection_requests_dispatch_reject_confirm()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
