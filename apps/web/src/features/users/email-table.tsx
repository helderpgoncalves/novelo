import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { EmailDeliveryOut } from '@/client';
import { listEmailsOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserChip } from '@/components/user-chip';
import { formatNumber } from '@/lib/format';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { DeliveryBadge } from './delivery-badge';
import {
  DELIVERY_META,
  type EmailTemplate,
  errorText,
  STATUS_ORDER,
  TEMPLATE_ORDER,
  templateLabel,
} from './email-logic';

const PAGE = 25;
const ANY = '__any__';

type Status = Exclude<EmailDeliveryOut['status'], never>;
const isStatus = (value: string): value is Status => (STATUS_ORDER as string[]).includes(value);
const isTemplate = (value: string): value is EmailTemplate =>
  (TEMPLATE_ORDER as string[]).includes(value);

/** Espera `delay` ms depois da última alteração (a pesquisa só vai ao servidor quando se pára de escrever). */
function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * Todos os envios, com filtros e paginação no servidor (estado, tipo e pesquisa por email). O `q` vive na URL
 * para se poder partilhar a ligação «ver emails deste convite».
 */
export function EmailTable({ q, onQChange }: { q: string; onQChange: (q: string) => void }) {
  const searchId = useId();
  const statusId = useId();
  const templateId = useId();
  const [text, setText] = useState(q);
  const [status, setStatus] = useState('');
  const [template, setTemplate] = useState('');
  const [offset, setOffset] = useState(0);
  const debounced = useDebounced(text.trim());

  // A URL manda quando muda de fora (ex.: «Ver emails deste convite»); o que nós próprios escrevemos não a repõe.
  const emitted = useRef(q.trim());
  useEffect(() => {
    if (q.trim() !== emitted.current) {
      emitted.current = q.trim();
      setText(q);
    }
  }, [q]);
  const notify = useRef(onQChange);
  notify.current = onQChange;
  useEffect(() => {
    if (debounced !== emitted.current) {
      emitted.current = debounced;
      notify.current(debounced);
    }
  }, [debounced]);
  // Qualquer filtro novo volta à primeira página.
  // biome-ignore lint/correctness/useExhaustiveDependencies: o efeito só reage às mudanças dos filtros
  useEffect(() => setOffset(0), [debounced, status, template]);

  const query = useQuery({
    ...listEmailsOptions({
      query: {
        limit: PAGE,
        offset,
        status: isStatus(status) ? status : undefined,
        template: isTemplate(template) ? template : undefined,
        q: debounced || undefined,
      },
    }),
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  });
  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const filtered = Boolean(status || template || debounced || text);

  const columns: Column<EmailDeliveryOut>[] = [
    {
      id: 'to',
      header: m.email_table_recipient(),
      label: m.email_table_recipient(),
      primary: true,
      value: (e) => e.to_email,
      cell: (e) => <UserChip person={{ email: e.to_email }} />,
    },
    {
      id: 'template',
      header: m.email_table_template(),
      value: (e) => e.template,
      exportValue: (e) => templateLabel(e.template),
      filter: { format: (v) => templateLabel(v as EmailTemplate) },
      cell: (e) => templateLabel(e.template),
    },
    {
      id: 'status',
      header: m.email_table_status(),
      label: m.email_table_status(),
      badge: true,
      value: (e) => e.status,
      exportValue: (e) => DELIVERY_META[e.status].label(),
      filter: { format: (v) => DELIVERY_META[v as Status].label() },
      cell: (e) => (
        <DeliveryBadge status={e.status} at={e.updated_at} error={e.error_code} showError={false} />
      ),
    },
    {
      id: 'attempts',
      type: 'number',
      header: m.email_table_attempts(),
      align: 'right',
      value: (e) => e.attempts,
      cell: (e) => formatNumber(e.attempts),
    },
    {
      id: 'created',
      type: 'datetime',
      header: m.email_table_created(),
      className: 'text-muted-foreground',
      value: (e) => e.created_at,
      searchable: false,
      cell: (e) => formatDateTime(e.created_at),
    },
    {
      id: 'sent',
      type: 'datetime',
      header: m.email_table_sent(),
      className: 'text-muted-foreground',
      defaultHidden: true,
      value: (e) => e.sent_at,
      searchable: false,
      cell: (e) => (e.sent_at ? formatDateTime(e.sent_at) : m.common_dash()),
    },
    {
      id: 'delivered',
      type: 'datetime',
      header: m.email_table_delivered(),
      className: 'text-muted-foreground',
      value: (e) => e.delivered_at,
      searchable: false,
      cell: (e) => (e.delivered_at ? formatDateTime(e.delivered_at) : m.common_dash()),
    },
    {
      id: 'error',
      header: m.email_table_error(),
      full: true,
      value: (e) => e.error_code,
      exportValue: (e) => (e.error_code ? `${errorText(e.error_code)} (${e.error_code})` : ''),
      filter: false,
      cell: (e) =>
        e.error_code ? (
          <span className="break-words text-muted-foreground text-xs leading-snug">
            {errorText(e.error_code)}
          </span>
        ) : (
          m.common_dash()
        ),
    },
    {
      id: 'provider',
      header: m.email_table_message_id(),
      defaultHidden: true,
      value: (e) => e.provider_message_id,
      filter: false,
      cell: (e) => (
        <span className="break-all font-mono text-xs">
          {e.provider_message_id ?? m.common_dash()}
        </span>
      ),
    },
  ];

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE, total);

  return (
    <div className="space-y-3">
      <fieldset
        aria-label={m.email_filters_label()}
        className="grid gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:grid-cols-2 sm:p-4 lg:grid-cols-3"
      >
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={searchId}>{m.email_filter_search()}</Label>
          <Input
            id={searchId}
            type="search"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={text}
            placeholder={m.email_filter_search_placeholder()}
            onChange={(e) => setText(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={statusId}>{m.email_filter_status()}</Label>
          <Select value={status || ANY} onValueChange={(v) => setStatus(v === ANY ? '' : v)}>
            <SelectTrigger id={statusId} className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{m.email_filter_all_status()}</SelectItem>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {DELIVERY_META[s].label()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={templateId}>{m.email_filter_template()}</Label>
          <Select value={template || ANY} onValueChange={(v) => setTemplate(v === ANY ? '' : v)}>
            <SelectTrigger id={templateId} className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{m.email_filter_all_templates()}</SelectItem>
              {TEMPLATE_ORDER.map((t) => (
                <SelectItem key={t} value={t}>
                  {templateLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filtered && (
          <div className="sm:col-span-2 lg:col-span-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 sm:h-8"
              onClick={() => {
                setText('');
                setStatus('');
                setTemplate('');
                emitted.current = '';
                onQChange('');
              }}
            >
              <X aria-hidden="true" />
              {m.email_filter_clear()}
            </Button>
          </div>
        )}
      </fieldset>
      <DataTable
        id="emails"
        exportName="emails"
        columns={columns}
        rows={rows}
        getRowId={(e) => e.id}
        caption={m.email_table_title()}
        searchLabel={m.email_filter_search()}
        pageSize={PAGE}
        loading={query.isPending}
        refreshing={query.isFetching && !query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        initialSort={{ id: 'created', desc: true }}
        empty={
          <EmptyState
            title={m.email_table_empty_title()}
            description={m.email_table_empty_text()}
          />
        }
      />
      {query.data && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs" aria-live="polite">
            {m.email_showing({
              from: formatNumber(from),
              to: formatNumber(to),
              total: formatNumber(total),
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-10 sm:h-8"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE))}
            >
              <ChevronLeft aria-hidden="true" />
              {m.email_page_prev()}
            </Button>
            <Button
              variant="outline"
              className="h-10 sm:h-8"
              disabled={offset + PAGE >= total}
              onClick={() => setOffset(offset + PAGE)}
            >
              {m.email_page_next()}
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
