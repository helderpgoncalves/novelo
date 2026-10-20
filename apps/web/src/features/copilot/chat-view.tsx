import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { ArrowDown, AtSign, Paperclip, Slash, Sparkles, Upload } from 'lucide-react';
import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { exportCopilotThread } from '@/client';
import { compactCopilotThreadMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { Composer, type ComposerHandle } from './composer';
import { downloadText } from './download';
import { AssistantMessage, UserMessage } from './message';
import { usePageContext } from './page-context';
import { consumeCopilotRequest, useCopilotUi } from './store';
import type { Chat, SendInput } from './use-chat';
import { useReducedMotion } from './use-reduced-motion';

function EmptyChat({ onPick }: { onPick: (text: string) => void }) {
  const suggestions = [
    m.copilot_suggestion_simulate(),
    m.copilot_suggestion_compare(),
    m.copilot_suggestion_coverage(),
    m.chat_suggestion_flows(),
  ];
  return (
    <div className="flex min-h-full flex-col justify-center gap-6 py-8">
      <div className="space-y-2">
        <Sparkles className="size-6 text-primary" aria-hidden="true" />
        <h2 className="font-serif text-2xl sm:text-3xl">{m.copilot_empty_title()}</h2>
        <p className="max-w-xl text-muted-foreground text-sm leading-relaxed">
          {m.copilot_empty_description()}
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2" aria-label={m.copilot_suggestions_label()}>
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
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-muted-foreground text-xs">
        <li className="flex items-center gap-1.5">
          <AtSign className="size-3.5" aria-hidden="true" />
          {m.chat_tip_mention()}
        </li>
        <li className="flex items-center gap-1.5">
          <Slash className="size-3.5" aria-hidden="true" />
          {m.chat_tip_commands()}
        </li>
        <li className="flex items-center gap-1.5">
          <Paperclip className="size-3.5" aria-hidden="true" />
          {m.chat_tip_attach()}
        </li>
      </ul>
    </div>
  );
}

interface Props {
  chat: Chat;
  /** Esta superfície trata dos pedidos `openCopilot({question})` (a que estiver visível). */
  handlesRequests: boolean;
  onOpenThread?: (id: string) => void;
  className?: string;
}

/** Conversa completa (mensagens, rolar, campo flutuante): a mesma no painel ⌘K e na página /chat. */
export function ChatView({ chat, handlesRequests, onOpenThread, className }: Props) {
  const { messages, busy, status, load, context } = chat;
  const router = useRouter();
  const reduced = useReducedMotion();
  const getPageContext = usePageContext();
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const composer = useRef<ComposerHandle>(null);
  const stickRef = useRef(true);
  const [stick, setStick] = useState(true);
  const [dragging, setDragging] = useState(false);
  const ui = useCopilotUi();
  const [announce, setAnnounce] = useState('');
  const wasBusy = useRef(false);
  const canAttachScreen = getPageContext() !== null;

  const scrollToEnd = useCallback(
    (smooth = false) => {
      const el = scroller.current;
      if (el)
        el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduced ? 'smooth' : 'auto' });
    },
    [reduced],
  );

  // Segue o fim enquanto o conteúdo cresce (texto, gráficos), a não ser que a pessoa tenha subido.
  useEffect(() => {
    const el = content.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (stickRef.current) scrollToEnd();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollToEnd]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickRef.current = near;
    setStick(near);
  };
  const releaseOnUpward = (up: boolean) => {
    if (up) {
      stickRef.current = false;
      setStick(false);
    }
  };

  const send = useCallback(
    (input: SendInput) => {
      stickRef.current = true;
      setStick(true);
      void chat.send(input);
      requestAnimationFrame(() => scrollToEnd());
    },
    [chat, scrollToEnd],
  );
  const ask = useCallback(
    (text: string) => send({ text, mentions: [], attachments: [], pageContext: null }),
    [send],
  );

  // Anúncio para leitores de ecrã: o texto a chegar não se lê token a token, só o fim da resposta.
  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      setAnnounce('');
      return;
    }
    if (!wasBusy.current) return;
    wasBusy.current = false;
    const last = messages[messages.length - 1];
    setAnnounce(last?.state === 'complete' ? m.chat_sr_done() : '');
  }, [busy, messages]);

  // Perguntas vindas de fora (`openCopilot({question})`).
  useEffect(() => {
    const req = ui.request;
    if (!req || !handlesRequests) return;
    if (req.threadId) onOpenThread?.(req.threadId);
    else if (req.question && req.send && !busy) ask(req.question);
    else if (req.question) composer.current?.setText(req.question);
    else composer.current?.focus();
    consumeCopilotRequest(req.id);
  }, [ui.request, handlesRequests, onOpenThread, ask, busy]);

  const compact = useMutation({
    ...compactCopilotThreadMutation(),
    onSuccess: (res) => {
      toast.success(m.chat_compacted({ count: res.compacted_messages }));
      chat.reload();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const onCommand = useCallback(
    async (name: string) => {
      const id = chat.threadId;
      switch (name) {
        case '/novo':
        case '/limpar':
          chat.newChat();
          return;
        case '/modelo':
          void router.navigate({ to: '/admin/ai', search: { tab: 'overview', days: 30 } });
          return;
        case '/compact':
        case '/exportar': {
          if (!id) {
            toast.info(m.chat_no_thread_yet());
            return;
          }
          if (name === '/compact') {
            compact.mutate({ path: { thread_id: id } });
            return;
          }
          try {
            const { data } = await exportCopilotThread({
              path: { thread_id: id },
              throwOnError: true,
            });
            downloadText(data.filename, data.markdown);
          } catch (e) {
            toast.error(getErrorMessage(e));
          }
          return;
        }
        default:
          toast.info(name);
      }
    },
    [chat, compact, router],
  );

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const lastIndex = messages.length - 1;
  const pct = context?.windowTokens
    ? Math.round((context.usedTokens / context.windowTokens) * 100)
    : 0;
  const empty = messages.length === 0 && load.state === 'idle' && !busy;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: zona onde se largam ficheiros; o teclado usa o botão de anexar
    <div
      className={cn('relative flex min-h-0 flex-1 flex-col', className)}
      onDragEnter={(e) => {
        if (hasFiles(e)) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(false);
        composer.current?.addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      <div
        ref={scroller}
        onScroll={onScroll}
        onWheel={(e) => releaseOnUpward(e.deltaY < 0)}
        onTouchMove={() => {
          const el = scroller.current;
          if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 120) releaseOnUpward(true);
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        data-testid="copilot-scroller"
      >
        <div ref={content} className="mx-auto w-full max-w-3xl px-4 pt-4 pb-8 sm:px-6">
          {load.state === 'loading' && (
            <p role="status" className="py-10 text-center text-muted-foreground text-sm">
              {m.chat_opening()}
            </p>
          )}
          {load.state === 'error' && (
            <div role="alert" className="space-y-3 py-10 text-center">
              <p className="font-medium">{m.chat_open_failed()}</p>
              <p className="text-muted-foreground text-sm">{getErrorMessage(load.error)}</p>
              <Button variant="outline" onClick={chat.reload}>
                {m.common_retry()}
              </Button>
            </div>
          )}
          {empty && <EmptyChat onPick={ask} />}
          {messages.length > 0 && (
            <ol
              className="space-y-7"
              aria-label={m.copilot_title()}
              aria-live="polite"
              aria-relevant="additions text"
            >
              {messages.map((msg, i) =>
                msg.role === 'user' ? (
                  <UserMessage key={msg.id} message={msg} />
                ) : (
                  <AssistantMessage
                    key={msg.id}
                    message={msg}
                    chat={chat}
                    last={i === lastIndex}
                    status={status}
                    onAsk={ask}
                  />
                ),
              )}
            </ol>
          )}
        </div>
      </div>

      <div className="relative z-10 -mt-6 bg-gradient-to-t from-background from-70% to-transparent px-3 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        {!stick && (
          <Button
            variant="outline"
            size="sm"
            className="absolute -top-2 left-1/2 h-10 -translate-x-1/2 gap-1.5 rounded-full bg-background shadow-md"
            onClick={() => {
              stickRef.current = true;
              setStick(true);
              scrollToEnd(true);
            }}
          >
            <ArrowDown className="size-4" aria-hidden="true" />
            {m.chat_to_end()}
          </Button>
        )}
        <div className="mx-auto w-full max-w-3xl">
          <Composer
            ref={composer}
            busy={busy}
            onSend={send}
            onStop={chat.stop}
            onCommand={(n) => void onCommand(n)}
            getPageContext={getPageContext}
            canAttachScreen={canAttachScreen}
          />
          {pct >= 70 && (
            <p className="mt-1 px-2 text-muted-foreground text-xs">
              {m.chat_context_full({ pct })}
            </p>
          )}
        </div>
      </div>

      {dragging && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-primary border-dashed bg-background/85 text-primary"
        >
          <Upload className="size-8" />
          <p className="font-medium">{m.chat_drop_files()}</p>
        </div>
      )}
    </div>
  );
}
