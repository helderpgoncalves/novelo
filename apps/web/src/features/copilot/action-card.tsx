import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CircleSlash, Clock, Undo2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ActionOut } from '@/client';
import {
  confirmCopilotActionMutation,
  rejectCopilotActionMutation,
  undoCopilotActionMutation,
} from '@/client/@tanstack/react-query.gen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { invalidateCopilot } from './cache';

export const riskLabel: Record<ActionOut['risk'], () => string> = {
  low: () => m.chat_risk_low(),
  medium: () => m.chat_risk_medium(),
  high: () => m.chat_risk_high(),
  critical: () => m.chat_risk_critical(),
};

export const actionStatusLabel: Record<ActionOut['status'], () => string> = {
  proposed: () => m.chat_action_status_proposed(),
  executed: () => m.chat_action_status_executed(),
  failed: () => m.chat_action_status_failed(),
  rejected: () => m.chat_action_status_rejected(),
  expired: () => m.chat_action_status_expired(),
  undone: () => m.chat_action_status_undone(),
};

const RISK_TONE: Record<ActionOut['risk'], string> = {
  low: 'border-border text-muted-foreground',
  medium: 'border-areia text-foreground',
  high: 'border-destructive/50 text-destructive',
  critical: 'border-destructive bg-destructive/10 text-destructive',
};

function StatusIcon({ status }: { status: ActionOut['status'] }) {
  const cls = 'size-4 shrink-0';
  switch (status) {
    case 'executed':
      return <CheckCircle2 className={cn(cls, 'text-primary')} aria-hidden="true" />;
    case 'failed':
      return <AlertTriangle className={cn(cls, 'text-destructive')} aria-hidden="true" />;
    case 'rejected':
      return <XCircle className={cn(cls, 'text-muted-foreground')} aria-hidden="true" />;
    case 'expired':
      return <Clock className={cn(cls, 'text-muted-foreground')} aria-hidden="true" />;
    case 'undone':
      return <Undo2 className={cn(cls, 'text-muted-foreground')} aria-hidden="true" />;
    default:
      return <CircleSlash className={cn(cls, 'text-primary')} aria-hidden="true" />;
  }
}

/** Proposta de ação do copiloto: só o clique da pessoa a executa (as críticas pedem escrever APAGAR). */
export function ActionCard({
  action,
  onChange,
}: {
  action: ActionOut;
  onChange?: (action: ActionOut) => void;
}) {
  const qc = useQueryClient();
  const [typed, setTyped] = useState('');
  const word = action.confirm_word ?? 'APAGAR';
  const needsText = action.requires_text;
  const done = (next: ActionOut) => {
    onChange?.(next);
    void invalidateCopilot(qc, /Action|History/);
  };
  const fail = (error: unknown) => toast.error(getErrorMessage(error));

  const confirm = useMutation({
    ...confirmCopilotActionMutation(),
    onSuccess: done,
    onError: fail,
  });
  const reject = useMutation({ ...rejectCopilotActionMutation(), onSuccess: done, onError: fail });
  const undo = useMutation({ ...undoCopilotActionMutation(), onSuccess: done, onError: fail });
  const busy = confirm.isPending || reject.isPending || undo.isPending;
  const proposed = action.status === 'proposed';
  const result = typeof action.result?.message === 'string' ? action.result.message : null;

  return (
    <article
      data-testid="copilot-action"
      data-status={action.status}
      className={cn(
        'space-y-3 rounded-xl border bg-card p-3.5 sm:p-4',
        proposed && 'border-primary/40',
        action.risk === 'critical' && proposed && 'border-destructive/50',
      )}
      aria-label={action.summary}
    >
      <header className="flex flex-wrap items-center gap-2">
        <StatusIcon status={action.status} />
        <h3 className="min-w-0 flex-1 font-sans font-semibold text-sm">{action.summary}</h3>
        <Badge variant="outline" className={cn('text-[10px] uppercase', RISK_TONE[action.risk])}>
          {riskLabel[action.risk]()}
        </Badge>
        <Badge variant="secondary" className="text-[10px] uppercase">
          {actionStatusLabel[action.status]()}
        </Badge>
      </header>
      {action.impact && (
        <p className="text-muted-foreground text-sm leading-relaxed">{action.impact}</p>
      )}
      {result && !proposed && <p className="text-sm">{result}</p>}
      {proposed && (
        <>
          {needsText && (
            <div className="space-y-1.5">
              <label htmlFor={`confirm-${action.id}`} className="font-medium text-sm">
                {m.chat_action_type_to_confirm({ word })}
              </label>
              <Input
                id={`confirm-${action.id}`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                className="h-11 text-base md:text-base"
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-10 px-4"
              variant={
                action.risk === 'critical' || action.risk === 'high' ? 'destructive' : 'default'
              }
              disabled={busy || (needsText && typed.trim().toUpperCase() !== word.toUpperCase())}
              onClick={() =>
                confirm.mutate({
                  path: { action_id: action.id },
                  body: { confirmation_text: needsText ? typed.trim() : null },
                })
              }
            >
              {confirm.isPending ? m.chat_action_confirming() : m.chat_action_confirm()}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-10 px-4"
              disabled={busy}
              onClick={() => reject.mutate({ path: { action_id: action.id } })}
            >
              {m.chat_action_reject()}
            </Button>
            <span className="text-muted-foreground text-xs">
              {m.chat_action_expires({ time: formatDateTime(action.expires_at) })}
            </span>
          </div>
        </>
      )}
      {action.status === 'executed' && action.can_undo && (
        <Button
          size="sm"
          variant="outline"
          className="h-10 gap-1.5 px-4"
          disabled={busy}
          onClick={() => undo.mutate({ path: { action_id: action.id } })}
        >
          <Undo2 className="size-4" aria-hidden="true" />
          {m.chat_action_undo()}
        </Button>
      )}
    </article>
  );
}
