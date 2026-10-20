import { afterEach } from 'vitest';
import { overwriteGetLocale } from '@/paraglide/runtime';
import { formatEur, formatKg, formatNumber, formatPercent, formatTonnes } from './format';
import { formatList, weekdayShort } from './i18n';

afterEach(() => overwriteGetLocale(() => 'pt-PT'));

describe('format (pt-PT)', () => {
  it('usa vírgula decimal e unidade', () => {
    expect(formatTonnes(301.265)).toBe('301,3 t');
    expect(formatPercent(22.9)).toBe('22,9%');
    expect(formatKg(0.1607)).toBe('0,16 kg');
  });

  it('agrupa os milhares a partir de 1 000 (regra única)', () => {
    const group = (text: string) => text.replace(/\s/g, ' ');
    expect(group(formatNumber(999))).toBe('999');
    expect(group(formatNumber(1317))).toBe('1 317');
    expect(group(formatNumber(2751))).toBe('2 751');
    expect(group(formatTonnes(1317, 0))).toBe('1 317 t');
    expect(group(formatEur(1500))).toBe('1 500 €');
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
