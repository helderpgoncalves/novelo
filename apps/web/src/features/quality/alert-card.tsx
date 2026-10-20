import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { DataAlertOut } from '@/client';
import {
  suggestAlertResolutionMutation,
  updateDataAlertMutation,
} from '@/client/@tanstack/react-query.gen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { listDataQualityKey } from '@/features/quality/keys';
import { SuggestionCard } from '@/features/quality/suggestion-card';
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
  const suggest = useMutation(suggestAlertResolutionMutation());
  const suggestion = suggest.data;
  const set = (status: DataAlertOut['status'], text = note) =>
    update.mutate({
      path: { alert_id: alert.id },
      body: { status, resolution_note: text || null },
    });
  const open = alert.status === 'open';

  return (
    <li className="flex flex-col gap-4 bg-card p-5">
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
      <div className="space-y-2">
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
      </div>

      {open && !suggestion && (
        <div className="space-y-2">
          {suggest.isPending ? (
            <div aria-busy="true" className="space-y-2">
              <span className="sr-only">{m.quality_suggest_loading()}</span>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : (
            <Button
              variant="outline"
              className="h-10 gap-2"
              onClick={() => suggest.mutate({ path: { alert_id: alert.id } })}
            >
              <Lightbulb className="size-4 text-primary" aria-hidden="true" />
              {m.quality_suggest()}
            </Button>
          )}
          {suggest.isError && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
            >
              <span className="font-medium">{m.quality_suggest_error()}</span>
              <span className="text-muted-foreground">{getErrorMessage(suggest.error)}</span>
            </div>
          )}
        </div>
      )}

      {open && suggestion && (
        <SuggestionCard
          suggestion={suggestion}
          applying={update.isPending}
          onDismiss={() => suggest.reset()}
          onApply={() => {
            setNote(suggestion.resolution_note);
            set(suggestion.suggested_status, suggestion.resolution_note);
          }}
        />
      )}

      <div className="mt-auto space-y-2">
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
          className="text-base md:text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          {open ? (
            <>
              <Button className="h-10" onClick={() => set('resolved')} disabled={update.isPending}>
                {m.quality_alert_resolve()}
              </Button>
              <Button
                variant="outline"
                className="h-10"
                onClick={() => set('wont_fix')}
                disabled={update.isPending}
              >
                {m.quality_alert_ignore()}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              className="h-10"
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
