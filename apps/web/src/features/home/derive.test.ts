import { describe, expect, it } from 'vitest';
import type { Overview, OverviewMilestone, OverviewParish } from '@/client';
import { daysUntil, eprDeadline, questionInputs, trustCounts, trustItems } from './derive';

describe('daysUntil', () => {
  it('conta dias de calendário', () => {
    expect(daysUntil('2028-04-17', new Date(2026, 9, 20, 23, 59))).toBe(545);
    expect(daysUntil('2025-01-01', new Date(2026, 0, 1))).toBeLessThan(0);
  });
});

describe('eprDeadline', () => {
  const now = new Date(2026, 9, 20, 12);
  it('usa o marco da API e conta os dias na hora', () => {
    const d = eprDeadline(
      [
        {
          who_pays: 'producers',
          date: '2028-04-17',
          source_label: 'X',
          verified: true,
        } as OverviewMilestone,
      ],
      now,
    );
    expect(d.days).toBe(545);
    expect(d.sourceLabel).toBe('X');
  });
  it('recai no prazo conhecido sem marco e nunca fica negativo', () => {
    expect(eprDeadline([], now).date).toBe('2028-04-17');
    expect(eprDeadline([], new Date(2030, 0, 1)).days).toBe(0);
  });
});

describe('trustItems', () => {
  const parishes = (n: number) => [{ containers_count: n } as OverviewParish];
  it('as localizações de contentores de têxteis estão em falta até chegarem', () => {
    const missing = trustItems({ parishes: parishes(0) });
    expect(missing.find((i) => i.key === 'textile_containers')?.status).toBe('missing');
    expect(
      trustItems({ parishes: parishes(3) }).find((i) => i.key === 'textile_containers')?.status,
    ).toBe('measured');
  });
  it('conta os três estados', () => {
    const c = trustCounts(trustItems({ parishes: parishes(0) }));
    expect(c.measured + c.estimate + c.missing).toBe(11);
    expect(c.missing).toBe(2);
  });
});

describe('questionInputs', () => {
  it('usa as freguesias com mais potencial e uma meta redonda', () => {
    const overview = {
      gap: { collected_t: 301.3, missing_t: 1016 },
      parishes: [
        { name: 'A', potential_t: 5 },
        { name: 'B', potential_t: 50 },
        { name: 'C', potential_t: 20 },
        { name: 'D', potential_t: 1 },
      ],
    } as unknown as Overview;
    const q = questionInputs(overview, 40000);
    expect(q.topParishes).toEqual(['B', 'C', 'A']);
    expect(q.targetT).toBe(560);
    expect(q.budgetEur).toBe(40000);
  });
});

describe('datas inválidas', () => {
  const now = new Date(2026, 9, 20, 12);
  it('daysUntil aceita carimbos ISO e dá null a vazios e inválidos', () => {
    expect(daysUntil('2028-04-17T00:00:00+00:00', now)).toBe(545);
    expect(daysUntil('', now)).toBeNull();
    expect(daysUntil(undefined, now)).toBeNull();
    expect(daysUntil('não é data', now)).toBeNull();
    expect(daysUntil('2028-13-40', now)).toBeNull();
  });
  it('eprDeadline recai no prazo conhecido quando a data do marco é inválida', () => {
    const bad = {
      who_pays: 'producers',
      date: 'xx',
      source_label: '',
      verified: true,
    } as OverviewMilestone;
    const d = eprDeadline([bad], now);
    expect(d.date).toBe('2028-04-17');
    expect(d.days).toBe(545);
    expect(d.sourceLabel).toBe('Diretiva (UE) 2025/1892');
  });
});
