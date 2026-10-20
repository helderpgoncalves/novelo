import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const streamEvents = vi.fn();
vi.mock('./sse', async (orig) => ({
  ...(await orig<typeof import('./sse')>()),
  streamEvents: (...a: unknown[]) => streamEvents(...a),
}));

import { toast } from 'sonner';
import { resetGeneration } from './generation';
import {
  getConversation,
  newDraftKey,
  resetStreamManager,
  sendMessage,
  stopConversation,
} from './stream-manager';

const input = { text: 'Olá', mentions: [], attachments: [], pageContext: null };

beforeEach(() => {
  resetStreamManager();
  resetGeneration();
  vi.clearAllMocks();
});

describe('gestor de streams', () => {
  it('continua sem vista, passa de rascunho a id e avisa ao terminar fora de vista', async () => {
    streamEvents.mockImplementation(async (_p, _b, _s, on) => {
      on({ type: 'start', thread_id: 't1', message_id: 'm1', model: 'x', prompt_version: 'v' });
      on({ type: 'text_delta', delta: 'Boa' });
      on({ type: 'done', finish: 'stop' });
    });
    const draft = newDraftKey();
    await sendMessage(draft, input);
    const conv = getConversation(draft); // resolve o alias para t1
    expect(conv.key).toBe('t1');
    expect(conv.busy).toBe(false);
    expect(conv.messages.at(-1)?.text).toBe('Boa');
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('Parar aborta e não avisa', async () => {
    streamEvents.mockImplementation(
      (_p, _b, signal: AbortSignal) =>
        new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve())),
    );
    const draft = newDraftKey();
    const pending = sendMessage(draft, input);
    expect(getConversation(draft).busy).toBe(true);
    stopConversation(draft);
    await pending;
    expect(getConversation(draft).messages.at(-1)?.state).toBe('cancelled');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('erro fora de vista mostra toast com Tentar de novo', async () => {
    streamEvents.mockRejectedValue(new Error('x'));
    await sendMessage(newDraftKey(), input);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
