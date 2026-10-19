import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatTurn, CopilotReply } from '@/client';
import { copilotChatMutation } from '@/client/@tanstack/react-query.gen';
import { getLocale } from '@/lib/i18n';

export interface CopilotMessage {
  id: string;
  role: ChatTurn['role'];
  content: string;
  reply?: CopilotReply;
}

const STORAGE_KEY = 'novelo.copilot.v1';
const MAX_TURNS = 20;

function load(): CopilotMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CopilotMessage[]) : [];
  } catch {
    return [];
  }
}

function save(messages: CopilotMessage[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Sem armazenamento (janela privada): a conversa fica só em memória.
  }
}

let counter = 0;
const nextId = () => `${Date.now()}-${counter++}`;

/** Conversa do copiloto: o servidor não guarda nada, por isso enviamos o histórico em cada pedido. */
export function useCopilot(scenarioId?: string) {
  const [messages, setMessages] = useState<CopilotMessage[]>(load);
  const [error, setError] = useState<unknown>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const chat = useMutation(copilotChatMutation());

  useEffect(() => save(messages), [messages]);

  const request = useCallback(
    (history: CopilotMessage[]) => {
      setError(null);
      chat.mutate(
        {
          body: {
            locale: getLocale(),
            scenario_id: scenarioId ?? null,
            messages: history
              .slice(-MAX_TURNS)
              .map(({ role, content }): ChatTurn => ({ role, content })),
          },
        },
        {
          onSuccess: (reply) =>
            setMessages((prev) => [
              ...prev,
              { id: nextId(), role: 'assistant', content: reply.text, reply },
            ]),
          onError: (e) => setError(e),
        },
      );
    },
    [chat, scenarioId],
  );

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || chat.isPending) return;
      const next = [...messagesRef.current, { id: nextId(), role: 'user' as const, content }];
      setMessages(next);
      request(next);
    },
    [chat.isPending, request],
  );

  const retry = useCallback(() => request(messagesRef.current), [request]);
  const reset = useCallback(() => {
    chat.reset();
    setError(null);
    setMessages([]);
  }, [chat]);

  return { messages, send, retry, reset, pending: chat.isPending, error };
}
