import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import type { AuditEntryOut, UserAdminOut } from '@/client';
import { listAuditOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { EmptyState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserChip } from '@/components/user-chip';
import { formatNumber } from '@/lib/format';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import {
  AUDIT_GROUPS,
  auditActionLabel,
  auditActorText,
  auditDetailRows,
  auditSummary,
  auditTargetPerson,
  auditTargetText,
} from './audit-format';
import { auditActionGroup, auditQuery, displayName } from './logic';

const ANY = '__any__';
const STEP = 100;

const groupLabel = (group: string): string =>
  AUDIT_GROUPS.find((g) => g.prefix === `${group}.`)?.label() ?? group;

function UserSelect({
  label,
  value,
  onChange,
  users,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  users: UserAdminOut[];
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || ANY} onValueChange={(v) => onChange(v === ANY ? '' : v)}>
        <SelectTrigger id={id} className="h-10 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{m.audit_filter_any()}</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              <UserChip person={u} size="xs" variant="inline" />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Auditoria da administração: filtros no servidor (ação, quem, sobre quem, datas) e detalhe legível por linha. */
export function AuditPanel({ users }: { users: UserAdminOut[] }) {
  const actionId = useId();
  const fromId = useId();
  const toId = useId();
  const [action, setAction] = useState('');
  const [actorId, setActorId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(STEP);

  const query = useQuery({
    ...listAuditOptions({ query: auditQuery({ action, actorId, targetId, from, to, limit }) }),
    placeholderData: (previous) => previous,
  });
  const rows = query.data?.items ?? [];
  const filtered = Boolean(action || actorId || targetId || from || to);
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u] as const)), [users]);
  const sortedUsers = [...users].sort((a, b) => displayName(a).localeCompare(displayName(b)));

  const reset = () => {
    setAction('');
    setActorId('');
    setTargetId('');
    setFrom('');
    setTo('');
    setLimit(STEP);
  };
  const touch =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setLimit(STEP);
    };

  const columns: Column<AuditEntryOut>[] = [
    {
      id: 'when',
      type: 'datetime',
      header: m.audit_col_when(),
      className: 'whitespace-nowrap text-muted-foreground',
      value: (e) => e.created_at,
      searchable: false,
      cell: (e) => formatDateTime(e.created_at),
    },
    {
      id: 'action',
      header: m.audit_col_action(),
      primary: true,
      label: m.audit_col_action(),
      value: (e) => e.action,
      exportValue: (e) => `${auditActionLabel(e.action)} (${e.action})`,
      filter: { format: (v) => auditActionLabel(v) },
      cell: (e) => (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="font-medium">{auditActionLabel(e.action)}</span>
          <Badge variant="outline" className="text-[10px] uppercase">
            {groupLabel(auditActionGroup(e.action))}
          </Badge>
        </div>
      ),
    },
    {
      id: 'actor',
      header: m.audit_col_actor(),
      value: (e) => auditActorText(e).name,
      exportValue: (e) => e.actor_email ?? '',
      filter: true,
      cell: (e) => {
        const a = auditActorText(e);
        if (!e.actor_id && !e.actor_name && !e.actor_email) return <span>{a.name}</span>;
        return (
          <UserChip
            person={byId.get(e.actor_id ?? '') ?? { name: e.actor_name, email: e.actor_email }}
            size="sm"
          >
            {a.onBehalf && (
              <p className="truncate text-muted-foreground text-xs" title={a.onBehalf}>
                {a.onBehalf}
              </p>
            )}
          </UserChip>
        );
      },
    },
    {
      id: 'target',
      header: m.audit_col_target(),
      value: (e) => auditTargetText(e),
      filter: false,
      cell: (e) => {
        const person = auditTargetPerson(e, byId);
        return person ? (
          <UserChip person={person} size="sm" />
        ) : (
          <span className="break-words">{auditTargetText(e)}</span>
        );
      },
    },
    {
      id: 'summary',
      header: m.audit_col_summary(),
      value: (e) => auditSummary(e),
      filter: false,
      className: 'text-muted-foreground',
      cell: (e) => <span className="break-words">{auditSummary(e) || m.common_dash()}</span>,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-muted-foreground text-sm leading-relaxed">{m.audit_intro()}</p>
      <fieldset
        aria-label={m.audit_filters_label()}
        className="grid gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:grid-cols-2 sm:p-4 lg:grid-cols-5"
      >
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={actionId}>{m.audit_filter_action()}</Label>
          <Select value={action || ANY} onValueChange={(v) => touch(setAction)(v === ANY ? '' : v)}>
            <SelectTrigger id={actionId} className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{m.audit_filter_all()}</SelectItem>
              {AUDIT_GROUPS.map((g) => (
                <SelectGroup key={g.prefix}>
                  <SelectLabel>{g.label()}</SelectLabel>
                  <SelectItem value={g.prefix}>{g.all()}</SelectItem>
                  {g.actions.map((a) => (
                    <SelectItem key={a} value={a}>
                      {auditActionLabel(a)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        <UserSelect
          label={m.audit_filter_actor()}
          value={actorId}
          onChange={touch(setActorId)}
          users={sortedUsers}
        />
        <UserSelect
          label={m.audit_filter_target()}
          value={targetId}
          onChange={touch(setTargetId)}
          users={sortedUsers}
        />
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={fromId}>{m.audit_filter_from()}</Label>
          <Input
            id={fromId}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => touch(setFrom)(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={toId}>{m.audit_filter_to()}</Label>
          <Input
            id={toId}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => touch(setTo)(e.target.value)}
            className="h-10"
          />
        </div>
        {filtered && (
          <div className="sm:col-span-2 lg:col-span-5">
            <Button type="button" variant="ghost" size="sm" className="h-10 sm:h-8" onClick={reset}>
              <X aria-hidden="true" />
              {m.audit_filter_clear()}
            </Button>
          </div>
        )}
      </fieldset>
      <DataTable
        id="audit"
        exportName="auditoria"
        columns={columns}
        rows={rows}
        getRowId={(e) => e.id}
        caption={m.audit_title()}
        searchLabel={m.users_search()}
        loading={query.isPending}
        refreshing={query.isFetching && !query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        initialSort={{ id: 'when', desc: true }}
        empty={<EmptyState title={m.audit_empty_title()} description={m.audit_empty_text()} />}
        renderExpanded={(e) => (
          <dl className="grid gap-x-6 gap-y-1.5 px-4 py-3 text-sm sm:grid-cols-[max-content_1fr]">
            {auditDetailRows(e).map((row) => (
              <div key={`${row.label}-${row.value}`} className="contents">
                <dt className="font-medium text-muted-foreground">{row.label}</dt>
                <dd className="min-w-0 break-words">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      />
      {query.data && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            {m.audit_showing({
              shown: formatNumber(rows.length),
              total: formatNumber(query.data.total),
            })}
          </p>
          {query.data.total > rows.length && (
            <Button
              variant="outline"
              className="h-10 sm:h-8"
              onClick={() => setLimit((l) => Math.min(200, l + STEP))}
              disabled={limit >= 200}
            >
              {m.audit_more()}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
