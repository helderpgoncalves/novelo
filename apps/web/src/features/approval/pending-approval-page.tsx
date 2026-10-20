import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AlertCircle, Check, Hourglass, Loader, MailCheck, MailWarning, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { MeOut } from '@/client';
import {
  getApprovalStatusOptions,
  getMeQueryKey,
  logoutMutation,
  resendRegistrationEmailMutation,
  resendVerificationMutation,
} from '@/client/@tanstack/react-query.gen';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LegalLinks } from '@/components/public-shell';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { UserChip } from '@/components/user-chip';
import { useCountdown } from '@/features/auth/use-countdown';
import { markTourPending } from '@/features/onboarding/tour-store';
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { intlTag } from '@/lib/i18n';
import { queryClient as sharedClient } from '@/lib/query-client';
import { mailtoLink, SUPPORT_EMAIL } from '@/lib/support';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { ApprovalMark } from './approval-mark';
import {
  type ApprovalState,
  approvalSteps,
  CONFIRMATION_RESEND_SECONDS,
  type ConfirmationKind,
  confirmationView,
  ENTER_DELAY_MS,
  ENTER_DELAY_REDUCED_MS,
  pollInterval,
  type Step,
  type StepId,
} from './steps';

const STEP_LABEL: Record<StepId, () => string> = {
  registered: () => m.pa_step_registered(),
  email: () => m.pa_step_email(),
  approval: () => m.pa_step_approval(),
  enter: () => m.pa_step_enter(),
};

const STEP_STATE_LABEL: Record<Step['state'], () => string> = {
  done: () => m.pa_step_done(),
  current: () => m.pa_step_current(),
  todo: () => m.pa_step_todo(),
  failed: () => m.pa_step_failed(),
};

function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol aria-label={m.pa_steps_label()} className="flex items-start" data-testid="approval-steps">
      {steps.map((step, i) => (
        <li
          key={step.id}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className="relative flex min-w-0 flex-1 flex-col items-center gap-2 px-1 text-center"
        >
          {i > 0 && (
            <span
              aria-hidden="true"
              className={cn(
                'absolute top-[15px] right-1/2 h-0.5 w-full -translate-y-1/2 rounded-full',
                step.state === 'todo' || step.state === 'failed' ? 'bg-border' : 'bg-primary/60',
              )}
            />
          )}
          <span
            data-state={step.state}
            className={cn(
              'relative z-10 grid size-[30px] place-items-center rounded-full border-2 bg-background font-semibold text-xs transition-colors duration-500',
              step.state === 'done' && 'border-primary bg-primary text-primary-foreground',
              step.state === 'current' && 'border-primary text-primary',
              step.state === 'todo' && 'border-border text-muted-foreground',
              step.state === 'failed' && 'border-destructive bg-destructive text-white',
            )}
          >
            {step.state === 'done' ? (
              <Check className="size-4" strokeWidth={3} aria-hidden="true" />
            ) : step.state === 'failed' ? (
              <X className="size-4" strokeWidth={3} aria-hidden="true" />
            ) : step.state === 'current' ? (
              <span
                className="size-2 rounded-full bg-primary motion-safe:animate-pulse"
                aria-hidden="true"
              />
            ) : (
              i + 1
            )}
          </span>
          <span
            className={cn(
              'text-balance text-xs leading-tight sm:text-sm',
              step.state === 'todo' ? 'text-muted-foreground' : 'font-medium',
            )}
          >
            {STEP_LABEL[step.id]()}
            <span className="sr-only">: {STEP_STATE_LABEL[step.state]()}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const CONFIRMATION_TEXT: Record<ConfirmationKind, (email: string) => string> = {
  none: () => '',
  sending: () => m.pending_conf_sending(),
  sent: () => m.pending_conf_sent(),
  delivered: (email) => m.pending_conf_delivered({ email }),
  delayed: () => m.pending_conf_delayed(),
  failed: () => m.pending_conf_failed(),
  returned: (email) => m.pending_conf_returned({ email }),
};

/** O estado do email de confirmação do pedido, sem prometer o que não sabemos; reenvio ou contacto se não chegou. */
function ConfirmationEmail({
  kind,
  email,
  canResend,
  canContact,
  waiting,
  pending,
  error,
  onResend,
}: {
  kind: ConfirmationKind;
  email: string;
  canResend: boolean;
  canContact: boolean;
  waiting: number;
  pending: boolean;
  error: string | null;
  onResend: () => void;
}) {
  const bad = kind === 'failed' || kind === 'returned';
  const Icon = bad
    ? MailWarning
    : kind === 'sending'
      ? Loader
      : kind === 'delayed'
        ? Hourglass
        : MailCheck;
  return (
    <div
      data-testid="approval-confirmation-email"
      data-kind={kind}
      className={cn('space-y-3 border-t pt-4 text-sm', bad && '[&_svg]:text-destructive')}
    >
      <p role="status" className="flex items-start gap-2.5 leading-relaxed">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {CONFIRMATION_TEXT[kind](email)}
      </p>
      {error && (
        <p role="alert" className="flex items-start gap-2.5 text-destructive leading-relaxed">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {canResend && (
        <Button
          variant="outline"
          className="h-11 w-full font-semibold"
          loading={pending}
          disabled={waiting > 0}
          onClick={onResend}
        >
          {waiting > 0 ? m.pa_resend_wait({ seconds: waiting }) : m.pending_conf_resend()}
        </Button>
      )}
      {(canContact || (error !== null && !canResend)) && (
        <Button asChild variant="outline" className="h-11 w-full font-semibold">
          <a href={mailtoLink(m.pending_conf_mail_subject(), m.pending_conf_mail_body({ email }))}>
            {m.pending_conf_contact()}
          </a>
        </Button>
      )}
    </div>
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Ecrã de espera: acolhedor, com o estado real do pedido, verificação automática e entrada sozinha quando aprovada. */
export function PendingApprovalPage({ user }: { user: MeOut }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const status = useQuery({
    ...getApprovalStatusOptions(),
    // A cada 20 s enquanto pendente (pára quando aprovado ou recusado); o React Query pausa o intervalo com o
    // separador escondido e, ao voltar, `refetchOnWindowFocus` verifica logo.
    refetchInterval: (query) => pollInterval(query.state.data?.status),
    refetchOnWindowFocus: true,
    retry: false,
  });

  const data = status.data;
  const state: ApprovalState = data?.status ?? user.approval_status;
  const emailVerified = data?.email_verified ?? user.email_verified;
  const reason = data?.rejected_reason ?? null;
  const steps = approvalSteps(state, emailVerified);

  // Aprovada: boa notícia, `me` atualizado (o guarda das rotas lê-o) e entrada suave.
  const entered = useRef(false);
  useEffect(() => {
    if (state !== 'approved' || entered.current) return;
    entered.current = true;
    toast.success(m.pa_approved_toast());
    markTourPending(); // a primeira entrada abre a visita guiada, uma vez
    // Sem limpar o temporizador de propósito: o StrictMode monta, desmonta e monta, e `entered` evita o segundo ciclo.
    window.setTimeout(
      () => {
        void (async () => {
          await queryClient.invalidateQueries({ queryKey: getMeQueryKey() });
          await navigate({ to: '/', replace: true });
        })();
      },
      reduced ? ENTER_DELAY_REDUCED_MS : ENTER_DELAY_MS,
    );
  }, [state, queryClient, navigate, reduced]);

  const logout = useMutation({
    ...logoutMutation(),
    onSettled: async () => {
      sharedClient.clear();
      await navigate({ to: '/login' });
    },
  });

  const [sentAt, setSentAt] = useState<number>(0);
  const wait = useCountdown(sentAt, 30);
  const resend = useMutation({
    ...resendVerificationMutation(),
    onSuccess: () => {
      setSentAt(Date.now());
      toast.success(m.verify_resend_toast({ email: user.email }));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
  const cooling = sentAt > 0 && wait > 0;

  // Email «recebemos o teu pedido»: o estado real e, se não saiu, o botão para reenviar.
  const confirmation = confirmationView(data?.confirmation_email);
  const [confSentAt, setConfSentAt] = useState<number>(0);
  const confWait = useCountdown(confSentAt, CONFIRMATION_RESEND_SECONDS);
  const confCooling = confSentAt > 0 && confWait > 0;
  const resendConfirmation = useMutation({
    ...resendRegistrationEmailMutation(),
    onSuccess: () => {
      setConfSentAt(Date.now());
      toast.success(m.pending_conf_resent());
      void status.refetch();
    },
    // 429: a API não diz quanto falta, por isso a espera recomeça; 409/503 já têm mensagem própria.
    onError: (error) => {
      if (getErrorCode(error) === 'rate_limited') setConfSentAt(Date.now());
    },
  });

  const rejected = state === 'rejected';
  const approved = state === 'approved';
  const checkedAt = status.dataUpdatedAt
    ? new Intl.DateTimeFormat(intlTag(), { timeStyle: 'short' }).format(status.dataUpdatedAt)
    : null;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[60dvh] bg-[radial-gradient(70%_60%_at_50%_0%,color-mix(in_oklab,var(--primary)_9%,transparent),transparent)]"
      />
      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-6">
        <BrandLogo className="h-8" />
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-5 py-8 sm:px-6 sm:py-12">
        <ApprovalMark state={state} />

        <div
          key={state}
          className="motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:animate-in space-y-3 text-center duration-500"
        >
          <p className="eyebrow">
            {approved
              ? m.pa_eyebrow_approved()
              : rejected
                ? m.pa_eyebrow_rejected()
                : m.pa_eyebrow()}
          </p>
          <h1 className="text-balance text-[1.9rem] leading-tight sm:text-4xl">
            {approved ? m.pa_approved_title() : rejected ? m.pa_rejected_title() : m.pa_title()}
          </h1>
          <p className="mx-auto max-w-md text-pretty text-muted-foreground leading-relaxed">
            {approved
              ? m.pa_approved_text()
              : rejected
                ? m.pa_rejected_text()
                : m.pa_text({ email: user.email })}
          </p>
        </div>

        <div className="mx-auto w-fit max-w-full rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
          <UserChip
            person={user}
            size="md"
            status={approved ? 'active' : rejected ? 'rejected' : 'pending'}
            statusLabel={rejected ? m.users_approval_rejected() : m.users_approval_pending()}
          />
        </div>

        <div className="sr-only" role="status" aria-live="polite">
          {approved ? m.pa_status_live_approved() : rejected ? m.pa_status_live_rejected() : ''}
        </div>

        <div className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
          <Stepper steps={steps} />
          {!approved && !rejected && confirmation.kind !== 'none' && (
            <ConfirmationEmail
              kind={confirmation.kind}
              email={user.email}
              canResend={confirmation.canResend}
              canContact={confirmation.canContact}
              waiting={confCooling ? confWait : 0}
              pending={resendConfirmation.isPending}
              error={resendConfirmation.isError ? getErrorMessage(resendConfirmation.error) : null}
              onResend={() => resendConfirmation.mutate({})}
            />
          )}
        </div>

        {rejected && (
          <div className="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5">
            {reason && (
              <div className="space-y-1">
                <p className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.14em]">
                  {m.pa_rejected_reason()}
                </p>
                <p className="break-words text-sm leading-relaxed">{reason}</p>
              </div>
            )}
            <p className="text-muted-foreground text-sm">{m.pa_rejected_contact()}</p>
            <Button asChild variant="outline" className="h-11 w-full font-semibold">
              <a
                href={mailtoLink(
                  m.pa_rejected_mail_subject(),
                  m.pa_rejected_mail_body({ email: user.email }),
                )}
              >
                {m.pa_rejected_contact_cta()}
                <span className="sr-only">: {SUPPORT_EMAIL}</span>
              </a>
            </Button>
          </div>
        )}

        {!approved && !rejected && !emailVerified && (
          <div className="flex flex-col gap-3 rounded-2xl border border-areia/50 bg-areia/10 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <MailWarning className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{m.pa_verify_title()}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {m.pa_verify_text({ email: user.email })}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="h-11 w-full font-semibold"
              loading={resend.isPending}
              disabled={cooling}
              onClick={() => resend.mutate({})}
            >
              {cooling ? m.pa_resend_wait({ seconds: wait }) : m.pa_verify_resend()}
            </Button>
          </div>
        )}

        {!approved && !rejected && (
          <div
            className="flex flex-col items-center gap-1 text-center"
            data-testid="approval-checking"
          >
            <p className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse"
              />
              {m.pa_checking()}
            </p>
            {checkedAt && (
              <p className="text-muted-foreground text-xs">{m.pa_checked({ time: checkedAt })}</p>
            )}
            {status.isError && !data && (
              <p role="status" className="flex items-center gap-1.5 text-destructive text-xs">
                <AlertCircle className="size-3.5" aria-hidden="true" />
                {m.pa_check_failed()}
              </p>
            )}
            <Button
              variant="ghost"
              className="h-10"
              loading={status.isFetching}
              onClick={() => void status.refetch()}
            >
              {m.pa_check_now()}
            </Button>
            <p className="text-muted-foreground text-xs">{m.pa_hint()}</p>
          </div>
        )}

        {!approved && (
          <div className="flex flex-col items-center gap-3">
            <Button
              variant="outline"
              className="h-11 w-full font-semibold sm:w-auto sm:min-w-56"
              loading={logout.isPending}
              onClick={() => logout.mutate({})}
            >
              {m.pa_logout()}
            </Button>
            <p className="text-muted-foreground text-sm">
              {m.pa_switch_hint()}{' '}
              <button
                type="button"
                className="inline-flex min-h-10 items-center font-medium text-primary underline underline-offset-4 hover:no-underline"
                onClick={() => logout.mutate({})}
              >
                {m.pa_switch_account()}
              </button>
            </p>
          </div>
        )}
      </main>

      <footer className="relative flex justify-center px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm">
        <LegalLinks />
      </footer>
    </div>
  );
}
