import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import type { CopilotEventMessage } from '@/client';
import { pieSlices } from './artifacts/chart-options';
import { parseBlocks, renderInline } from './markdown';
import { applyEvent, closingEvents, fromServer, newTurn } from './reducer';
import { parseSseBlock, splitSse } from './sse';
import { familyOf, indicatorLabelKey } from './thinking';
import { applyTrigger, findTrigger } from './triggers';
import {
  applyWebSearch,
  domainInitial,
  safeWebUrl,
  sourceDomain,
  splitSources,
  stepCount,
  webSearchNotes,
} from './web';

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

  it('desenha a ligação do PDF mesmo com espaços dentro dos parênteses e sem a tratar como rota do web', () => {
    for (const text of [
      '[Transferir o PDF](/api/v1/reports/abc/pdf)',
      '[Transferir o PDF]( /api/v1/reports/abc/pdf )',
    ]) {
      const link = renderInline(text).find(isValidElement);
      expect(link?.type).toBe('a');
      expect((link?.props as { href: string } | undefined)?.href).toBe('/api/v1/reports/abc/pdf');
    }
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

describe('pesquisa na web', () => {
  const web = {
    kind: 'web' as const,
    label: 'Diretiva (UE) 2025/1892',
    ref: 'https://www.eur-lex.europa.eu/x',
    domain: 'eur-lex.europa.eu',
    excerpt: 'Responsabilidade alargada do produtor.',
    external: true,
  };

  it('abre a pesquisa e fecha-a com done, mantendo a consulta', () => {
    const turn = run([
      { type: 'web_search', state: 'searching', query: 'rap têxtil portugal' },
      { type: 'web_search', state: 'done', results: 5, requests: 1 },
    ]);
    expect(turn.message.webSearches).toEqual([
      { state: 'done', query: 'rap têxtil portugal', results: 5, requests: 1, reason: null },
    ]);
  });

  it('um estado final sem pesquisa aberta cria uma entrada (indisponível, bloqueada, saltada)', () => {
    const turn = run([
      { type: 'web_search', state: 'unavailable', reason: 'region' },
      { type: 'web_search', state: 'blocked', reason: 'query_blocked', query: null },
      { type: 'web_search', state: 'skipped', reason: 'disabled_by_user' },
    ]);
    expect(turn.message.webSearches.map((w) => w.reason)).toEqual([
      'region',
      'query_blocked',
      'disabled_by_user',
    ]);
    expect(webSearchNotes(turn.message.webSearches)).toHaveLength(3);
    expect(
      webSearchNotes(
        applyWebSearch(
          turn.message.webSearches,
          turn.message.webSearches[0] ?? {
            state: 'unavailable',
            query: null,
            results: 0,
            requests: 0,
            reason: 'region',
          },
        ),
      ),
    ).toHaveLength(3);
  });

  it('só uma pesquisa concluída não gera aviso e conta como passo', () => {
    const turn = run([
      { type: 'tool_start', id: 't', name: 'web_search', args_summary: 'x' },
      { type: 'web_search', state: 'searching', query: 'x' },
      { type: 'tool_result', id: 't', name: 'web_search', ok: true, summary: 's', duration_ms: 5 },
      { type: 'web_search', state: 'done', results: 2 },
    ]);
    expect(webSearchNotes(turn.message.webSearches)).toEqual([]);
    expect(stepCount(turn.message)).toBe(1);
  });

  it('separa fontes internas e web, e só aceita URLs http(s)', () => {
    const internal = { kind: 'tool' as const, label: 'Cenário' };
    const { internal: i, web: w } = splitSources([internal, web]);
    expect(i).toEqual([internal]);
    expect(w).toEqual([web]);
    expect(safeWebUrl('https://a.pt/x')).toBe('https://a.pt/x');
    expect(safeWebUrl('javascript:alert(1)')).toBeNull();
    expect(safeWebUrl(null)).toBeNull();
    expect(sourceDomain({ ...web, domain: null, ref: 'https://www.ine.pt/a' })).toBe('ine.pt');
    expect(domainInitial('eur-lex.europa.eu')).toBe('E');
  });

  it('guarda os números externos da verificação', () => {
    const turn = run([{ type: 'verification', verified: true, external_numbers: [30, 4.5] }]);
    expect(turn.message.verification?.externalNumbers).toEqual([30, 4.5]);
    expect(
      run([{ type: 'verification', verified: true }]).message.verification?.externalNumbers,
    ).toEqual([]);
  });

  it('ao recarregar a conversa mostra as fontes web guardadas', () => {
    const msg = fromServer({
      id: 'm1',
      role: 'assistant',
      text: 'x',
      status: 'complete',
      created_at: '2026-10-20T10:00:00Z',
      attachments: [],
      mentions: [],
      cards: [],
      artifacts: [],
      actions: [],
      tools: [],
      verified: true,
      feedback: null,
      model: null,
      web_sources: [{ ...web, kind: 'web', external: undefined }],
    } as unknown as Parameters<typeof fromServer>[0]);
    expect(msg.sources).toHaveLength(1);
    expect(msg.sources[0]?.external).toBe(true);
  });

  it('família de frases para os novos estados', () => {
    expect(familyOf('status.searching_web')).toBe('web');
    expect(familyOf('status.finding_gaps')).toBe('coverage');
    expect(
      indicatorLabelKey(
        {
          text: '',
          tools: [],
          webSearches: [{ state: 'searching', query: 'x', results: 0, requests: 0, reason: null }],
        },
        null,
      ),
    ).toBe('status.searching_web');
  });
});

describe('gráfico circular', () => {
  it('ignora valores não positivos e calcula as quotas', () => {
    const slices = pieSlices({
      kind: 'pie',
      title: 't',
      source: 's',
      x_label: 'x',
      y_label: 'y',
      series: [
        {
          name: 'a',
          points: [
            { x: 'A', y: 30 },
            { x: 'B', y: 10 },
            { x: 'C', y: 0 },
            { x: 'D', y: null },
            { x: 'E', y: -5 },
          ],
        },
      ],
    } as never);
    expect(slices.map((s) => s.name)).toEqual(['A', 'B']);
    expect(slices[0]?.share).toBeCloseTo(0.75);
  });
});

describe('etiqueta do ecrã atual', () => {
  it('não repete «Cenário» quando o nome já o traz', async () => {
    const { scenarioLabel } = await import('./page-context');
    const { m } = await import('@/paraglide/messages');
    const plain = m.cp_page_scenario_plain();
    expect(scenarioLabel(`${plain} A`)).toBe(`${plain} A`);
    expect(scenarioLabel('Robusto B')).toBe(m.cp_page_scenario({ name: 'Robusto B' }));
    expect(scenarioLabel(undefined)).toBe(plain);
  });
});
