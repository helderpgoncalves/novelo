import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Pin, PinOff, Plus, Search, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { MemoryEntryOut, MemoryMeter, PendingMemoryOut } from '@/client';
import {
  approvePendingMemoryMutation,
  clearCopilotMemoryMutation,
  createCopilotMemoryEntryMutation,
  deleteCopilotMemoryEntryMutation,
  listCopilotMemoryEntriesOptions,
  listPendingMemoryOptions,
  rejectPendingMemoryMutation,
  searchCopilotSessionsOptions,
  updateCopilotMemoryEntryMutation,
} from '@/client/@tanstack/react-query.gen';
import { Panel } from '@/components/panel';
import { EmptyState, ErrorState } from '@/components/states';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { invalidateCopilot } from '../cache';
import { SELECT_CLASS, ToggleRow } from './setting-row';
import { useCopilotSettings } from './use-settings';

type Target = 'memory' | 'user';

const targetTitle: Record<Target, () => string> = {
  memory: () => m.chat_memory_target_memory(),
  user: () => m.chat_memory_target_user(),
};
const targetHint: Record<Target, () => string> = {
  memory: () => m.chat_memory_target_memory_hint(),
  user: () => m.chat_memory_target_user_hint(),
};

function Meter({ meter }: { meter?: MemoryMeter }) {
  if (!meter) return null;
  return (
    <div className="space-y-1">
      <Progress value={Math.min(100, meter.pct)} aria-label={m.chat_memory_usage()} />
      <p className="text-muted-foreground text-xs tabular-nums">
        {m.chat_memory_usage_text({
          pct: formatNumber(meter.pct),
          chars: formatNumber(meter.chars),
          limit: formatNumber(meter.limit),
        })}
      </p>
    </div>
  );
}

function Entry({ entry }: { entry: MemoryEntryOut }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.content);
  const done = () => {
    setEditing(false);
    void invalidateCopilot(qc, /Memory|Settings/);
  };
  const fail = (e: unknown) => toast.error(getErrorMessage(e));
  const update = useMutation({
    ...updateCopilotMemoryEntryMutation(),
    onSuccess: done,
    onError: fail,
  });
  const remove = useMutation({
    ...deleteCopilotMemoryEntryMutation(),
    onSuccess: done,
    onError: fail,
  });
  return (
    <li className="space-y-2 py-3" data-testid="copilot-memory-entry">
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label={m.chat_memory_edit()}
            className="min-h-20 text-base md:text-base"
            maxLength={600}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-10"
              loading={update.isPending}
              disabled={!text.trim() || text === entry.content}
              onClick={() =>
                update.mutate({ path: { entry_id: entry.id }, body: { content: text.trim() } })
              }
            >
              {m.common_save()}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-10"
              onClick={() => {
                setEditing(false);
                setText(entry.content);
              }}
            >
              {m.common_cancel()}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">{entry.content}</p>
          <div className="flex shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              aria-pressed={entry.pinned}
              aria-label={entry.pinned ? m.chat_unpin() : m.chat_pin()}
              onClick={() =>
                update.mutate({ path: { entry_id: entry.id }, body: { pinned: !entry.pinned } })
              }
            >
              {entry.pinned ? (
                <PinOff className="size-4" aria-hidden="true" />
              ) : (
                <Pin className="size-4" aria-hidden="true" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              aria-label={m.chat_memory_edit()}
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              aria-label={m.chat_memory_delete()}
              loading={remove.isPending}
              onClick={() => remove.mutate({ path: { entry_id: entry.id } })}
            >
              {!remove.isPending && <Trash2 className="size-4" aria-hidden="true" />}
            </Button>
          </div>
        </div>
      )}
      <p className="text-muted-foreground text-[11px]">
        {entry.origin === 'manual'
          ? m.chat_memory_origin_manual()
          : entry.origin === 'tool'
            ? m.chat_memory_origin_tool()
            : m.chat_memory_origin_auto()}
        {' · '}
        {formatDateTime(entry.updated_at)}
        {entry.pinned && (
          <Badge variant="outline" className="ml-2 px-1.5 py-0 text-[10px]">
            {m.chat_pinned()}
          </Badge>
        )}
      </p>
    </li>
  );
}

function MemoryBlock({
  target,
  entries,
  meter,
}: {
  target: Target;
  entries: MemoryEntryOut[];
  meter?: MemoryMeter;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const done = () => void invalidateCopilot(qc, /Memory|Settings/);
  const fail = (e: unknown) => toast.error(getErrorMessage(e));
  const create = useMutation({
    ...createCopilotMemoryEntryMutation(),
    onSuccess: () => {
      setDraft('');
      done();
    },
    onError: fail,
  });
  const clear = useMutation({
    ...clearCopilotMemoryMutation(),
    onSuccess: () => {
      setConfirmClear(false);
      done();
    },
    onError: fail,
  });
  return (
    <Panel
      title={targetTitle[target]()}
      description={targetHint[target]()}
      aside={
        entries.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 text-destructive"
            onClick={() => setConfirmClear(true)}
          >
            {m.chat_memory_clear()}
          </Button>
        ) : undefined
      }
    >
      <div data-testid={`copilot-memory-${target}`}>
        <Meter meter={meter} />
        {entries.length === 0 ? (
          <p className="py-4 text-muted-foreground text-sm">{m.chat_memory_empty()}</p>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => (
              <Entry key={e.id} entry={e} />
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) create.mutate({ body: { target, content: draft.trim() } });
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={m.chat_memory_add_placeholder()}
            aria-label={`${m.chat_memory_add()} — ${targetTitle[target]()}`}
            maxLength={600}
            className="h-11 text-base md:text-base"
          />
          <Button
            type="submit"
            className="h-11 shrink-0 gap-1.5"
            loading={create.isPending}
            disabled={!draft.trim()}
          >
            {!create.isPending && <Plus className="size-4" aria-hidden="true" />}
            {m.chat_memory_add()}
          </Button>
        </form>
      </div>
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {m.chat_memory_clear_title({ target: targetTitle[target]() })}
            </AlertDialogTitle>
            <AlertDialogDescription>{m.chat_memory_clear_description()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10">{m.common_cancel()}</AlertDialogCancel>
            <Button
              variant="destructive"
              className="h-10"
              loading={clear.isPending}
              onClick={() => clear.mutate({ query: { target } })}
            >
              {m.chat_memory_clear()}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}

function PendingItem({ item }: { item: PendingMemoryOut }) {
  const qc = useQueryClient();
  // Só um `add` isolado se pode editar antes de aprovar (as outras operações aplicam-se como estão).
  const [op] = item.ops;
  const editable = item.ops.length === 1 && op?.action === 'add';
  const original = editable ? (op?.content ?? item.summary) : item.summary;
  const [text, setText] = useState(original);
  const [editing, setEditing] = useState(false);
  const fail = (e: unknown) => toast.error(getErrorMessage(e));
  const approve = useMutation({
    ...approvePendingMemoryMutation(),
    onSuccess: (res) => {
      // O servidor devolve a proposta ainda "pendente" quando a nota já não cabe ou o texto mudou.
      if (res.status === 'pending') toast.error(m.chat_memory_apply_failed());
      void invalidateCopilot(qc, /Memory|Pending|Settings/);
    },
    onError: fail,
  });
  const reject = useMutation({
    ...rejectPendingMemoryMutation(),
    onSuccess: () => void invalidateCopilot(qc, /Memory|Pending|Settings/),
    onError: fail,
  });
  return (
    <li className="space-y-2 py-3" data-testid="copilot-memory-pending">
      {editing ? (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={m.chat_memory_edit()}
          maxLength={600}
          className="min-h-20 text-base md:text-base"
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm">{item.summary}</p>
      )}
      <p className="text-muted-foreground text-[11px]">
        {targetTitle[item.target]()} · {formatDateTime(item.created_at)}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="h-10 gap-1.5"
          loading={approve.isPending}
          onClick={() =>
            approve.mutate({
              path: { pending_id: item.id },
              body: { content: editing && text.trim() !== original ? text.trim() : null },
            })
          }
        >
          {!approve.isPending && <Check className="size-4" aria-hidden="true" />}
          {m.chat_memory_approve()}
        </Button>
        {editable && (
          <Button
            size="sm"
            variant="outline"
            className="h-10"
            onClick={() => setEditing((e) => !e)}
          >
            {m.chat_memory_edit()}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-10 gap-1.5"
          loading={reject.isPending}
          onClick={() => reject.mutate({ path: { pending_id: item.id } })}
        >
          {!reject.isPending && <X className="size-4" aria-hidden="true" />}
          {m.chat_memory_reject()}
        </Button>
      </div>
    </li>
  );
}

function SessionSearch({ onOpenThread }: { onOpenThread: (id: string) => void }) {
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const results = useQuery({
    ...searchCopilotSessionsOptions({ query: { q: term, limit: 8 } }),
    enabled: term.length >= 2,
  });
  return (
    <Panel title={m.chat_sessions_title()} description={m.chat_sessions_description()}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(input.trim());
        }}
      >
        <Input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label={m.chat_sessions_title()}
          placeholder={m.chat_sessions_placeholder()}
          className="h-11 text-base md:text-base"
        />
        <Button
          type="submit"
          variant="outline"
          className="h-11 shrink-0 gap-1.5"
          disabled={input.trim().length < 2}
        >
          <Search className="size-4" aria-hidden="true" />
          {m.chat_sessions_search()}
        </Button>
      </form>
      {term.length >= 2 &&
        (results.isPending ? (
          <p role="status" className="text-muted-foreground text-sm">
            {m.chat_sessions_searching()}
          </p>
        ) : results.error ? (
          <ErrorState error={results.error} onRetry={() => void results.refetch()} />
        ) : results.data && results.data.hits.length === 0 ? (
          <p className="text-muted-foreground text-sm">{m.chat_no_results()}</p>
        ) : (
          <ul className="divide-y">
            {results.data?.hits.map((h) => (
              <li key={h.message_id} className="py-2.5">
                <button
                  type="button"
                  className="w-full min-w-0 space-y-0.5 text-left hover:text-primary"
                  onClick={() => onOpenThread(h.thread_id)}
                >
                  <span className="block truncate font-medium text-sm">{h.thread_title}</span>
                  <span className="line-clamp-2 block text-muted-foreground text-xs">
                    {h.snippet}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {formatDateTime(h.occurred_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </Panel>
  );
}

/** Memória estilo Hermes: duas notas pequenas editáveis, aprovações pendentes e pesquisa nas conversas antigas. */
export function MemorySection({ onOpenThread }: { onOpenThread: (id: string) => void }) {
  const { query: settings, save } = useCopilotSettings();
  const entries = useQuery(listCopilotMemoryEntriesOptions());
  const pending = useQuery(listPendingMemoryOptions());
  const s = settings.data;

  if (settings.isPending || entries.isPending) {
    return (
      <p role="status" className="py-10 text-center text-muted-foreground text-sm">
        {m.chat_loading_settings()}
      </p>
    );
  }
  if (settings.error || entries.error || !s || !entries.data) {
    return (
      <ErrorState
        error={settings.error ?? entries.error}
        onRetry={() => {
          void settings.refetch();
          void entries.refetch();
        }}
      />
    );
  }
  const by = (t: Target) => entries.data.items.filter((e) => e.target === t);
  const waiting = (pending.data ?? []).filter((p) => p.status === 'pending');

  return (
    <div className="space-y-5">
      <Panel title={m.chat_memory_title()} description={m.chat_memory_description()}>
        <div className="divide-y">
          <ToggleRow
            id="set-memory"
            label={m.chat_set_memory()}
            hint={m.chat_set_memory_hint()}
            checked={s.memory_enabled ?? true}
            onChange={(v) => save({ memory_enabled: v })}
          />
          <ToggleRow
            id="set-profile"
            label={m.chat_set_profile()}
            hint={m.chat_set_profile_hint()}
            checked={s.user_profile_enabled ?? true}
            onChange={(v) => save({ user_profile_enabled: v })}
          />
          <ToggleRow
            id="set-approval"
            label={m.chat_set_approval()}
            hint={m.chat_set_approval_hint()}
            checked={s.write_approval === 'ask'}
            onChange={(v) => save({ write_approval: v ? 'ask' : 'auto' })}
          />
          <ToggleRow
            id="set-review"
            label={m.chat_set_review()}
            hint={m.chat_set_review_hint()}
            checked={s.background_review ?? true}
            onChange={(v) => save({ background_review: v })}
          />
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1 basis-56">
              <label htmlFor="set-notifications" className="font-medium text-sm">
                {m.chat_set_notifications()}
              </label>
              <p className="text-muted-foreground text-xs">{m.chat_set_notifications_hint()}</p>
            </div>
            <select
              id="set-notifications"
              className={SELECT_CLASS}
              value={s.memory_notifications ?? 'on'}
              onChange={(e) =>
                save({ memory_notifications: e.target.value as 'off' | 'on' | 'verbose' })
              }
            >
              <option value="off">{m.chat_notif_off()}</option>
              <option value="on">{m.chat_notif_on()}</option>
              <option value="verbose">{m.chat_notif_verbose()}</option>
            </select>
          </div>
        </div>
      </Panel>

      <Panel title={m.chat_pending_title()} description={m.chat_pending_description()}>
        {pending.isPending ? (
          <p role="status" className="text-muted-foreground text-sm">
            {m.chat_loading_settings()}
          </p>
        ) : waiting.length === 0 ? (
          <EmptyState title={m.chat_pending_empty()} />
        ) : (
          <ul className="divide-y" data-testid="copilot-pending-list">
            {waiting.map((p) => (
              <PendingItem key={p.id} item={p} />
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <MemoryBlock
          target="memory"
          entries={by('memory')}
          meter={entries.data.usage.memory ?? s.memory_usage.memory}
        />
        <MemoryBlock
          target="user"
          entries={by('user')}
          meter={entries.data.usage.user ?? s.memory_usage.user}
        />
      </div>

      <SessionSearch onOpenThread={onOpenThread} />
    </div>
  );
}
