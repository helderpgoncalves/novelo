import { describe, expect, it } from 'vitest';
import type { CopilotEventMessage } from '@/client';
import { parseBlocks } from './markdown';
import { applyEvent, closingEvents, newTurn } from './reducer';
import { parseSseBlock, splitSse } from './sse';
import { familyOf, indicatorLabelKey } from './thinking';
import { applyTrigger, findTrigger } from './triggers';

const run = (events: CopilotEventMessage[]) =>
  events.reduce((turn, ev) => applyEvent(turn, ev), newTurn('tmp'));

describe('SSE', () => {
  it('ignora comentários e junta várias linhas data', () => {
    expect(parseSseBlock(': ping')).toBeNull();
    const ev = parseSseBlock('event: text_delta\ndata: {"type":"text_delta","delta":"Olá"}');
    expect(ev).toEqual({ type: 'text_delta', delta: 'Olá' });
    expect(parseSseBlock('data: não é json')).toBeNull();
  });

  it('separa blocos completos e guarda o resto', () => {
    const { blocks, rest } = splitSse('data: {"a":1}\r\n\r\n: ping\n\ndata: {"b"');
    expect(blocks).toHaveLength(2);
    expect(rest).toBe('data: {"b"');
  });
});

describe('reducer do stream', () => {
  it('acumula texto, troca o id no start e fecha no done', () => {
    const turn = run([
      { type: 'start', thread_id: 't1', message_id: 'm1', model: 'x', prompt_version: 'v2' },
      { type: 'status', phase: 'tool', label_key: 'status.running_optimizer', detail: 'Barco' },
      { type: 'text_delta', delta: 'Olá ' },
      { type: 'text_delta', delta: 'mundo' },
      { type: 'done', finish: 'stop' },
    ]);
    expect(turn.message.id).toBe('m1');
    expect(turn.threadId).toBe('t1');
    expect(turn.message.text).toBe('Olá mundo');
    expect(turn.message.state).toBe('complete');
    expect(turn.status).toBeNull();
  });

  it('retract apaga o texto e a verificação', () => {
    const turn = run([
      { type: 'text_delta', delta: 'valor errado' },
      { type: 'verification', verified: false, warning: 'numbers_unverified' },
      { type: 'retract', reason: 'numbers_unverified' },
    ]);
    expect(turn.message.text).toBe('');
    expect(turn.message.retracted).toBe(true);
    expect(turn.message.verification).toBeNull();
  });

  it('erro marca a mensagem e done não a reabre; cancelado fica cancelado', () => {
    const failed = run([
      { type: 'error', code: 'ai_budget_exceeded', message: 'x' },
      { type: 'done', finish: 'error' },
    ]);
    expect(failed.message.state).toBe('error');
    expect(run([{ type: 'done', finish: 'cancelled' }]).message.state).toBe('cancelled');
  });

  it('ferramentas, ações e memória entram sem duplicar', () => {
    const turn = run([
      { type: 'tool_start', id: 'a', name: 'get_baseline', args_summary: '' },
      {
        type: 'tool_result',
        id: 'a',
        name: 'get_baseline',
        ok: true,
        summary: 'ok',
        duration_ms: 3,
      },
      {
        type: 'memory',
        action: 'added',
        target: 'user',
        content: 'gosta de t/ano',
        status: 'applied',
        entry_id: 'e1',
      },
    ]);
    expect(turn.message.tools).toHaveLength(1);
    expect(turn.message.tools[0]?.ok).toBe(true);
    expect(turn.message.memory[0]?.entryId).toBe('e1');
  });
});

describe('gatilhos do campo', () => {
  it('deteta menções e comandos', () => {
    expect(findTrigger('compara @Bar', 12)).toEqual({ kind: 'mention', query: 'Bar', start: 8 });
    expect(findTrigger('olá a@b', 7)).toBeNull();
    expect(findTrigger('/comp', 5)).toEqual({ kind: 'command', query: 'comp', start: 0 });
    expect(findTrigger('/compact agora', 14)).toBeNull();
  });

  it('aplica a menção escolhida e devolve o cursor', () => {
    const trigger = findTrigger('vê @Ba', 6);
    expect(trigger).not.toBeNull();
    if (!trigger) return;
    expect(applyTrigger('vê @Ba', 6, trigger, '@Barco')).toEqual({ text: 'vê @Barco ', caret: 10 });
  });
});

describe('frases e markdown', () => {
  it('agrupa os label_key em famílias de frases', () => {
    expect(familyOf('status.running_optimizer')).toBe('optimizer');
    expect(familyOf('status.reading_attachment')).toBe('attachment');
    expect(familyOf('status.algo_novo')).toBe('working');
  });

  it('lê títulos, listas, tabelas e código', () => {
    const blocks = parseBlocks(
      '# Título\n\n- a\n- b\n\n| x | y |\n|---|---|\n| 1 | 2 |\n\n```\ncódigo\n```',
    );
    expect(blocks.map((b) => b.kind)).toEqual(['h', 'ul', 'table', 'code']);
  });
});

describe('fecho do stream (regressão do erro de 1 ms)', () => {
  const done: CopilotEventMessage = { type: 'done', finish: 'stop' };
  const fresh = () => newTurn('tmp-1');

  it('não inventa erro quando o `done` ainda está na fila', () => {
    expect(closingEvents([done], fresh(), false, 'ligação')).toEqual([]);
  });

  it('não inventa erro quando o `done` já foi aplicado', () => {
    expect(closingEvents([], applyEvent(fresh(), done), false, 'ligação')).toEqual([]);
  });

  it('sem `done` e sem cancelar, o stream cortado é erro de ligação', () => {
    expect(closingEvents([], fresh(), false, 'ligação')).toEqual([
      { type: 'error', code: 'connection', message: 'ligação' },
    ]);
  });

  it('cancelar fecha com `done` cancelado', () => {
    expect(closingEvents([], fresh(), true, 'ligação')).toEqual([
      { type: 'done', finish: 'cancelled' },
    ]);
  });

  it('um erro do servidor já na fila não é duplicado', () => {
    const err: CopilotEventMessage = { type: 'error', code: 'upstream_error', message: 'x' };
    expect(closingEvents([err], fresh(), false, 'ligação')).toEqual([]);
  });
});

describe('indicador de trabalho (logo a girar)', () => {
  const fold = (events: CopilotEventMessage[]) => run(events);
  const streaming = (t: ReturnType<typeof run>) => t.message.state === 'streaming';

  it('mantém-se durante texto, ferramentas e até ao done', () => {
    let turn = newTurn('tmp-1');
    const steps: CopilotEventMessage[] = [
      { type: 'status', phase: 'thinking', label_key: 'status.thinking' },
      { type: 'text_delta', delta: 'Olá' },
      { type: 'tool_start', id: 'a', name: 'get_baseline', args_summary: '' },
      { type: 'text_delta', delta: ' mundo' },
    ];
    for (const ev of steps) {
      turn = applyEvent(turn, ev);
      expect(streaming(turn)).toBe(true);
    }
    expect(indicatorLabelKey(turn.message, turn.status)).toBe('status.thinking');
    expect(streaming(fold([...steps, { type: 'done', finish: 'stop' }]))).toBe(false);
  });

  it('a fase deduz-se quando não há status', () => {
    const base = newTurn('t').message;
    expect(indicatorLabelKey(base, null)).toBe('status.thinking');
    expect(indicatorLabelKey({ ...base, text: 'x' }, null)).toBe('status.writing');
    const tool = { id: 'a', name: 'n', args: '', summary: null, ok: null, durationMs: null };
    expect(indicatorLabelKey({ ...base, text: 'x', tools: [tool] }, null)).toBe('status.working');
    expect(
      indicatorLabelKey(base, {
        phase: 'tool',
        labelKey: 'status.running_optimizer',
        detail: null,
      }),
    ).toBe('status.running_optimizer');
  });

  it('erro e cancelamento terminam o estado streaming', () => {
    expect(streaming(fold([{ type: 'error', code: 'ai_budget_exceeded', message: 'x' }]))).toBe(
      false,
    );
    expect(streaming(fold([{ type: 'done', finish: 'cancelled' }]))).toBe(false);
  });
});
