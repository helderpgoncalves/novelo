import type { CopilotEventMessage } from '@/client';
import { authFetch } from '@/lib/api-config';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

/** Um bloco SSE (linhas até à linha em branco) para o JSON do evento; `: ping` e comentários dão `null`. */
export function parseSseBlock(block: string): CopilotEventMessage | null {
  const data: string[] = [];
  for (const raw of block.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line === '' || line.startsWith(':')) continue;
    if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  if (data.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(data.join('\n'));
    if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
      return parsed as CopilotEventMessage;
    }
  } catch {
    // Linha cortada ou lixo: ignora-se, o stream continua.
  }
  return null;
}

/** Divide o que já chegou em blocos completos e o resto por fechar. */
export function splitSse(buffer: string): { blocks: string[]; rest: string } {
  const parts = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const rest = parts.pop() ?? '';
  return { blocks: parts, rest };
}

export class StreamHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

/**
 * POST que devolve `text/event-stream`: lê o corpo com `ReadableStream`, entrega cada evento e termina
 * quando o servidor fecha ou o `signal` aborta. Erros antes do stream (HTTP não-200) lançam `StreamHttpError`
 * com o corpo `{code, message}` da API.
 */
export async function streamEvents(
  path: string,
  body: unknown,
  signal: AbortSignal,
  onEvent: (event: CopilotEventMessage) => void,
): Promise<void> {
  const res = await authFetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const payload: unknown = await res.json().catch(() => null);
    throw new StreamHttpError(res.status, payload);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { blocks, rest } = splitSse(buffer);
      buffer = rest;
      for (const block of blocks) {
        const event = parseSseBlock(block);
        if (event) onEvent(event);
      }
    }
    buffer += decoder.decode();
    const tail = parseSseBlock(buffer);
    if (tail) onEvent(tail);
  } finally {
    reader.releaseLock();
  }
}

export const STREAM_PATH = '/api/v1/copilot/stream';
export const regeneratePath = (threadId: string, locale: string) =>
  `/api/v1/copilot/threads/${encodeURIComponent(threadId)}/regenerate?locale=${encodeURIComponent(locale)}`;
