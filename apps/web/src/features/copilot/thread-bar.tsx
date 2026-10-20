import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PanelLeftClose, PanelLeftOpen, Pencil } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { updateCopilotThreadMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { invalidateCopilot } from './cache';
import { loadConversation } from './stream-manager';
import { GeneratingDots } from './thread-list';
import type { Chat } from './use-chat';

interface Props {
  chat: Chat;
  /** A coluna de conversas está visível (a partir de `md`). */
  listVisible: boolean;
  onToggleList: () => void;
  className?: string;
}

/**
 * Faixa da conversa (48 px, a mesma altura que o cabeçalho da lista): título editável (duplo clique ou lápis),
 * «a gerar» e contexto, discretos à direita. Em telemóvel o título vive na barra da página.
 */
export function ThreadBar({ chat, listVisible, onToggleList, className }: Props) {
  const qc = useQueryClient();
  const { threadId, title, busy, context, load } = chat;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const cancelled = useRef(false);

  const rename = useMutation({
    ...updateCopilotThreadMutation(),
    onSuccess: (_d, vars) => {
      void invalidateCopilot(qc);
      void loadConversation(vars.path.thread_id, { silent: true });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const canEdit = Boolean(threadId && title);
  const start = () => {
    if (!canEdit) return;
    cancelled.current = false;
    setDraft(title ?? '');
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (cancelled.current || !threadId || !next || next === title) return;
    rename.mutate({ path: { thread_id: threadId }, body: { title: next } });
  };

  const pct = context?.windowTokens
    ? Math.min(100, Math.round((context.usedTokens / context.windowTokens) * 100))
    : 0;
  const ListIcon = listVisible ? PanelLeftClose : PanelLeftOpen;

  return (
    <div
      className={cn('hidden h-12 shrink-0 items-center gap-1.5 px-3 sm:flex lg:px-4', className)}
    >
      <Button
        variant="ghost"
        size="icon"
        className="hidden size-9 shrink-0 text-muted-foreground md:inline-flex"
        aria-label={listVisible ? m.chat_list_hide() : m.chat_list_show()}
        aria-expanded={listVisible}
        onClick={onToggleList}
      >
        <ListIcon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </Button>

      {editing ? (
        <Input
          autoFocus
          value={draft}
          maxLength={80}
          aria-label={m.chat_title_label()}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              cancelled.current = true;
              e.currentTarget.blur();
            }
          }}
          className="h-9 max-w-md min-w-0 flex-1 font-serif text-base shadow-none md:text-base"
        />
      ) : load.state === 'loading' && threadId && !title ? (
        <div aria-hidden="true" className="h-4 w-48 animate-pulse rounded bg-muted" />
      ) : (
        <div className="group flex min-w-0 items-center gap-0.5">
          <h2
            className={cn(
              'min-w-0 truncate font-medium font-serif text-base tracking-tight',
              !title && 'text-muted-foreground',
            )}
            data-testid="copilot-thread-title"
            onDoubleClick={start}
          >
            {title ?? m.chat_new()}
          </h2>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
              aria-label={m.chat_edit_title()}
              onClick={start}
            >
              <Pencil className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          )}
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-4 pl-3 text-muted-foreground text-xs">
        {busy && (
          <span className="flex items-center gap-2">
            <GeneratingDots />
            <span aria-hidden="true">{m.cp_generating()}</span>
          </span>
        )}
        {pct > 0 && (
          <span
            className="flex items-center gap-2 tabular-nums"
            title={m.chat_context_tokens({
              used: context?.usedTokens ?? 0,
              window: context?.windowTokens ?? 0,
            })}
          >
            <span aria-hidden="true" className="h-1 w-10 overflow-hidden rounded-full bg-muted">
              <span
                className={cn(
                  'block h-full rounded-full',
                  pct >= 70 ? 'bg-destructive' : 'bg-primary/70',
                )}
                style={{ width: `${pct}%` }}
              />
            </span>
            {m.chat_context_used({ pct })}
          </span>
        )}
      </div>
    </div>
  );
}
