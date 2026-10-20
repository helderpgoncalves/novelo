import { useInfiniteQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import type { HistoryItem } from '@/client';
import { listCopilotHistoryInfiniteOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDateTime } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { plainText } from './markdown';

type Kind = HistoryItem['kind'];
const KINDS: Kind[] = ['conversation', 'action', 'artifact', 'memory', 'attachment'];

export const historyKindLabel: Record<Kind, () => string> = {
  conversation: () => m.chat_kind_conversation(),
  action: () => m.chat_kind_action(),
  artifact: () => m.chat_kind_artifact(),
  memory: () => m.chat_kind_memory(),
  attachment: () => m.chat_kind_attachment(),
};

export type ChatTab = 'chat' | 'history' | 'artifacts' | 'actions' | 'settings';

/** Cronologia completa (conversas, ações, artefactos, memórias e anexos) com cursor estável. */
export function HistoryTab({
  onOpenThread,
  onGo,
}: {
  onOpenThread: (id: string) => void;
  onGo: (tab: ChatTab) => void;
}) {
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');

  const history = useInfiniteQuery({
    ...listCopilotHistoryInfiniteOptions({
      query: {
        q: q || undefined,
        kinds: kinds.length ? kinds : undefined,
        since: since ? `${since}T00:00:00Z` : undefined,
        until: until ? `${until}T23:59:59Z` : undefined,
        limit: 30,
      },
    }),
    // Um objeto vazio (não `null`): o cliente gerado trata `null` como um objeto de parâmetros.
    initialPageParam: {},
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const rows = history.data?.pages.flatMap((p) => p.items) ?? [];

  const open = (item: HistoryItem) => {
    if (item.kind === 'conversation' || item.kind === 'attachment') {
      const id = item.thread_id ?? item.ref_id;
      onOpenThread(id);
    } else if (item.kind === 'action') onGo('actions');
    else if (item.kind === 'artifact') onGo('artifacts');
    else onGo('settings');
  };

  const columns: Column<HistoryItem>[] = [
    {
      id: 'title',
      header: m.chat_col_title(),
      cell: (r) => (
        <span className="block max-w-xl space-y-0.5">
          <span className="block font-medium">{r.title}</span>
          {r.snippet && (
            <span className="line-clamp-2 block text-muted-foreground text-xs">
              {plainText(r.snippet)}
            </span>
          )}
        </span>
      ),
      value: (r) => `${r.title} ${r.snippet ?? ''}`,
      primary: true,
      hideable: false,
    },
    {
      id: 'kind',
      header: m.chat_col_kind(),
      cell: (r) => <Badge variant="secondary">{historyKindLabel[r.kind]()}</Badge>,
      value: (r) => r.kind,
      filter: { format: (v) => historyKindLabel[v as Kind]?.() ?? v },
      badge: true,
    },
    {
      id: 'status',
      header: m.chat_col_status(),
      cell: (r) => r.status ?? m.common_dash(),
      value: (r) => r.status,
      filter: true,
      defaultHidden: true,
    },
    {
      id: 'when',
      header: m.chat_col_when(),
      cell: (r) => formatDateTime(r.occurred_at),
      value: (r) => r.occurred_at,
    },
    {
      id: 'open',
      header: m.chat_col_open(),
      label: m.chat_col_open(),
      cell: (r) => (
        <Button variant="outline" size="sm" className="h-10 sm:h-8" onClick={() => open(r)}>
          {m.chat_open()}
        </Button>
      ),
      full: true,
      sortable: false,
    },
  ];

  return (
    <div className="space-y-4" data-testid="copilot-history">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <Search
            className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={m.chat_search_history()}
            aria-label={m.chat_search_history()}
            className="h-11 pl-9 text-base md:text-base"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="history-since" className="text-muted-foreground">
            {m.chat_since()}
          </label>
          <Input
            id="history-since"
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="h-11 w-auto text-base md:text-base"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="history-until" className="text-muted-foreground">
            {m.chat_until()}
          </label>
          <Input
            id="history-until"
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="h-11 w-auto text-base md:text-base"
          />
        </div>
      </div>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">{m.chat_col_kind()}</legend>
        {KINDS.map((k) => {
          const on = kinds.includes(k);
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => setKinds((prev) => (on ? prev.filter((x) => x !== k) : [...prev, k]))}
              className={cn(
                'min-h-10 rounded-full border px-3.5 text-sm transition-colors',
                on ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted',
              )}
            >
              {historyKindLabel[k]()}
            </button>
          );
        })}
      </fieldset>

      {history.isPending ? (
        <p role="status" className="py-10 text-center text-muted-foreground text-sm">
          {m.chat_loading_history()}
        </p>
      ) : history.error ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={m.chat_history_empty()} description={m.chat_history_empty_hint()} />
      ) : (
        <>
          <DataTable
            id="copilot-history"
            columns={columns}
            rows={rows}
            getKey={(r) => r.id}
            controls="always"
            pageSize={15}
            initialSort={{ id: 'when', desc: true }}
          />
          {history.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="h-11"
                loading={history.isFetchingNextPage}
                onClick={() => void history.fetchNextPage()}
              >
                {m.chat_load_more()}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
