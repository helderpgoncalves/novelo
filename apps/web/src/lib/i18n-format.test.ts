import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from './i18n';

describe('formatDate', () => {
  it('aceita uma data simples sem mudar de dia', () => {
    expect(formatDate('2028-04-17', 'medium')).toMatch(/2028/);
    expect(formatDate('2028-04-17', 'medium')).toMatch(/17/);
  });

  it('aceita um carimbo ISO completo (created_at) sem rebentar', () => {
    expect(() => formatDate('2026-10-20T16:28:35.441297+00:00')).not.toThrow();
    expect(formatDate('2026-10-20T16:28:35.441297+00:00')).toMatch(/2026/);
  });

  it('aceita um Date', () => {
    expect(formatDate(new Date(Date.UTC(2026, 9, 20)))).toMatch(/2026/);
  });

  it('valores vazios ou inválidos dão um traço', () => {
    expect(formatDate('')).toBe('—');
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('não é uma data')).toBe('—');
    expect(formatDate(new Date('x'))).toBe('—');
  });
});

describe('formatDateTime', () => {
  it('formata data e hora e nunca levanta', () => {
    expect(formatDateTime('2026-10-20T16:28:35+00:00')).toMatch(/2026/);
    expect(formatDateTime('lixo')).toBe('—');
    expect(formatDateTime(null)).toBe('—');
  });
});
