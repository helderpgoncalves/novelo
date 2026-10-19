import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { DataAlertOut } from '@/client';
import { updateDataAlertMutation } from '@/client/@tanstack/react-query.gen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { listDataQualityKey } from '@/features/quality/keys';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/i18n';
import { alertKindLabel, alertStatusLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

export function AlertCard({ alert }: { alert: DataAlertOut }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState(alert.resolution_note ?? '');
  const update = useMutation({
    ...updateDataAlertMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listDataQualityKey() });
      toast.success(m.quality_alert_saved());
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const set = (status: DataAlertOut['status']) =>
    update.mutate({
      path: { alert_id: alert.id },
      body: { status, resolution_note: note || null },
    });
  const open = alert.status === 'open';

  return (
    <li className="space-y-3 bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
          {m.quality_alert_number({ number: alert.number })}
        </span>
        <Badge variant="secondary" className="font-medium">
          {alertKindLabel[alert.kind]()}
        </Badge>
        <Badge
          variant={open ? 'outline' : 'default'}
          className="ml-auto font-semibold text-[10px] uppercase tracking-wider"
        >
          {alertStatusLabel[alert.status]()}
        </Badge>
      </div>
      <p className="text-sm leading-relaxed" lang="pt-PT">
        {alert.detail}
      </p>
      {alert.suggestion && (
        <p className="text-muted-foreground text-sm leading-relaxed" lang="pt-PT">
          <span className="font-medium text-foreground">{m.quality_alert_suggestion()}: </span>
          {alert.suggestion}
        </p>
      )}
      <p className="text-muted-foreground text-xs">{m.common_original_pt()}</p>
      <div className="space-y-2">
        <label className="font-medium text-xs" htmlFor={`note-${alert.id}`}>
          {m.quality_alert_note()}
        </label>
        <Textarea
          id={`note-${alert.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={m.quality_alert_note_placeholder()}
          rows={2}
          maxLength={1000}
        />
        <div className="flex flex-wrap items-center gap-2">
          {open ? (
            <>
              <Button
                size="sm"
                className="h-8"
                onClick={() => set('resolved')}
                disabled={update.isPending}
              >
                {m.quality_alert_resolve()}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => set('wont_fix')}
                disabled={update.isPending}
              >
                {m.quality_alert_ignore()}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => set('open')}
              disabled={update.isPending}
            >
              {m.quality_alert_reopen()}
            </Button>
          )}
          {alert.resolved_at && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatDateTime(alert.resolved_at)}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
