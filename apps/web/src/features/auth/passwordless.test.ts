import { beforeEach, describe, expect, it } from 'vitest';
import {
  looksLikeEmail,
  mailProvider,
  readLastEmail,
  safeNext,
  secondsLeft,
  storeLastEmail,
} from './passwordless';

describe('safeNext', () => {
  it('aceita caminhos da própria app, com query e hash', () => {
    expect(safeNext('/simulator')).toBe('/simulator');
    expect(safeNext('/pt/lots?tab=open#x')).toBe('/pt/lots?tab=open#x');
  });
  it('recusa tudo o que sai da app', () => {
    for (const bad of [
      '//evil.pt',
      'https://evil.pt',
      '/\\evil.pt',
      'javascript:alert(1)',
      '/ok\nHeader: x',
      '',
    ]) {
      expect(safeNext(bad)).toBe('/');
    }
    expect(safeNext(undefined)).toBe('/');
    expect(safeNext(null)).toBe('/');
    expect(safeNext(`/${'a'.repeat(600)}`)).toBe('/');
  });
});

describe('secondsLeft', () => {
  it('conta para trás até zero e arredonda para cima', () => {
    expect(secondsLeft(0, 0)).toBe(30);
    expect(secondsLeft(0, 1)).toBe(30);
    expect(secondsLeft(0, 1001)).toBe(29);
    expect(secondsLeft(0, 29_999)).toBe(1);
    expect(secondsLeft(0, 30_000)).toBe(0);
    expect(secondsLeft(0, 90_000)).toBe(0);
    expect(secondsLeft(1000, 11_000, 15)).toBe(5);
  });
});

describe('mailProvider', () => {
  it('identifica os fornecedores comuns', () => {
    expect(mailProvider('ana@gmail.com')?.name).toBe('Gmail');
    expect(mailProvider('Ana@Hotmail.com')?.name).toBe('Outlook');
    expect(mailProvider('ana@outlook.pt')?.name).toBe('Outlook');
    expect(mailProvider('ana@icloud.com')?.name).toBe('iCloud Mail');
  });
  it('não adivinha domínios próprios', () => {
    expect(mailProvider('ana@camara.pt')).toBeNull();
    expect(mailProvider('sem-arroba')).toBeNull();
  });
});

describe('looksLikeEmail', () => {
  it('distingue o óbvio', () => {
    expect(looksLikeEmail(' a@b.pt ')).toBe(true);
    expect(looksLikeEmail('a@b')).toBe(false);
    expect(looksLikeEmail('a b@c.pt')).toBe(false);
  });
});

describe('último email', () => {
  beforeEach(() => window.localStorage.clear());
  it('guarda e lê só emails válidos', () => {
    expect(readLastEmail()).toBe('');
    storeLastEmail('x');
    expect(readLastEmail()).toBe('');
    storeLastEmail(' ana@gmail.com ');
    expect(readLastEmail()).toBe('ana@gmail.com');
  });
});
