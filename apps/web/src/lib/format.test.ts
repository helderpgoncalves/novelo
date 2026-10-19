import { afterEach } from 'vitest';
import { overwriteGetLocale } from '@/paraglide/runtime';
import { formatKg, formatPercent, formatTonnes } from './format';
import { formatList, weekdayShort } from './i18n';

afterEach(() => overwriteGetLocale(() => 'pt-PT'));

describe('format (pt-PT)', () => {
  it('usa vírgula decimal e unidade', () => {
    expect(formatTonnes(301.265)).toBe('301,3 t');
    expect(formatPercent(22.9)).toBe('22,9%');
    expect(formatKg(0.1607)).toBe('0,16 kg');
  });

  it('formata listas e dias da semana', () => {
    expect(formatList(['Nova Etapa', 'Vitrus'])).toBe('Nova Etapa e Vitrus');
    expect(weekdayShort(1)).toMatch(/^seg/i);
  });
});

describe('format (en)', () => {
  it('usa ponto decimal e "and" nas listas', () => {
    overwriteGetLocale(() => 'en');
    expect(formatTonnes(301.265)).toBe('301.3 t');
    expect(formatList(['Nova Etapa', 'Vitrus'])).toBe('Nova Etapa and Vitrus');
    expect(weekdayShort(1)).toMatch(/^mon/i);
  });
});
