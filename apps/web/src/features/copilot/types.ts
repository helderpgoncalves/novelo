import type {
  ActionOut,
  ArtifactEnvelope,
  AttachmentOut,
  CopilotEventMessage,
  CopilotSource,
  MentionRef,
  ScenarioCard,
} from '@/client';

export type EventOf<T extends CopilotEventMessage['type']> = Extract<
  CopilotEventMessage,
  { type: T }
>;

export interface ToolStep {
  id: string;
  name: string;
  args: string;
  summary: string | null;
  ok: boolean | null;
  durationMs: number | null;
}

export interface MemoryNote {
  action: EventOf<'memory'>['action'];
  target: EventOf<'memory'>['target'];
  content: string;
  status: EventOf<'memory'>['status'];
  entryId: string | null;
  previous: string | null;
  reason: string | null;
  /** Já desfeito pela pessoa neste ecrã. */
  undone?: boolean;
}

export interface NavigateHint {
  label: string;
  route: string;
  params: Record<string, string>;
  search: Record<string, string>;
}

export type MessageState = 'streaming' | 'complete' | 'cancelled' | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  state: MessageState;
  createdAt: string;
  attachments: AttachmentOut[];
  /** Menções enviadas; o rótulo só existe nas mensagens escritas neste ecrã. */
  mentions: { ref: MentionRef; label?: string }[];
  cards: ScenarioCard[];
  artifacts: ArtifactEnvelope[];
  actions: ActionOut[];
  tools: ToolStep[];
  plan: string[];
  clarify: { question: string; options: string[] } | null;
  memory: MemoryNote[];
  sources: CopilotSource[];
  suggestions: string[];
  verification: { verified: boolean; warning: 'numbers_unverified' | null } | null;
  navigate: NavigateHint[];
  /** O texto foi apagado por falhar a verificação dos números. */
  retracted: boolean;
  feedback: 1 | -1 | null;
  model: string | null;
  error: { code: string; message: string } | null;
}

export interface StatusInfo {
  phase: EventOf<'status'>['phase'];
  labelKey: string;
  detail: string | null;
}

export interface ContextInfo {
  usedTokens: number;
  windowTokens: number;
  compacted: boolean;
}

/** O estado de uma volta em curso: a mensagem do assistente mais o que só interessa enquanto decorre. */
export interface Turn {
  message: ChatMessage;
  threadId: string | null;
  status: StatusInfo | null;
  context: ContextInfo | null;
  title: string | null;
  finish: 'stop' | 'cancelled' | 'error' | null;
}
