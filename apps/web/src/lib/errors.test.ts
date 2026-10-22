import { afterEach, vi } from 'vitest';
import { overwriteGetLocale } from '@/paraglide/runtime';
import {
  classifyError,
  ForbiddenError,
  getErrorCode,
  getErrorMessage,
  isChunkError,
  isTransient,
} from './errors';

afterEach(() => overwriteGetLocale(() => 'pt-PT'));

describe('getErrorMessage', () => {
  it('traduz o código estável da API, nunca a mensagem técnica', () => {
    const error = { code: 'invalid_credentials', message: 'Wrong email or password' };
    expect(getErrorMessage(error)).toBe('Email ou palavra-passe incorretos.');
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

describe('classifyError', () => {
  it('reconhece cada família pelo código da API', () => {
    expect(classifyError({ code: 'forbidden', message: '' })).toBe('forbidden');
    expect(classifyError(new ForbiddenError('admin'))).toBe('forbidden');
    expect(classifyError({ code: 'not_found', message: '' })).toBe('not_found');
    expect(classifyError({ code: 'session_expired', message: '' })).toBe('session');
    expect(classifyError({ code: 'unauthenticated', message: '' })).toBe('session');
    expect(classifyError({ code: 'service_unavailable', message: '' })).toBe('maintenance');
    expect(classifyError({ code: 'internal_error', message: '' })).toBe('generic');
    expect(classifyError(new Error('boom'))).toBe('generic');
  });

  it('distingue falha de rede, versão nova e bug nosso (TypeError)', () => {
    expect(classifyError(new TypeError('Failed to fetch'))).toBe('offline');
    expect(classifyError(new TypeError('Load failed'))).toBe('offline');
    expect(classifyError(new TypeError('undefined is not a function'))).toBe('generic');
    const chunk = new TypeError('Failed to fetch dynamically imported module: /assets/x.js');
    expect(isChunkError(chunk)).toBe(true);
    expect(classifyError(chunk)).toBe('chunk');
  });

  it('sem rede, um ficheiro em falta é rede e não versão nova', () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(classifyError(new TypeError('Failed to fetch dynamically imported module'))).toBe(
      'offline',
    );
    online.mockRestore();
  });

  it('só rede e API a reiniciar são passageiras (reintentam sozinhas)', () => {
    expect(isTransient('offline')).toBe(true);
    expect(isTransient('maintenance')).toBe(true);
    expect(isTransient('forbidden')).toBe(false);
    expect(isTransient('generic')).toBe(false);
  });

  it('traduz o código só do cliente', () => {
    expect(getErrorMessage({ code: 'service_unavailable', message: '' })).toMatch(/a atualizar/);
  });
});
