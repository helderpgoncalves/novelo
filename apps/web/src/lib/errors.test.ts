import { afterEach } from 'vitest';
import { overwriteGetLocale } from '@/paraglide/runtime';
import { getErrorCode, getErrorMessage } from './errors';

afterEach(() => overwriteGetLocale(() => 'pt-PT'));

describe('getErrorMessage', () => {
  it('traduz o código estável da API, nunca a mensagem técnica', () => {
    const error = { code: 'invalid_credentials', message: 'Wrong email or password' };
    expect(getErrorMessage(error)).toBe('Email ou password incorretos.');
    overwriteGetLocale(() => 'en');
    expect(getErrorMessage(error)).toBe('Wrong email or password.');
    expect(getErrorCode(error)).toBe('invalid_credentials');
  });

  it('trata falhas de rede e erros desconhecidos', () => {
    expect(getErrorMessage(new TypeError('fetch failed'))).toMatch(/Sem ligação/);
    expect(getErrorMessage({ foo: 'bar' })).toMatch(/Algo correu mal/);
    expect(getErrorCode(null)).toBeNull();
  });
});
