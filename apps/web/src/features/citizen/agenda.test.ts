import { describe, expect, it } from 'vitest';
import type { CollectionAgendaOut, PublicAgendaEntry } from '@/client';
import { agendaByDay, agendaView, cadenceLabel, channelLabel, nextRoundWeekday } from './agenda';

const entry = (over: Partial<PublicAgendaEntry>): PublicAgendaEntry => ({
  parish_code: '010101',
  parish_name: 'Azurém',
  channel: 'on_demand',
  weekday: 2,
  every_weeks: 1,
  rounds_year: 52,
  frequency: 'weekly',
  ...over,
});

describe('agendaByDay', () => {
  it('devolve vazio sem agenda publicada (nulo ou lista vazia)', () => {
    expect(agendaByDay(null)).toEqual([]);
    expect(agendaByDay(undefined)).toEqual([]);
    expect(agendaByDay([])).toEqual([]);
  });

  it('agrupa por dia pela ordem do calendário e ordena freguesias', () => {
    const days = agendaByDay([
      entry({ parish_name: 'Creixomil', weekday: 3 }),
      entry({ parish_name: 'Azurém', weekday: 2 }),
      entry({ parish_name: 'Polvoreira', weekday: 3 }),
    ]);
    expect(days.map((d) => d.weekday)).toEqual([2, 3]);
    expect(days[1]?.entries.map((e) => e.parish_name)).toEqual(['Creixomil', 'Polvoreira']);
  });
});

describe('nextRoundWeekday', () => {
  it('escolhe o próximo dia à frente no calendário (quarta-feira)', () => {
    // 2026-01-14 foi uma quarta-feira (ISO 4)
    expect(nextRoundWeekday([2, 4], new Date(2026, 0, 14))).toBe(4);
  });

  it('dá a volta à semana: sexta-feira com rondas à segunda e à quarta → segunda', () => {
    // 2026-01-16 foi uma sexta-feira (ISO 5)
    expect(nextRoundWeekday([2, 4], new Date(2026, 0, 16))).toBe(2);
  });

  it('no próprio dia da ronda, salta para a seguinte', () => {
    expect(nextRoundWeekday([2, 4], new Date(2026, 0, 13))).toBe(4); // 13 foi terça-feira
  });

  it('domingo conta como dia 7 e devolve a primeira ronda da semana', () => {
    expect(nextRoundWeekday([2], new Date(2026, 0, 18))).toBe(2); // 18 foi domingo
  });

  it('sem rondas não há próximo dia', () => {
    expect(nextRoundWeekday([], new Date())).toBeNull();
  });
});

describe('etiquetas', () => {
  it('cadência em palavras', () => {
    expect(cadenceLabel(1)).toBe('todas as semanas');
    expect(cadenceLabel(2)).toBe('de 2 em 2 semanas');
    expect(cadenceLabel(13)).toBe('de 13 em 13 semanas');
  });

  it('canal: à porta ou nos locais', () => {
    expect(channelLabel('on_demand')).toBe('à porta');
    expect(channelLabel('existing')).toBe('nos locais');
  });
});

describe('agendaView', () => {
  const ready: CollectionAgendaOut = {
    agenda: [entry({})],
    scenario_label: 'Cenário B',
    updated_at: '2026-11-17T10:00:00Z',
  };

  it('carregar sem dados', () => {
    expect(agendaView(undefined, false)).toEqual({ kind: 'loading' });
  });

  it('erro mostra mensagem, não fica eternamente à espera', () => {
    expect(agendaView(undefined, true)).toEqual({
      kind: 'empty',
      message: 'Não foi possível carregar a agenda.',
    });
  });

  it('sem agenda publicada diz-o com honestidade (nunca inventa dias)', () => {
    expect(agendaView({ agenda: null, scenario_label: null, updated_at: null }, false).kind).toBe(
      'empty',
    );
    expect(agendaView({ agenda: [], scenario_label: 'x', updated_at: null }, false).kind).toBe(
      'empty',
    );
  });

  it('com agenda, está pronto e traz o cenário de origem', () => {
    const view = agendaView(ready, false);
    expect(view.kind).toBe('ready');
    if (view.kind === 'ready') {
      expect(view.scenarioLabel).toBe('Cenário B');
      expect(view.agenda[0]?.weekday).toBe(2);
    }
  });
});
