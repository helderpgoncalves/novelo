import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Globe,
  ListChecks,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Undo2,
  Wrench,
} from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import type { AttachmentOut } from '@/client';
import {
  createCopilotMemoryEntryMutation,
  deleteCopilotMemoryEntryMutation,
  sendCopilotFeedbackMutation,
  updateCopilotMemoryEntryMutation,
} from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { ActionCard } from './action-card';
import { ArtifactView } from './artifacts/artifact-view';
import { invalidateCopilot } from './cache';
import { CopilotError } from './copilot-error';
import { toolLabel } from './labels';
import { SafeMarkdown } from './markdown';
import { MentionChip } from './mention-chip';
import { segmentText } from './mentions';
import { CopilotScenarioCard, fromCard } from './scenario-card';
import { SourcesPanel, WebSearchNotes, WebSearchSteps } from './sources';
import { ThinkingLine } from './thinking';
import type { ChatMessage, MemoryNote, StatusInfo } from './types';
import type { Chat } from './use-chat';
import { formatExternalNumbers, stepCount } from './web';

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function AttachmentPill({ attachment }: { attachment: AttachmentOut }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
      <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{attachment.filename}</span>
      <span className="shrink-0 text-muted-foreground">{formatSize(attachment.size_bytes)}</span>
    </span>
  );
}

export function UserMessage({ message }: { message: ChatMessage }) {
  const resolved = message.mentions.flatMap((x) =>
    x.label ? [{ ref: x.ref, label: x.label }] : [],
  );
  return (
    <li className="flex flex-col items-end gap-1.5" data-testid="copilot-user-message">
      <div className="max-w-[88%] space-y-2 rounded-2xl rounded-br-md bg-primary/10 px-3.5 py-2.5 text-foreground sm:max-w-[75%]">
        <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">
          {segmentText(message.text, resolved).map((seg, i) =>
            seg.mention ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: os troços são fixos para o mesmo texto
              <MentionChip key={i} mention={seg.mention} />
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: os troços são fixos para o mesmo texto
              <span key={i}>{seg.text}</span>
            ),
          )}
        </p>
        {message.attachments.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={m.chat_attachments()}>
            {message.attachments.map((a) => (
              <li key={a.id} className="min-w-0 max-w-full">
                <AttachmentPill attachment={a} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function MemoryNotice({ note, onUndone }: { note: MemoryNote; onUndone: () => void }) {
  const qc = useQueryClient();
  const done = () => {
    onUndone();
    void invalidateCopilot(qc, /Memory/);
  };
  const fail = (e: unknown) => toast.error(getErrorMessage(e));
  const del = useMutation({
    ...deleteCopilotMemoryEntryMutation(),
    onSuccess: done,
    onError: fail,
  });
  const patch = useMutation({
    ...updateCopilotMemoryEntryMutation(),
    onSuccess: done,
    onError: fail,
  });
  const create = useMutation({
    ...createCopilotMemoryEntryMutation(),
    onSuccess: done,
    onError: fail,
  });
  const pending = del.isPending || patch.isPending || create.isPending;

  const undo = () => {
    if (note.action === 'added' && note.entryId) del.mutate({ path: { entry_id: note.entryId } });
    else if (note.action === 'patched' && note.entryId && note.previous)
      patch.mutate({ path: { entry_id: note.entryId }, body: { content: note.previous } });
    else if (note.action === 'removed')
      create.mutate({ body: { target: note.target, content: note.previous ?? note.content } });
  };
  const canUndo =
    note.status === 'applied' &&
    !note.undone &&
    ((note.action === 'added' && !!note.entryId) ||
      (note.action === 'patched' && !!note.entryId && !!note.previous) ||
      note.action === 'removed');

  let text: string;
  if (note.status === 'blocked') text = m.chat_memory_blocked({ reason: note.reason ?? '' });
  else if (note.status === 'pending') text = m.chat_memory_pending({ content: note.content });
  else if (note.action === 'removed') text = m.chat_memory_removed({ content: note.content });
  else if (note.action === 'patched') text = m.chat_memory_patched({ content: note.content });
  else text = m.chat_memory_added({ content: note.content });

  return (
    <div
      data-testid="copilot-memory-note"
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm',
        note.status === 'blocked' && 'border-destructive/40 bg-destructive/5',
        note.status === 'pending' && 'border-areia bg-areia/10',
      )}
    >
      <Bookmark className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">
        {note.undone ? m.chat_memory_undone() : text}
      </span>
      {note.status === 'pending' && (
        <Link
          to="/chat"
          search={{ tab: 'settings' }}
          className="text-primary text-xs underline underline-offset-2"
        >
          {m.chat_memory_review()}
        </Link>
      )}
      {canUndo && (
        <Button size="sm" variant="ghost" className="h-9 gap-1.5" disabled={pending} onClick={undo}>
          <Undo2 className="size-3.5" aria-hidden="true" />
          {m.chat_memory_undo()}
        </Button>
      )}
    </div>
  );
}

function StepsPanel({ message }: { message: ChatMessage }) {
  return (
    <div className="space-y-2">
      {message.plan.length > 0 && (
        <ol className="list-decimal space-y-0.5 pl-5 text-muted-foreground">
          {message.plan.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      <ul className="space-y-1">
        {message.tools
          .filter((t) => t.name !== 'web_search')
          .map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-baseline gap-x-2 rounded-md bg-muted/50 px-2 py-1"
            >
              <span className="font-medium" title={t.name}>
                {toolLabel(t.name)}
              </span>
              <span className={cn('text-muted-foreground', t.ok === false && 'text-destructive')}>
                {t.summary ?? t.args}
              </span>
              {t.durationMs !== null && (
                <span className="ml-auto text-muted-foreground tabular-nums">
                  {t.durationMs} ms
                </span>
              )}
            </li>
          ))}
        <WebSearchSteps message={message} />
      </ul>
    </div>
  );
}

/** Botão discreto que abre/fecha um painel por baixo da barra (passos, fontes). */
function DisclosureButton({
  icon: Icon,
  label,
  open,
  controls,
  onToggle,
}: {
  icon: typeof Wrench;
  label: string;
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-10 gap-1.5 px-2.5 text-muted-foreground text-xs hover:text-foreground sm:h-8"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
    >
      <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      {label}
      <ChevronDown
        className={cn('size-3.5 transition-transform', open && 'rotate-180')}
        aria-hidden="true"
      />
    </Button>
  );
}

function Navigate({ message }: { message: ChatMessage }) {
  const router = useRouter();
  if (message.navigate.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {message.navigate.map((n) => (
        <Button
          key={`${n.route}-${n.label}`}
          variant="outline"
          size="sm"
          className="h-10 gap-1.5"
          onClick={() =>
            void router.navigate({ to: n.route, params: n.params, search: n.search } as never)
          }
        >
          {n.label}
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}

function Feedback({ message, onChange }: { message: ChatMessage; onChange: (v: 1 | -1) => void }) {
  const send = useMutation({
    ...sendCopilotFeedbackMutation(),
    onSuccess: (data) => onChange(data.rating),
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const rate = (rating: 1 | -1) =>
    send.mutate({ path: { message_id: message.id }, body: { rating } });
  const cls = 'size-10 text-muted-foreground hover:text-foreground sm:size-8';
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cls}
        aria-pressed={message.feedback === 1}
        aria-label={m.chat_feedback_good()}
        onClick={() => rate(1)}
        disabled={send.isPending}
      >
        <ThumbsUp
          className={cn('size-4', message.feedback === 1 && 'fill-primary text-primary')}
          aria-hidden="true"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cls}
        aria-pressed={message.feedback === -1}
        aria-label={m.chat_feedback_bad()}
        onClick={() => rate(-1)}
        disabled={send.isPending}
      >
        <ThumbsDown
          className={cn('size-4', message.feedback === -1 && 'fill-destructive text-destructive')}
          aria-hidden="true"
        />
      </Button>
    </>
  );
}

interface AssistantProps {
  message: ChatMessage;
  /** Sem `chat` a mensagem é só de leitura (conversa partilhada): sem ações, memória nem avaliação. */
  chat: Chat | null;
  last: boolean;
  status: StatusInfo | null;
  onAsk: (text: string) => void;
}

/** Resposta do copiloto: a toda a largura, sem bolha, com texto, cartões, artefactos, ações e notas. */
export function AssistantMessage({ message, chat, last, status, onAsk }: AssistantProps) {
  const [copied, setCopied] = useState(false);
  const [panel, setPanel] = useState<'steps' | 'sources' | null>(null);
  const panelId = useId();
  const streaming = message.state === 'streaming';
  // O selo «verificado» não diz nada de novo (é o comportamento esperado); só o contrário é relevante:
  // avisa que os números do texto não puderam ser confirmados e que só valem os cartões.
  const verification = message.verification;
  const unverified =
    !!verification && (!verification.verified || verification.warning === 'numbers_unverified');
  const hasSteps = stepCount(message) > 0 || message.plan.length > 0;
  const externalNumbers = verification?.externalNumbers ?? [];
  const hasSources = message.sources.length > 0;
  const canRate = !streaming && !message.id.startsWith('tmp-') && message.state !== 'error';

  const copy = async () => {
    await navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <li className="space-y-3" data-testid="copilot-assistant-message" data-state={message.state}>
      <p className="sr-only">{m.copilot_role_assistant()}</p>
      {message.text && <SafeMarkdown text={message.text} />}
      {!streaming && unverified && (
        <p
          role="note"
          data-testid="copilot-unverified"
          className="flex items-start gap-1.5 text-destructive text-xs leading-snug"
        >
          <AlertTriangle
            className="mt-px size-3.5 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          {m.copilot_unverified()}
        </p>
      )}
      {!streaming && externalNumbers.length > 0 && (
        <p
          role="note"
          data-testid="copilot-external-numbers"
          className="flex items-start gap-1.5 text-muted-foreground text-xs leading-snug"
        >
          <Globe className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {m.chat_external_numbers({ numbers: formatExternalNumbers(externalNumbers) })}
        </p>
      )}
      <WebSearchNotes message={message} />
      {message.retracted && streaming && !message.text && (
        <p className="text-muted-foreground text-sm italic">{m.chat_retracted()}</p>
      )}

      {message.cards.length > 0 && (
        <div className="grid gap-3">
          {message.cards.map((c) => (
            <CopilotScenarioCard key={c.scenario_id} card={fromCard(c)} bleed />
          ))}
        </div>
      )}
      {message.artifacts.map((a) => (
        <ArtifactView key={a.id} artifact={a} />
      ))}
      {message.actions.map((a) =>
        chat ? (
          <ActionCard key={a.id} action={a} onChange={chat.updateAction} />
        ) : (
          <p key={a.id} className="rounded-lg border px-3 py-2 text-muted-foreground text-sm">
            {a.summary}
          </p>
        ),
      )}
      {chat &&
        message.memory.map((n, i) => (
          <MemoryNotice
            // biome-ignore lint/suspicious/noArrayIndexKey: as notas chegam por ordem e não se reordenam
            key={i}
            note={n}
            onUndone={() =>
              chat.patchMessage(message.id, (x) => ({
                ...x,
                memory: x.memory.map((mm, j) => (j === i ? { ...mm, undone: true } : mm)),
              }))
            }
          />
        ))}

      {chat && message.clarify && !streaming && (
        <div
          className="space-y-2 border-primary/50 border-l-2 pl-3.5"
          data-testid="copilot-clarify"
        >
          {!message.text.includes(message.clarify.question.slice(0, 24)) && (
            <p className="font-medium text-sm">{message.clarify.question}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {message.clarify.options.map((o) => (
              <Button key={o} variant="outline" size="sm" className="h-10" onClick={() => onAsk(o)}>
                {o}
              </Button>
            ))}
          </div>
        </div>
      )}

      {message.state === 'error' && message.error && (
        <CopilotError
          code={message.error.code}
          partial={message.text.length > 0}
          onRetry={last && chat ? () => void chat.retry() : null}
        />
      )}
      {streaming && <ThinkingLine status={status} message={message} />}
      {message.state === 'cancelled' && (
        <p className="text-muted-foreground text-xs italic">{m.chat_cancelled()}</p>
      )}

      <Navigate message={message} />

      {!streaming && (message.text || hasSteps || hasSources) && (
        <div className="space-y-1.5">
          <div className="-ml-2 flex flex-wrap items-center gap-x-0.5 gap-y-0">
            {message.text && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 text-muted-foreground hover:text-foreground sm:size-8"
                  aria-label={m.chat_copy()}
                  onClick={() => void copy()}
                >
                  {copied ? (
                    <Check className="size-4 text-primary" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" aria-hidden="true" />
                  )}
                </Button>
                {chat && canRate && (
                  <Feedback
                    message={message}
                    onChange={(v) => chat.patchMessage(message.id, (x) => ({ ...x, feedback: v }))}
                  />
                )}
                {last && chat?.threadId && !chat.busy && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 gap-1.5 px-2.5 text-muted-foreground text-xs hover:text-foreground sm:h-8"
                    onClick={() => void chat.regenerate()}
                  >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    {m.chat_regenerate()}
                  </Button>
                )}
              </>
            )}
            {message.text && (hasSteps || hasSources) && (
              <span aria-hidden="true" className="mx-1.5 h-4 w-px bg-border" />
            )}
            {hasSteps && (
              <DisclosureButton
                icon={Wrench}
                label={m.chat_steps({ count: stepCount(message) })}
                open={panel === 'steps'}
                controls={`${panelId}-steps`}
                onToggle={() => setPanel(panel === 'steps' ? null : 'steps')}
              />
            )}
            {hasSources && (
              <DisclosureButton
                icon={ListChecks}
                label={m.chat_sources({ count: message.sources.length })}
                open={panel === 'sources'}
                controls={`${panelId}-sources`}
                onToggle={() => setPanel(panel === 'sources' ? null : 'sources')}
              />
            )}
          </div>
          {panel === 'steps' && hasSteps && (
            <div id={`${panelId}-steps`} className="text-xs">
              <StepsPanel message={message} />
            </div>
          )}
          {panel === 'sources' && hasSources && (
            <div id={`${panelId}-sources`} className="text-xs">
              <SourcesPanel message={message} />
            </div>
          )}
        </div>
      )}

      {chat && last && !streaming && message.suggestions.length > 0 && (
        <ul
          className="border-border/60 border-t"
          aria-label={m.copilot_suggestions_label()}
          data-testid="copilot-suggestions"
        >
          {message.suggestions.map((s) => (
            <li key={s} className="border-border/60 border-b">
              <button
                type="button"
                onClick={() => onAsk(s)}
                className="group flex min-h-11 w-full items-center justify-between gap-3 py-2.5 text-left text-sm leading-snug transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span>{s}</span>
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
