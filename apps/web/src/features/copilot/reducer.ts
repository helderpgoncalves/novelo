import type { CopilotEventMessage, MessageOut } from '@/client';
import type { ChatMessage, MemoryNote, ToolStep, Turn } from './types';

export function emptyMessage(role: ChatMessage['role'], id: string, text = ''): ChatMessage {
  return {
    id,
    role,
    text,
    state: role === 'assistant' ? 'streaming' : 'complete',
    createdAt: new Date().toISOString(),
    attachments: [],
    mentions: [],
    cards: [],
    artifacts: [],
    actions: [],
    tools: [],
    plan: [],
    clarify: null,
    memory: [],
    sources: [],
    suggestions: [],
    verification: null,
    navigate: [],
    retracted: false,
    feedback: null,
    model: null,
    error: null,
  };
}

export function newTurn(messageId: string): Turn {
  return {
    message: emptyMessage('assistant', messageId),
    threadId: null,
    status: null,
    context: null,
    title: null,
    finish: null,
  };
}

const upsert = <T extends { id: string }>(items: T[], item: T): T[] =>
  items.some((i) => i.id === item.id)
    ? items.map((i) => (i.id === item.id ? item : i))
    : [...items, item];

/** Aplica um evento do stream à volta em curso (função pura: é o que os testes cobrem). */
export function applyEvent(turn: Turn, event: CopilotEventMessage): Turn {
  const msg = turn.message;
  const set = (patch: Partial<ChatMessage>): Turn => ({ ...turn, message: { ...msg, ...patch } });
  switch (event.type) {
    case 'start':
      return {
        ...turn,
        threadId: event.thread_id,
        message: { ...msg, id: event.message_id, model: event.model },
      };
    case 'status':
      return {
        ...turn,
        status: { phase: event.phase, labelKey: event.label_key, detail: event.detail ?? null },
      };
    case 'context':
      return {
        ...turn,
        context: {
          usedTokens: event.used_tokens,
          windowTokens: event.window_tokens,
          compacted: event.compacted,
        },
      };
    case 'title':
      return { ...turn, title: event.title };
    case 'text_delta':
      return set({ text: msg.text + event.delta });
    case 'retract':
      return set({ text: '', retracted: true, verification: null });
    case 'plan':
      return set({ plan: event.steps });
    case 'tool_start': {
      const step: ToolStep = {
        id: event.id,
        name: event.name,
        args: event.args_summary,
        summary: null,
        ok: null,
        durationMs: null,
      };
      return set({ tools: upsert(msg.tools, step) });
    }
    case 'tool_result':
      return set({
        tools: upsert(msg.tools, {
          id: event.id,
          name: event.name,
          args: msg.tools.find((t) => t.id === event.id)?.args ?? '',
          summary: event.summary,
          ok: event.ok,
          durationMs: event.duration_ms,
        }),
      });
    case 'card':
      return set({
        cards: [...msg.cards.filter((c) => c.scenario_id !== event.card.scenario_id), event.card],
      });
    case 'artifact':
      return set({
        artifacts: upsert(msg.artifacts, {
          id: event.id,
          title: event.title,
          sources: event.sources,
          artifact: event.artifact,
        }),
      });
    case 'confirm':
    case 'action_result':
      return set({ actions: upsert(msg.actions, event.action) });
    case 'memory': {
      const note: MemoryNote = {
        action: event.action,
        target: event.target,
        content: event.content,
        status: event.status,
        entryId: event.entry_id ?? null,
        previous: event.previous ?? null,
        reason: event.reason ?? null,
      };
      return set({ memory: [...msg.memory, note] });
    }
    case 'clarify':
      return set({ clarify: { question: event.question, options: event.options } });
    case 'sources':
      return set({ sources: event.items });
    case 'suggestions':
      return set({ suggestions: event.items });
    case 'verification':
      return set({ verification: { verified: event.verified, warning: event.warning ?? null } });
    case 'navigate':
      return set({
        navigate: [
          ...msg.navigate,
          {
            label: event.label,
            route: event.route,
            params: event.params ?? {},
            search: event.search ?? {},
          },
        ],
      });
    case 'error':
      return set({ error: { code: event.code, message: event.message }, state: 'error' });
    case 'usage':
      return turn;
    case 'done': {
      const finish = event.finish ?? 'stop';
      const state = finish === 'stop' ? 'complete' : finish === 'cancelled' ? 'cancelled' : 'error';
      return {
        ...turn,
        finish,
        status: null,
        message: { ...msg, state: msg.error ? 'error' : state },
      };
    }
    default:
      return turn;
  }
}

/** Mensagem guardada no servidor para o formato do ecrã. */
export function fromServer(message: MessageOut): ChatMessage {
  return {
    ...emptyMessage(message.role, message.id, message.text),
    state: message.status,
    createdAt: message.created_at,
    attachments: message.attachments,
    mentions: message.mentions.map((ref) => ({ ref })),
    cards: message.cards,
    artifacts: message.artifacts,
    actions: message.actions,
    tools: message.tools.map((t, i) => ({
      id: `${message.id}-${i}`,
      name: t.name,
      args: '',
      summary: t.summary,
      ok: t.ok,
      durationMs: null,
    })),
    verification:
      message.verified === null
        ? null
        : { verified: message.verified, warning: message.verified ? null : 'numbers_unverified' },
    feedback: message.feedback,
    model: message.model,
  };
}
