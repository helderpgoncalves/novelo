import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActionOut,
  AttachmentOut,
  CopilotEventMessage,
  CopilotStreamRequest,
  MentionRef,
  PageContext,
} from '@/client';
import { getCopilotThreadOptions } from '@/client/@tanstack/react-query.gen';
import { getLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { invalidateCopilot } from './cache';
import { applyEvent, closingEvents, emptyMessage, fromServer, newTurn } from './reducer';
import { regeneratePath, STREAM_PATH, StreamHttpError, streamEvents } from './sse';
import type { ChatMessage, ContextInfo, EventOf, StatusInfo, Turn } from './types';

export interface SendInput {
  text: string;
  mentions: { ref: MentionRef; label?: string }[];
  attachments: AttachmentOut[];
  pageContext: PageContext | null;
}

interface Options {
  threadId: string | null;
  onThreadId: (id: string | null) => void;
}

let counter = 0;
const tempId = () => `tmp-${Date.now()}-${counter++}`;

function errorFrom(e: unknown): { code: string; message: string } {
  if (e instanceof StreamHttpError) {
    const body = e.body as { code?: unknown; message?: unknown } | null;
    return {
      code: typeof body?.code === 'string' ? body.code : 'internal_error',
      message: typeof body?.message === 'string' ? body.message : `HTTP ${e.status}`,
    };
  }
  return { code: 'connection', message: m.chat_error_connection() };
}

/**
 * Uma conversa com o copiloto: carrega a conversa pedida, envia perguntas em streaming, cancela e regenera.
 * O mesmo hook serve o painel (⌘K) e a página /chat.
 */
export function useChat({ threadId, onThreadId }: Options) {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [context, setContext] = useState<ContextInfo | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [load, setLoad] = useState<{ state: 'idle' | 'loading' | 'error'; error?: unknown }>({
    state: 'idle',
  });

  const held = useRef<string | null>(null);
  const gen = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const onThreadIdRef = useRef(onThreadId);
  onThreadIdRef.current = onThreadId;

  const loadThread = useCallback(
    async (id: string) => {
      const mine = gen.current;
      setLoad({ state: 'loading' });
      try {
        const thread = await qc.fetchQuery({
          ...getCopilotThreadOptions({ path: { thread_id: id } }),
          staleTime: 0,
        });
        if (mine !== gen.current) return;
        setMessages(thread.messages.map(fromServer));
        setTitle(thread.title);
        setContext({
          usedTokens: thread.used_tokens,
          windowTokens: thread.window_tokens,
          compacted: thread.has_summary,
        });
        setLoad({ state: 'idle' });
      } catch (error) {
        if (mine === gen.current) setLoad({ state: 'error', error });
      }
    },
    [qc],
  );

  // A conversa pedida (URL ou painel) mudou: abandona a atual e carrega a nova.
  useEffect(() => {
    if (threadId === held.current) return;
    gen.current += 1;
    abort.current?.abort();
    held.current = threadId;
    busyRef.current = false;
    setBusy(false);
    setStatus(null);
    setContext(null);
    setTitle(null);
    if (!threadId) {
      setMessages([]);
      setLoad({ state: 'idle' });
      return;
    }
    setMessages([]);
    void loadThread(threadId);
  }, [threadId, loadThread]);

  const reconcile = useCallback(
    async (id: string, localAssistantId: string) => {
      const mine = gen.current;
      try {
        const thread = await qc.fetchQuery({
          ...getCopilotThreadOptions({ path: { thread_id: id } }),
          staleTime: 0,
        });
        if (mine !== gen.current || busyRef.current) return;
        const local = messagesRef.current;
        const merged = thread.messages.map((sm, i) => {
          const fresh = fromServer(sm);
          const mine = local.find((l) => l.id === sm.id);
          if (mine) {
            return {
              ...fresh,
              suggestions: mine.suggestions,
              sources: mine.sources,
              memory: mine.memory,
              clarify: mine.clarify,
              navigate: mine.navigate,
              plan: mine.plan,
              retracted: mine.retracted,
              error: mine.error ?? fresh.error,
              tools: mine.tools.length ? mine.tools : fresh.tools,
            };
          }
          const sameSlot = local[i];
          if (sameSlot && sameSlot.role === 'user' && sm.role === 'user') {
            return { ...fresh, mentions: sameSlot.mentions };
          }
          return fresh;
        });
        // Se a resposta local ainda não existe no servidor (falha antes de gravar), mantém o que há.
        if (!thread.messages.some((x) => x.id === localAssistantId)) return;
        setMessages(merged);
        setTitle(thread.title);
      } catch {
        // Os ids provisórios continuam a servir; a conversa recarrega ao reabrir.
      }
    },
    [qc],
  );

  const run = useCallback(
    async (path: string, body: unknown, first: Turn) => {
      const mine = gen.current;
      const ctrl = new AbortController();
      abort.current = ctrl;
      busyRef.current = true;
      setBusy(true);
      setStatus({ phase: 'thinking', labelKey: 'status.thinking', detail: null });

      let turn = first;
      let currentId = first.message.id;
      let queue: CopilotEventMessage[] = [];
      let timer: ReturnType<typeof setTimeout> | null = null;

      const flush = () => {
        timer = null;
        if (mine !== gen.current || queue.length === 0) return;
        const batch = queue;
        queue = [];
        const before = currentId;
        for (const ev of batch) {
          turn = applyEvent(turn, ev);
        }
        currentId = turn.message.id;
        const next = turn.message;
        setMessages((prev) => prev.map((x) => (x.id === before ? next : x)));
        setStatus(turn.status);
        if (turn.context) setContext(turn.context);
        if (turn.title) setTitle(turn.title);
        if (turn.threadId && held.current !== turn.threadId) {
          held.current = turn.threadId;
          onThreadIdRef.current(turn.threadId);
        }
      };

      try {
        await streamEvents(path, body, ctrl.signal, (ev) => {
          queue.push(ev);
          if (timer === null) timer = setTimeout(flush, 40);
        });
      } catch (e) {
        if (!ctrl.signal.aborted && mine === gen.current) {
          const err = errorFrom(e);
          queue.push({
            type: 'error',
            code: err.code as EventOf<'error'>['code'],
            message: err.message,
          });
        }
      }
      if (timer !== null) clearTimeout(timer);
      if (mine !== gen.current) return;
      queue.push(...closingEvents(queue, turn, ctrl.signal.aborted, m.chat_error_connection()));
      flush();
      // Sem `done` (erro antes de acabar), a mensagem não pode ficar a "escrever" para sempre.
      setMessages((prev) =>
        prev.map((x) =>
          x.id === currentId && x.state === 'streaming'
            ? { ...x, state: x.error ? 'error' : ctrl.signal.aborted ? 'cancelled' : 'complete' }
            : x,
        ),
      );
      busyRef.current = false;
      setBusy(false);
      setStatus(null);
      abort.current = null;
      void invalidateCopilot(qc);
      if (turn.threadId ?? held.current)
        void reconcile((turn.threadId ?? held.current) as string, currentId);
    },
    [qc, reconcile],
  );

  const send = useCallback(
    async (input: SendInput) => {
      const text = input.text.trim();
      if (!text || busyRef.current) return;
      const user: ChatMessage = {
        ...emptyMessage('user', tempId(), text),
        attachments: input.attachments,
        mentions: input.mentions,
      };
      const turn = newTurn(tempId());
      setMessages((prev) => [...prev, user, turn.message]);
      const body: CopilotStreamRequest = {
        message: text,
        locale: getLocale(),
        thread_id: held.current,
        mentions: input.mentions.map((x) => x.ref),
        attachment_ids: input.attachments.map((a) => a.id),
        page_context: input.pageContext,
      };
      await run(STREAM_PATH, body, turn);
    },
    [run],
  );

  const regenerate = useCallback(async () => {
    const id = held.current;
    if (!id || busyRef.current) return;
    const list = messagesRef.current;
    const last = list[list.length - 1];
    const base = last?.role === 'assistant' ? list.slice(0, -1) : list;
    const turn = newTurn(tempId());
    setMessages([...base, turn.message]);
    await run(regeneratePath(id, getLocale()), undefined, turn);
  }, [run]);

  const retry = useCallback(async () => {
    const list = messagesRef.current;
    if (held.current) {
      await regenerate();
      return;
    }
    const lastUser = [...list].reverse().find((x) => x.role === 'user');
    if (!lastUser) return;
    setMessages([]);
    await send({
      text: lastUser.text,
      mentions: lastUser.mentions,
      attachments: lastUser.attachments,
      pageContext: null,
    });
  }, [regenerate, send]);

  const stop = useCallback(() => abort.current?.abort(), []);

  const newChat = useCallback(() => {
    gen.current += 1;
    abort.current?.abort();
    held.current = null;
    busyRef.current = false;
    setBusy(false);
    setStatus(null);
    setContext(null);
    setTitle(null);
    setMessages([]);
    setLoad({ state: 'idle' });
    onThreadIdRef.current(null);
  }, []);

  const patchMessage = useCallback((id: string, patch: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((x) => (x.id === id ? patch(x) : x)));
  }, []);

  const updateAction = useCallback((action: ActionOut) => {
    setMessages((prev) =>
      prev.map((x) =>
        x.actions.some((a) => a.id === action.id)
          ? { ...x, actions: x.actions.map((a) => (a.id === action.id ? action : a)) }
          : x,
      ),
    );
  }, []);

  const reload = useCallback(() => {
    if (held.current) void loadThread(held.current);
  }, [loadThread]);

  return {
    messages,
    busy,
    status,
    context,
    title,
    load,
    threadId: held.current,
    send,
    stop,
    regenerate,
    retry,
    newChat,
    patchMessage,
    updateAction,
    reload,
  };
}

export type Chat = ReturnType<typeof useChat>;
