import { AlertTriangle, ArrowUp, BadgeCheck, Sparkles, SquarePen, Wrench } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { SafeMarkdown } from './markdown';
import { CopilotScenarioCard } from './scenario-card';
import type { CopilotMessage, useCopilot } from './use-copilot';

const TOOL_LABEL: Record<string, () => string> = {
  get_baseline: () => m.copilot_tool_get_baseline(),
  list_scenarios: () => m.copilot_tool_list_scenarios(),
  run_scenario: () => m.copilot_tool_run_scenario(),
  compare_scenarios: () => m.copilot_tool_compare_scenarios(),
  what_if: () => m.copilot_tool_what_if(),
  get_coverage: () => m.copilot_tool_get_coverage(),
  get_sensitivity: () => m.copilot_tool_get_sensitivity(),
};

const toolLabel = (name: string) => TOOL_LABEL[name]?.() ?? name.replaceAll('_', ' ');

function AssistantExtras({ reply }: { reply: NonNullable<CopilotMessage['reply']> }) {
  const unverified = reply.warning === 'numbers_unverified' || !reply.verified;
  return (
    <div className="space-y-3">
      {reply.cards.length > 0 && (
        <div className="grid gap-3">
          {reply.cards.map((c) => (
            <CopilotScenarioCard key={c.scenario_id} card={c} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {unverified ? (
          <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
            <AlertTriangle className="size-3" aria-hidden="true" />
            {m.copilot_unverified()}
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 text-floresta dark:text-foreground">
            <BadgeCheck className="size-3" aria-hidden="true" />
            {m.copilot_verified()}
          </Badge>
        )}
      </div>
      {reply.tools_used.length > 0 && (
        <ul
          className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs"
          aria-label={m.copilot_tools_used()}
        >
          <Wrench className="size-3" aria-hidden="true" />
          {reply.tools_used.map((t, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: lista fixa, a mesma ferramenta pode repetir-se
              key={`${t.name}-${i}`}
              className={cn('rounded-full border px-2 py-0.5', !t.ok && 'border-destructive/40')}
            >
              {t.ok ? toolLabel(t.name) : m.copilot_tool_failed({ tool: toolLabel(t.name) })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Bubble({ message }: { message: CopilotMessage }) {
  const user = message.role === 'user';
  return (
    <li className={cn('flex flex-col gap-1.5', user && 'items-end')}>
      <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
        {user ? m.copilot_role_user() : m.copilot_role_assistant()}
      </span>
      <div
        className={cn(
          'max-w-full space-y-3 rounded-2xl px-4 py-3',
          user ? 'max-w-[90%] bg-primary text-primary-foreground' : 'w-full bg-muted/60',
        )}
      >
        {user ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        ) : (
          <>
            <SafeMarkdown text={message.content} />
            {message.reply && <AssistantExtras reply={message.reply} />}
          </>
        )}
      </div>
    </li>
  );
}

function Thinking() {
  return (
    <li className="space-y-2" aria-busy="true">
      <span className="sr-only">{m.copilot_thinking()}</span>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-16 w-full rounded-2xl" />
    </li>
  );
}

function EmptyChat({ onPick }: { onPick: (text: string) => void }) {
  const suggestions = [
    m.copilot_suggestion_simulate(),
    m.copilot_suggestion_compare(),
    m.copilot_suggestion_coverage(),
  ];
  return (
    <div className="flex flex-1 flex-col justify-center gap-6 py-6">
      <div className="space-y-2">
        <Sparkles className="size-6 text-primary" aria-hidden="true" />
        <h3 className="font-serif text-2xl">{m.copilot_empty_title()}</h3>
        <p className="max-w-md text-muted-foreground text-sm leading-relaxed">
          {m.copilot_empty_description()}
        </p>
      </div>
      <ul className="grid gap-2" aria-label={m.copilot_suggestions_label()}>
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="min-h-11 w-full rounded-xl border bg-card px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CopilotPanel({
  copilot,
  withScenario,
}: {
  copilot: ReturnType<typeof useCopilot>;
  withScenario: boolean;
}) {
  const { messages, send, retry, reset, pending, error } = copilot;
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const count = messages.length;

  // biome-ignore lint/correctness/useExhaustiveDependencies: desce sempre que chega algo novo
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [count, pending, error]);

  const submit = () => {
    if (!draft.trim() || pending) return;
    send(draft);
    setDraft('');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
        {count === 0 && !pending && !error ? (
          <div className="flex h-full flex-col">
            <EmptyChat onPick={send} />
          </div>
        ) : (
          <ol className="space-y-5 py-4" aria-live="polite" aria-label={m.copilot_title()}>
            {messages.map((msg) => (
              <Bubble key={msg.id} message={msg} />
            ))}
            {pending && <Thinking />}
            {error !== null && !pending && (
              <li
                role="alert"
                className="flex flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
              >
                <p className="flex items-center gap-2 font-medium text-sm">
                  <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
                  {m.copilot_error_title()}
                </p>
                <p className="text-muted-foreground text-sm">{getErrorMessage(error)}</p>
                <Button variant="outline" size="sm" className="h-10" onClick={retry}>
                  {m.common_retry()}
                </Button>
              </li>
            )}
          </ol>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="space-y-2 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {withScenario && (
          <p className="text-muted-foreground text-xs">{m.copilot_context_scenario()}</p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            aria-label={m.copilot_input_label()}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={m.copilot_input_placeholder()}
            rows={2}
            maxLength={2000}
            className="max-h-40 min-h-12 resize-none text-base md:text-base"
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0"
            disabled={pending || !draft.trim()}
            aria-label={m.copilot_send()}
          >
            <ArrowUp className="size-5" aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="hidden text-muted-foreground text-xs sm:block">{m.copilot_hint()}</p>
          {count > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 sm:ml-auto"
              onClick={reset}
            >
              <SquarePen className="size-3.5" aria-hidden="true" />
              {m.copilot_clear()}
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
