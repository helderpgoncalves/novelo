import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  CheckCircle2,
  FileText,
  MailWarning,
  MessageCircle,
  PackageOpen,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  UserCheck,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  getDataQualityOptions,
  getUsersSummaryOptions,
  listCopilotThreadsOptions,
  listEmailsOptions,
  listLotsOptions,
  listReportsOptions,
  listScenariosOptions,
} from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { openCopilot } from '@/features/copilot/store';
import { formatDate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { newestFirst } from './recent';
import { eur, tonnes } from './safe';

type Role = 'admin' | 'operator' | 'guest';

interface StepProps {
  icon: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  /** Contador à esquerda; sem ele, aparece o ícone. */
  count?: number;
  tone?: 'action' | 'ok';
  actions?: ReactNode;
}

function Step({ icon, title, hint, count, tone = 'action', actions }: StepProps) {
  return (
    <li className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-lg font-semibold tabular-nums',
          tone === 'action' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        {count !== undefined ? count : icon}
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="font-medium text-[15px] leading-snug">{title}</p>
        {hint && <p className="text-[13px] text-muted-foreground leading-snug">{hint}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </li>
  );
}

function StepSkeleton() {
  return (
    <li className="flex min-h-14 items-center gap-3 py-3" aria-hidden="true">
      <Skeleton className="size-10 rounded-lg" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </li>
  );
}

function StepError({ onRetry }: { onRetry: () => unknown }) {
  return (
    <Step
      tone="ok"
      icon={<RefreshCw className="size-4" aria-hidden="true" />}
      title={m.home_steps_error()}
      actions={
        <Button variant="outline" size="sm" className="h-10" onClick={() => void onRetry()}>
          {m.common_retry()}
        </Button>
      }
    />
  );
}

/** Estados de um pedido não crítico: esqueleto, erro com repetição e, quando pronto, a linha. */
function Query<T>({
  query,
  children,
}: {
  query: UseQueryResult<T, unknown>;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <StepSkeleton />;
  if (query.isError || query.data === undefined) return <StepError onRetry={query.refetch} />;
  return <>{children(query.data)}</>;
}

const BTN = { size: 'sm', className: 'h-10' } as const;

function AccountsStep() {
  const q = useQuery({ ...getUsersSummaryOptions(), staleTime: 60_000 });
  return (
    <Query query={q}>
      {(s) =>
        s.pending_approvals > 0 ? (
          <Step
            count={s.pending_approvals}
            icon={null}
            title={m.home_steps_accounts({ count: s.pending_approvals })}
            hint={m.home_steps_accounts_hint()}
            actions={
              <Button asChild {...BTN}>
                <Link to="/users" search={{ tab: 'accounts', view: 'pending' }}>
                  {m.home_steps_review()}
                </Link>
              </Button>
            }
          />
        ) : (
          <Step
            tone="ok"
            icon={<UserCheck className="size-4" aria-hidden="true" />}
            title={m.home_steps_accounts_none()}
          />
        )
      }
    </Query>
  );
}

/** Falhas de entrega de email (só admin): se o pedido falha ou não há falhas, a linha não aparece. */
function EmailFailuresStep() {
  const failed = useQuery({
    ...listEmailsOptions({ query: { status: 'failed', limit: 1 } }),
    staleTime: 60_000,
    retry: false,
  });
  const bounced = useQuery({
    ...listEmailsOptions({ query: { status: 'bounced', limit: 1 } }),
    staleTime: 60_000,
    retry: false,
  });
  const count = (failed.data?.total ?? 0) + (bounced.data?.total ?? 0);
  if (count === 0) return null;
  return (
    <Step
      count={count}
      icon={<MailWarning className="size-4" aria-hidden="true" />}
      title={m.home_steps_emails({ count })}
      hint={m.home_steps_emails_hint()}
      actions={
        <Button asChild {...BTN}>
          <Link to="/users" search={{ tab: 'invitations' }}>
            {m.home_steps_review()}
          </Link>
        </Button>
      }
    />
  );
}

function QualityStep() {
  const q = useQuery({ ...getDataQualityOptions(), staleTime: 60_000 });
  return (
    <Query query={q}>
      {(d) =>
        d.open_alerts > 0 ? (
          <Step
            count={d.open_alerts}
            icon={null}
            title={m.home_steps_quality({ count: d.open_alerts })}
            hint={m.home_steps_quality_hint()}
            actions={
              <Button asChild {...BTN}>
                <Link to="/data-quality">{m.home_steps_review()}</Link>
              </Button>
            }
          />
        ) : (
          <Step
            tone="ok"
            icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
            title={m.home_steps_quality_none()}
          />
        )
      }
    </Query>
  );
}

function ScenariosStep() {
  const q = useQuery({ ...listScenariosOptions(), staleTime: 60_000 });
  return (
    <Query query={q}>
      {(list) => {
        const sorted = newestFirst(list, (s) => s.created_at);
        const [last, previous] = sorted;
        if (!last)
          return (
            <Step
              icon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
              title={m.home_steps_scenarios_none()}
              hint={m.home_steps_scenarios_none_hint()}
              actions={
                <Button asChild {...BTN}>
                  <Link to="/simulator">{m.home_steps_create()}</Link>
                </Button>
              }
            />
          );
        return (
          <Step
            count={sorted.length}
            icon={null}
            title={m.home_steps_scenarios_last({ label: last.label })}
            hint={`${tonnes(last.tonnes_year, 0)} · ${eur(last.annual_cost_eur)} · ${formatDate(last.created_at, 'medium')}`}
            actions={
              <>
                <Button asChild variant="outline" {...BTN}>
                  <Link to="/scenarios/$scenarioId" params={{ scenarioId: last.id }}>
                    {m.home_steps_open()}
                  </Link>
                </Button>
                {previous && (
                  <Button asChild {...BTN}>
                    <Link to="/scenarios/compare" search={{ a: previous.id, b: last.id }}>
                      {m.home_steps_compare()}
                    </Link>
                  </Button>
                )}
              </>
            }
          />
        );
      }}
    </Query>
  );
}

function ReportStep() {
  const q = useQuery({ ...listReportsOptions(), staleTime: 60_000 });
  return (
    <Query query={q}>
      {(list) => {
        const last = newestFirst(list, (r) => r.created_at)[0];
        return (
          <Step
            icon={<FileText className="size-4" aria-hidden="true" />}
            tone={last ? 'ok' : 'action'}
            title={
              last ? m.home_steps_report_last({ title: last.title }) : m.home_steps_report_none()
            }
            hint={last ? formatDate(last.created_at, 'medium') : m.home_steps_report_none_hint()}
            actions={
              <Button asChild {...BTN}>
                <Link to="/reports">{m.home_steps_generate()}</Link>
              </Button>
            }
          />
        );
      }}
    </Query>
  );
}

function LotsStep() {
  const q = useQuery({ ...listLotsOptions(), staleTime: 60_000 });
  return (
    <Query query={q}>
      {(list) => {
        const open = list.filter((l) => l.state !== 'delivered');
        return (
          <Step
            count={open.length > 0 ? open.length : undefined}
            icon={<PackageOpen className="size-4" aria-hidden="true" />}
            tone={open.length > 0 ? 'action' : 'ok'}
            title={
              open.length > 0 ? m.home_steps_lots({ count: open.length }) : m.home_steps_lots_none()
            }
            hint={m.home_steps_lots_hint({ total: list.length })}
            actions={
              <Button asChild {...BTN}>
                <Link to="/lots">{m.home_steps_open()}</Link>
              </Button>
            }
          />
        );
      }}
    </Query>
  );
}

function ChatStep() {
  const q = useQuery({
    ...listCopilotThreadsOptions({ query: { limit: 1 } }),
    staleTime: 60_000,
  });
  return (
    <Query query={q}>
      {(page) => {
        const last = page.items[0];
        if (!last) return null;
        return (
          <Step
            icon={<MessageCircle className="size-4" aria-hidden="true" />}
            tone="ok"
            title={m.home_steps_chat({ title: last.title })}
            hint={formatDate(last.updated_at, 'medium')}
            actions={
              <Button variant="outline" {...BTN} onClick={() => openCopilot({ threadId: last.id })}>
                {m.home_steps_continue()}
              </Button>
            }
          />
        );
      }}
    </Query>
  );
}

/**
 * O que fazer a seguir, por papel e estado. Cada linha pede os seus dados e carrega por si: nenhuma bloqueia o primeiro
 * desenho nem derruba as outras. Admin vê contas e falhas de email; operadores e admin veem qualidade dos dados.
 */
export function NextSteps({
  role,
  textileLocationsMissing,
}: {
  role: Role;
  textileLocationsMissing: boolean;
}) {
  const staff = role === 'admin' || role === 'operator';
  return (
    <ul className="divide-y divide-border">
      {role === 'admin' && <AccountsStep />}
      {role === 'admin' && <EmailFailuresStep />}
      {staff && <QualityStep />}
      {staff && textileLocationsMissing && (
        <Step
          icon={<ShieldAlert className="size-4" aria-hidden="true" />}
          title={m.home_steps_locations()}
          hint={m.home_steps_locations_hint()}
          actions={
            <Button asChild variant="outline" {...BTN}>
              <Link to="/data-quality" search={{ tab: 'sources' }}>
                {m.home_steps_review()}
              </Link>
            </Button>
          }
        />
      )}
      <ScenariosStep />
      {staff && <ReportStep />}
      <LotsStep />
      <ChatStep />
    </ul>
  );
}
