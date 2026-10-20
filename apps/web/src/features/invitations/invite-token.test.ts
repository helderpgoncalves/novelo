import { afterEach, describe, expect, it } from 'vitest';
import { forgetToken, looksLikeToken, readToken } from './invite-token';

const TOKEN = 'abcDEF123_-abcDEF123_-abcDEF123_-xyz';

afterEach(() => window.sessionStorage.clear());

describe('looksLikeToken', () => {
  it('aceita tokens opacos e recusa o resto antes de chegar à API', () => {
    expect(looksLikeToken(TOKEN)).toBe(true);
    expect(looksLikeToken('curto')).toBe(false);
    expect(looksLikeToken('com espaços e símbolos <script>alert(1)</script>')).toBe(false);
    expect(looksLikeToken('a'.repeat(300))).toBe(false);
    expect(looksLikeToken('')).toBe(false);
    expect(looksLikeToken(null)).toBe(false);
    expect(looksLikeToken(undefined)).toBe(false);
  });
});

describe('readToken / forgetToken', () => {
  it('lê do URL e guarda na sessão do separador para sobreviver a um refresh', () => {
    expect(readToken(TOKEN)).toBe(TOKEN);
    expect(readToken(undefined)).toBe(TOKEN);
  });

  it('nunca usa localStorage', () => {
    readToken(TOKEN);
    expect(window.localStorage.length).toBe(0);
  });

  it('esquece o token depois de usado', () => {
    readToken(TOKEN);
    forgetToken();
    expect(readToken(undefined)).toBeNull();
  });

  it('um valor inválido no URL não substitui nem inventa token', () => {
    expect(readToken('inválido!')).toBeNull();
    readToken(TOKEN);
    expect(readToken('inválido!')).toBe(TOKEN);
  });
});
