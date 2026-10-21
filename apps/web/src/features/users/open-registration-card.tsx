import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DoorOpen, History } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import type { AppSettingsOut, AppSettingsUpdated, UserAdminOut } from '@/client';
import {
  getAppSettingsOptions,
  getAppSettingsQueryKey,
  getAuthConfigQueryKey,
  getRegistrationInfoQueryKey,
  listUsersQueryKey,
  updateAppSettingsMutation,
} from '@/client/@tanstack/react-query.gen';
import { ErrorState } from '@/components/states';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/i18n';
import { displayName } from '@/lib/person';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { ConfirmCheck } from './confirm-check';
import { openRegistrationToast } from './open-registration';

/**
 * Registo aberto (só administradores): quem se regista ou entra com Google fica logo aprovado. Ligar pede confirmação,
 * com a opção de aprovar também os pedidos pendentes; desligar é imediato. A última alteração (quando e por quem) fica
 * à vista; o registo completo está na Auditoria.
 */
export function OpenRegistrationCard({
  users,
  onShowAudit,
}: {
  users: UserAdminOut[];
  onShowAudit?: () => void;
}) {
  const queryClient = useQueryClient();
  const settings = useQuery(getAppSettingsOptions());
  const [confirming, setConfirming] = useState(false);
  const [approvePending, setApprovePending] = useState(false);
  const labelId = useId();
  const textId = useId();
  const switchId = useId();

  const mutation = useMutation({
    ...updateAppSettingsMutation(),
    onSuccess: (data: AppSettingsUpdated) => {
      const { updated_at, updated_by_id, open_registration, pending_approvals } = data;
      queryClient.setQueryData<AppSettingsOut>(getAppSettingsQueryKey(), {
        open_registration,
        pending_approvals,
        updated_at,
        updated_by_id,
      });
      void queryClient.invalidateQueries({ queryKey: getAuthConfigQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getRegistrationInfoQueryKey() });
      if (data.approved_pending > 0)
        void queryClient.invalidateQueries({ queryKey: listUsersQueryKey() });
      const { kind, text } = openRegistrationToast(data);
      toast[kind](text);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      void queryClient.invalidateQueries({ queryKey: getAppSettingsQueryKey() });
    },
  });

  if (settings.isPending) {
    return (
      <div
        role="status"
        aria-label={m.common_loading()}
        className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 sm:p-5"
      >
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full max-w-lg" />
        </div>
        <Skeleton className="h-6 w-11 rounded-full" />
      </div>
    );
  }
  if (settings.isError) {
    return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  }

  const {
    open_registration: isOpen,
    pending_approvals: pending,
    updated_at,
    updated_by_id,
  } = settings.data;
  const who = updated_by_id ? users.find((u) => u.id === updated_by_id) : undefined;
  const busy = mutation.isPending;

  const onToggle = (next: boolean) => {
    if (next) {
      setApprovePending(false);
      setConfirming(true);
      return;
    }
    mutation.mutate({ body: { open_registration: false } });
  };

  return (
    <section
      aria-labelledby={labelId}
      data-testid="open-registration"
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 sm:gap-4 sm:p-5',
        isOpen ? 'border-primary/30 bg-primary/[0.06]' : 'border-border bg-card',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'hidden size-10 shrink-0 place-items-center rounded-full sm:grid',
          isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        <DoorOpen className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={labelId} className="font-medium font-sans text-base">
            {m.open_reg_title()}
          </h2>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 font-semibold text-[11px] uppercase tracking-wide',
              isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            {isOpen ? m.open_reg_on() : m.open_reg_off()}
          </span>
        </div>
        <p id={textId} className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
          {m.open_reg_text()}
        </p>
        {updated_at && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
            <span className="inline-flex items-start gap-1.5">
              <History className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {who
                  ? m.open_reg_changed_by({
                      when: formatDateTime(updated_at),
                      name: displayName(who),
                    })
                  : m.open_reg_changed({ when: formatDateTime(updated_at) })}
              </span>
            </span>
            {onShowAudit && (
              <button
                type="button"
                onClick={onShowAudit}
                className="inline-flex min-h-10 items-center font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none sm:min-h-0"
              >
                {m.open_reg_audit()}
              </button>
            )}
          </p>
        )}
      </div>
      {/* A área de toque é a etiqueta toda (≥ 44 px), não só o interruptor. */}
      <label
        htmlFor={switchId}
        className="-mt-2 -mr-2 flex min-h-11 min-w-14 shrink-0 cursor-pointer items-center justify-center rounded-lg px-3 hover:bg-muted/60"
      >
        <Switch
          id={switchId}
          checked={isOpen}
          disabled={busy}
          onCheckedChange={onToggle}
          aria-labelledby={labelId}
          aria-describedby={textId}
        />
      </label>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.open_reg_confirm_title()}</AlertDialogTitle>
            <AlertDialogDescription>{m.open_reg_confirm_text()}</AlertDialogDescription>
          </AlertDialogHeader>
          {pending > 0 && (
            <ConfirmCheck
              checked={approvePending}
              onChange={setApprovePending}
              hint={m.open_reg_confirm_pending_hint()}
            >
              {m.open_reg_confirm_pending({ count: pending })}
            </ConfirmCheck>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">{m.common_cancel()}</AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              onClick={() =>
                mutation.mutate({
                  body: { open_registration: true, approve_pending: pending > 0 && approvePending },
                })
              }
            >
              {m.open_reg_confirm_cta()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
