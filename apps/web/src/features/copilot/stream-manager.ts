import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  AttachmentOut,
  CopilotEventMessage,
  CopilotStreamRequest,
  MentionRef,
  PageContext,
  ThreadOut,
} from '@/client';
import { getCopilotThreadOptions } from '@/client/@tanstack/react-query.gen';
import { getLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { invalidateCopilot } from './cache';
import {
  clearAllUnread,
  clearUnread,
  DRAFT_PREFIX,
  isDraftKey,
  markUnread,
  rekeyRunning,
  setRunning,
} from './generation';
import { applyEvent, closingEvents, emptyMessage, fromServer, newTurn } from './reducer';
import { regeneratePath, STREAM_PATH, StreamHttpError, streamEvents } from './sse';
import { isChatPageOpen, isCopilotSheetOpen, openCopilot } from './store';
import type { ChatMessage, ContextInfo, EventOf, StatusInfo, Turn } from './types';

/**
 * Dono dos streams do copiloto, fora do React. Cada conversa (por id; as novas, por uma chave provisória
 * `draft:n` até chegar o `start` com o id) tem um estado que o stream vai escrevendo. As vistas (`useChat`)
 * só leem: navegar, trocar de conversa ou fechar o painel não interrompe nada. Só `stopConversation` aborta.
 */

export interface SendInput {
  text: string;
  mentions: { ref: MentionRef; label?: string }[];
  attachments: AttachmentOut[];
  pageContext: PageContext | null;
}

export interface Conversation {
  key: string;
  messages: ChatMessage[];
  status: StatusInfo | null;
  context: ContextInfo | null;
  title: string | null;
  busy: boolean;
  load: { state: 'idle' | 'loading' | 'error'; error?: unknown };
}

export const EMPTY_CONVERSATION: Conversation = {
  key: '',
  messages: [],
  status: null,
  context: null,
  title: null,
  busy: false,
  load: { state: 'idle' },
};

const BATCH_MS = 40;
const TITLE_MARK = '● ';

let queryClient: QueryClient | null = null;
let counter = 0;
const convs = new Map<string, Conversation>();
const runs = new Map<string, AbortController>();
const aliases = new Map<string, string>();
const listeners = new Set<() => void>();

export const bindQueryClient = (qc: QueryClient) => {
  queryClient = qc;
};
const tempId = () => `tmp-${Date.now()}-${counter++}`;
export const newDraftKey = () => `${DRAFT_PREFIX}${Date.now()}-${counter++}`;

const emit = () => {
  for (const l of listeners) l();
};
export const subscribeConversations = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Chave real de uma conversa nova depois de receber o id (ou ela própria). */
export const resolveKey = (key: string): string => aliases.get(key) ?? key;
export const getConversation = (key: string): Conversation =>
  convs.get(resolveKey(key)) ?? EMPTY_CONVERSATION;

function patch(key: string, change: Partial<Conversation> | ((c: Conversation) => Conversation)) {
  const current = convs.get(key) ?? { ...EMPTY_CONVERSATION, key };
  convs.set(key, typeof change === 'function' ? change(current) : { ...current, ...change });
  emit();
}

function rekey(from: string, to: string) {
  const conv = convs.get(from);
  if (conv) {
    convs.delete(from);
    convs.set(to, { ...conv, key: to });
  }
  const ctrl = runs.get(from);
  if (ctrl) {
    runs.delete(from);
    runs.set(to, ctrl);
  }
  aliases.set(from, to);
  rekeyRunning(from, to);
  emit();
}

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

/** Junta a conversa do servidor com o que só existe localmente (sugestões, fontes, memória...). */
export function mergeServerThread(local: ChatMessage[], thread: ThreadOut): ChatMessage[] {
  return thread.messages.map((sm, i) => {
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
}

const fetchThread = (id: string) => {
  if (!queryClient) throw new Error('QueryClient por ligar');
  return queryClient.fetchQuery({
    ...getCopilotThreadOptions({ path: { thread_id: id } }),
    staleTime: 0,
  });
};

/** Carrega (ou recarrega) uma conversa do servidor. Ignorado enquanto ela estiver a gerar. */
export async function loadConversation(id: string, options: { silent?: boolean } = {}) {
  const existing = convs.get(id);
  if (existing?.busy) return;
  if (!options.silent || !existing) patch(id, { load: { state: 'loading' } });
  try {
    const thread = await fetchThread(id);
    if (convs.get(id)?.busy) return;
    patch(id, (c) => ({
      ...c,
      messages: mergeServerThread(c.messages, thread),
      title: thread.title,
      context: {
        usedTokens: thread.used_tokens,
        windowTokens: thread.window_tokens,
        compacted: thread.has_summary,
      },
      load: { state: 'idle' },
    }));
  } catch (error) {
    if (!convs.get(id)?.busy) patch(id, { load: { state: 'error', error } });
  }
}

// ---------------------------------------------------------------------------------------------
// Visibilidade: o utilizador está a ver esta conversa neste momento?

type Surface = 'sheet' | 'page';
const views = new Map<symbol, { surface: Surface; getKey: () => string }>();

export function registerView(surface: Surface, getKey: () => string): () => void {
  const id = Symbol('view');
  views.set(id, { surface, getKey });
  return () => {
    views.delete(id);
  };
}

const pageShowsChat = () => {
  if (typeof window === 'undefined' || !window.location.pathname.startsWith('/chat')) return false;
  const tab = new URLSearchParams(window.location.search).get('tab');
  return !tab || tab === 'chat';
};

export function isConversationVisible(key: string): boolean {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  const real = resolveKey(key);
  for (const v of views.values()) {
    if (resolveKey(v.getKey()) !== real) continue;
    if (v.surface === 'sheet' ? isCopilotSheetOpen() : isChatPageOpen() && pageShowsChat())
      return true;
  }
  return false;
}

/** Se a conversa está à vista, já não há nada por ler. */
export function acknowledgeIfVisible(key: string) {
  const real = resolveKey(key);
  if (!isDraftKey(real) && isConversationVisible(real)) clearUnread(real);
}

// ---------------------------------------------------------------------------------------------
// Avisos ao terminar

let baseTitle: string | null = null;

function markDocumentTitle() {
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return;
  if (baseTitle === null) baseTitle = document.title;
  if (!document.title.startsWith(TITLE_MARK)) document.title = TITLE_MARK + document.title;
}

function restoreDocumentTitle() {
  if (baseTitle !== null && document.title.startsWith(TITLE_MARK)) document.title = baseTitle;
  baseTitle = null;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    restoreDocumentTitle();
    for (const v of views.values()) acknowledgeIfVisible(v.getKey());
  });
}

const conversationLabel = (conv: Conversation): string => {
  if (conv.title) return conv.title;
  const first = conv.messages.find((x) => x.role === 'user')?.text.trim();
  if (first) return first.length > 48 ? `${first.slice(0, 47)}…` : first;
  return m.copilot_untitled();
};

function notifySystem(title: string, tag: string) {
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { tag, silent: true });
  } catch {
    // Alguns browsers só permitem notificações via service worker.
  }
}

function announce(key: string, outcome: 'complete' | 'error') {
  const conv = convs.get(key);
  if (!conv || isConversationVisible(key)) return;
  const real = isDraftKey(key) ? null : key;
  const label = conversationLabel(conv);
  const toastId = `copilot-done-${key}`;
  if (outcome === 'complete') {
    if (real) markUnread(real);
    const text = m.copilot_ready_toast({ title: label });
    toast.success(text, {
      id: toastId,
      duration: 12_000,
      action: real
        ? {
            label: m.copilot_ready_view(),
            onClick: () => {
              clearUnread(real);
              openCopilot({ threadId: real });
            },
          }
        : undefined,
    });
    notifySystem(text, toastId);
  } else {
    const text = m.copilot_failed_toast({ title: label });
    toast.error(text, {
      id: toastId,
      duration: 15_000,
      action: { label: m.copilot_retry(), onClick: () => void retryConversation(key) },
    });
    notifySystem(text, toastId);
  }
  markDocumentTitle();
}

// ---------------------------------------------------------------------------------------------
// O stream

async function run(startKey: string, path: string, body: unknown, first: Turn) {
  const ctrl = new AbortController();
  let key = startKey;
  runs.set(key, ctrl);
  setRunning(key, true);
  patch(key, {
    busy: true,
    status: { phase: 'thinking', labelKey: 'status.thinking', detail: null },
  });

  let turn = first;
  let currentId = first.message.id;
  let queue: CopilotEventMessage[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (queue.length === 0) return;
    const batch = queue;
    queue = [];
    const before = currentId;
    for (const ev of batch) turn = applyEvent(turn, ev);
    currentId = turn.message.id;
    const next = turn.message;
    const snap = turn;
    if (snap.threadId && isDraftKey(key)) {
      rekey(key, snap.threadId);
      key = snap.threadId;
    }
    patch(key, (c) => ({
      ...c,
      messages: c.messages.map((x) => (x.id === before ? next : x)),
      status: snap.status,
      context: snap.context ?? c.context,
      title: snap.title ?? c.title,
    }));
  };

  try {
    await streamEvents(path, body, ctrl.signal, (ev) => {
      queue.push(ev);
      if (timer === null) timer = setTimeout(flush, BATCH_MS);
    });
  } catch (e) {
    if (!ctrl.signal.aborted) {
      const err = errorFrom(e);
      queue.push({
        type: 'error',
        code: err.code as EventOf<'error'>['code'],
        message: err.message,
      });
    }
  }
  if (timer !== null) clearTimeout(timer);
  queue.push(...closingEvents(queue, turn, ctrl.signal.aborted, m.chat_error_connection()));
  flush();
  // Sem `done` (erro antes de acabar), a mensagem não pode ficar a "escrever" para sempre.
  const aborted = ctrl.signal.aborted;
  patch(key, (c) => ({
    ...c,
    busy: false,
    status: null,
    messages: c.messages.map((x) =>
      x.id === currentId && x.state === 'streaming'
        ? { ...x, state: x.error ? 'error' : aborted ? 'cancelled' : 'complete' }
        : x,
    ),
  }));
  runs.delete(key);
  setRunning(key, false);
  if (queryClient) void invalidateCopilot(queryClient);

  const final = convs.get(key)?.messages.find((x) => x.id === currentId);
  if (final?.state === 'complete') announce(key, 'complete');
  else if (final?.state === 'error') announce(key, 'error');
  acknowledgeIfVisible(key);

  if (!isDraftKey(key)) void reconcile(key, currentId);
}

async function reconcile(id: string, localAssistantId: string) {
  try {
    const thread = await fetchThread(id);
    const conv = convs.get(id);
    if (!conv || conv.busy) return;
    // Se a resposta local ainda não existe no servidor (falha antes de gravar), mantém o que há.
    if (!thread.messages.some((x) => x.id === localAssistantId)) return;
    patch(id, { messages: mergeServerThread(conv.messages, thread), title: thread.title });
  } catch {
    // Os ids provisórios continuam a servir; a conversa recarrega ao reabrir.
  }
}

// ---------------------------------------------------------------------------------------------
// Ações públicas

export async function sendMessage(rawKey: string, input: SendInput) {
  const key = resolveKey(rawKey);
  const text = input.text.trim();
  if (!text || convs.get(key)?.busy) return;
  const user: ChatMessage = {
    ...emptyMessage('user', tempId(), text),
    attachments: input.attachments,
    mentions: input.mentions,
  };
  const turn = newTurn(tempId());
  patch(key, (c) => ({ ...c, messages: [...c.messages, user, turn.message] }));
  const body: CopilotStreamRequest = {
    message: text,
    locale: getLocale(),
    thread_id: isDraftKey(key) ? null : key,
    mentions: input.mentions.map((x) => x.ref),
    attachment_ids: input.attachments.map((a) => a.id),
    page_context: input.pageContext,
  };
  await run(key, STREAM_PATH, body, turn);
}

export async function regenerateConversation(rawKey: string) {
  const key = resolveKey(rawKey);
  const conv = convs.get(key);
  if (!conv || isDraftKey(key) || conv.busy) return;
  const last = conv.messages[conv.messages.length - 1];
  const base = last?.role === 'assistant' ? conv.messages.slice(0, -1) : conv.messages;
  const turn = newTurn(tempId());
  patch(key, { messages: [...base, turn.message] });
  await run(key, regeneratePath(key, getLocale()), undefined, turn);
}

export async function retryConversation(rawKey: string) {
  const key = resolveKey(rawKey);
  if (!isDraftKey(key)) {
    await regenerateConversation(key);
    return;
  }
  const conv = convs.get(key);
  const lastUser = conv ? [...conv.messages].reverse().find((x) => x.role === 'user') : undefined;
  if (!conv || !lastUser || conv.busy) return;
  patch(key, { messages: [] });
  await sendMessage(key, {
    text: lastUser.text,
    mentions: lastUser.mentions,
    attachments: lastUser.attachments,
    pageContext: null,
  });
}

/** Parar: o único caminho (além de apagar a conversa) que aborta um stream. */
export function stopConversation(rawKey: string) {
  runs.get(resolveKey(rawKey))?.abort();
}

/** Aborta tudo o que gerava para esta conversa e esquece-a (conversa apagada). */
export function discardConversation(rawKey: string) {
  const key = resolveKey(rawKey);
  runs.get(key)?.abort();
  clearUnread(key);
}

export function updateMessages(rawKey: string, change: (messages: ChatMessage[]) => ChatMessage[]) {
  const key = resolveKey(rawKey);
  patch(key, (c) => ({ ...c, messages: change(c.messages) }));
}

export function clearAllNotices() {
  clearAllUnread();
  if (typeof document !== 'undefined') restoreDocumentTitle();
}

/** Só para testes. */
export function resetStreamManager() {
  for (const ctrl of runs.values()) ctrl.abort();
  convs.clear();
  runs.clear();
  aliases.clear();
  views.clear();
  emit();
}
