import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ActionOut } from '@/client';
import { isDraftKey } from './generation';
import { useCopilotUi } from './store';
import {
  acknowledgeIfVisible,
  bindQueryClient,
  getConversation,
  loadConversation,
  newDraftKey,
  regenerateConversation,
  registerView,
  resolveKey,
  retryConversation,
  type SendInput,
  sendMessage,
  stopConversation,
  subscribeConversations,
  updateMessages,
} from './stream-manager';
import type { ChatMessage } from './types';

export type { SendInput } from './stream-manager';

interface Options {
  threadId: string | null;
  onThreadId: (id: string | null) => void;
  /** Onde esta vista aparece: o painel ⌘K ou a página /chat (decide se a resposta "está à vista"). */
  surface?: 'sheet' | 'page';
}

/**
 * Vista sobre uma conversa do gestor de streams (`stream-manager.ts`): o stream não pertence a este hook,
 * por isso continua ao desmontar, trocar de conversa ou mudar de painel para página. Mesma API de sempre.
 */
export function useChat({ threadId, onThreadId, surface = 'page' }: Options) {
  const qc = useQueryClient();
  bindQueryClient(qc);
  // Conversa nova (sem id): chave provisória, que o gestor resolve para o id real quando chega o `start`.
  const [draft, setDraft] = useState(newDraftKey);
  const rawKey = threadId ?? draft;
  const key = resolveKey(rawKey);
  const keyRef = useRef(key);
  keyRef.current = key;
  const rawKeyRef = useRef(rawKey);
  rawKeyRef.current = rawKey;

  const conv = useSyncExternalStore(
    subscribeConversations,
    () => getConversation(rawKey),
    () => getConversation(rawKey),
  );
  const ui = useCopilotUi();

  const onThreadIdRef = useRef(onThreadId);
  onThreadIdRef.current = onThreadId;

  // O stream desta conversa nova recebeu o id: sobe-o ao dono (URL ou painel).
  useEffect(() => {
    if (threadId === null && !isDraftKey(key)) onThreadIdRef.current(key);
  }, [threadId, key]);

  // Abre a conversa pedida: mostra o que há e atualiza do servidor (salvo se estiver a gerar).
  useEffect(() => {
    if (!isDraftKey(key)) void loadConversation(key, { silent: true });
  }, [key]);

  useEffect(() => registerView(surface, () => keyRef.current), [surface]);

  // À vista (painel aberto, página montada): a resposta pronta deixa de estar "por ler".
  // biome-ignore lint/correctness/useExhaustiveDependencies: `ui.sheetOpen` e `key` mudam o que está à vista.
  useEffect(() => {
    acknowledgeIfVisible(key);
  }, [key, ui.sheetOpen]);

  const send = useCallback((input: SendInput) => sendMessage(rawKeyRef.current, input), []);
  const regenerate = useCallback(() => regenerateConversation(rawKeyRef.current), []);
  const retry = useCallback(() => retryConversation(rawKeyRef.current), []);
  const stop = useCallback(() => stopConversation(rawKeyRef.current), []);

  // "Nova conversa" larga esta vista; a resposta que estiver a gerar continua em segundo plano.
  const newChat = useCallback(() => {
    setDraft(newDraftKey());
    onThreadIdRef.current(null);
  }, []);

  const patchMessage = useCallback((id: string, patch: (m: ChatMessage) => ChatMessage) => {
    updateMessages(rawKeyRef.current, (list) => list.map((x) => (x.id === id ? patch(x) : x)));
  }, []);

  const updateAction = useCallback((action: ActionOut) => {
    updateMessages(rawKeyRef.current, (list) =>
      list.map((x) =>
        x.actions.some((a) => a.id === action.id)
          ? { ...x, actions: x.actions.map((a) => (a.id === action.id ? action : a)) }
          : x,
      ),
    );
  }, []);

  const reload = useCallback(() => {
    const k = keyRef.current;
    if (!isDraftKey(k)) void loadConversation(k);
  }, []);

  return {
    messages: conv.messages,
    busy: conv.busy,
    status: conv.status,
    context: conv.context,
    title: conv.title,
    load: conv.load,
    threadId: isDraftKey(key) ? null : key,
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
