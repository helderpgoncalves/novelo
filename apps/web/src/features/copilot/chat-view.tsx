import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { ArrowDown, Upload } from 'lucide-react';
import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { compactCopilotThreadMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { Composer, type ComposerHandle } from './composer';
import { EmptyChat } from './empty-chat';
import { exportThreadMarkdown } from './export-thread';
import { AssistantMessage, UserMessage } from './message';
import { usePageInfo } from './page-context';
import { consumeCopilotRequest, useCopilotUi } from './store';
import type { Chat, SendInput } from './use-chat';
import { useReducedMotion } from './use-reduced-motion';

interface Props {
  chat: Chat;
  /** Esta superfície trata dos pedidos `openCopilot({question})` (a que estiver visível). */
  handlesRequests: boolean;
  onOpenThread?: (id: string) => void;
  /** `page` (página /chat) ou `panel` (⌘K): muda só o estado vazio. */
  layout?: 'page' | 'panel';
  className?: string;
}

/** Conversa completa (mensagens, rolar, campo flutuante): a mesma no painel ⌘K e na página /chat. */
export function ChatView({
  chat,
  handlesRequests,
  onOpenThread,
  layout = 'panel',
  className,
}: Props) {
  const { messages, busy, status, load, context } = chat;
  const router = useRouter();
  const reduced = useReducedMotion();
  const page = usePageInfo();
  const [contextOn, setContextOn] = useState(true);
  const pageRef = useRef(page);
  pageRef.current = page;
  const contextOnRef = useRef(contextOn);
  contextOnRef.current = contextOn;
  const getPageContext = useCallback(() => pageRef.current.context, []);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const composer = useRef<ComposerHandle>(null);
  const stickRef = useRef(true);
  const [stick, setStick] = useState(true);
  const [dragging, setDragging] = useState(false);
  const ui = useCopilotUi();
  const [announce, setAnnounce] = useState('');
  const wasBusy = useRef(false);

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
    (text: string) =>
      send({
        text,
        mentions: [],
        attachments: [],
        pageContext: contextOnRef.current ? pageRef.current.context : null,
      }),
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
        case '/websearch':
          // Sem argumento: o servidor responde com o estado atual (ligada/desligada) sem chamar o modelo.
          if (!chat.busy)
            chat.send({ text: name, mentions: [], attachments: [], pageContext: null });
          return;
        case '/compact':
        case '/exportar': {
          if (name === '/compact') {
            if (!id) {
              toast.info(m.chat_no_thread_yet());
              return;
            }
            compact.mutate({ path: { thread_id: id } });
            return;
          }
          await exportThreadMarkdown(id);
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
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent_0,#000_20px,#000_calc(100%-20px),transparent_100%)]"
        data-testid="copilot-scroller"
      >
        <div
          ref={content}
          className={cn(
            'mx-auto w-full max-w-[46rem] px-4 pt-6 pb-8 sm:px-6',
            empty && 'flex min-h-full flex-col',
          )}
        >
          {load.state === 'loading' && (
            <div role="status" aria-label={m.chat_opening()} className="space-y-6 py-8">
              <span className="sr-only">{m.chat_opening()}</span>
              <div
                aria-hidden="true"
                className="ml-auto h-10 w-2/3 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none sm:w-1/2"
              />
              <div aria-hidden="true" className="space-y-2.5">
                <div className="h-3.5 w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <div className="h-3.5 w-11/12 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <div className="h-3.5 w-3/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              </div>
            </div>
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
          {empty && <EmptyChat route={page.context?.route ?? null} onPick={ask} variant={layout} />}
          {messages.length > 0 && (
            <ol
              className="space-y-8"
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

      <div className="relative z-10 shrink-0 bg-background px-4 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!stick && messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="-top-12 -translate-x-1/2 absolute left-1/2 h-10 gap-1.5 rounded-full bg-background px-4 shadow-sm"
            onClick={() => {
              stickRef.current = true;
              setStick(true);
              scrollToEnd(true);
            }}
          >
            <ArrowDown className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {m.chat_to_end()}
          </Button>
        )}
        <div className="mx-auto w-full max-w-[46rem]">
          <Composer
            ref={composer}
            busy={busy}
            onSend={send}
            onStop={chat.stop}
            onCommand={(n) => void onCommand(n)}
            getPageContext={getPageContext}
            pageLabel={page.label}
            contextOn={contextOn}
            onContextChange={setContextOn}
          />
          {pct >= 70 && (
            <p className="mt-1 px-3 text-muted-foreground text-xs">
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
