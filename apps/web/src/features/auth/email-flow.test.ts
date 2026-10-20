import { describe, expect, it } from 'vitest';
import {
  classifySendError,
  cooldownStart,
  isBlockingFailure,
  resendButton,
  supportMailto,
} from './email-flow';

const apiError = (code: string) => ({ code, message: 'x' });

describe('classifySendError', () => {
  it('distingue os três casos que o ecrã trata à parte', () => {
    expect(classifySendError(apiError('email_unavailable'))).toBe('unavailable');
    expect(classifySendError(apiError('email_suppressed'))).toBe('suppressed');
    expect(classifySendError(apiError('rate_limited'))).toBe('rate_limited');
  });

  it('o resto é «other»; sem erro não há falha', () => {
    expect(classifySendError(apiError('captcha_failed'))).toBe('other');
    expect(classifySendError(new TypeError('Failed to fetch'))).toBe('other');
    expect(classifySendError(null)).toBeNull();
    expect(classifySendError(undefined)).toBeNull();
  });
});

describe('isBlockingFailure', () => {
  it('só indisponível e suprimido trocam o ecrã de sucesso', () => {
    expect(isBlockingFailure('unavailable')).toBe(true);
    expect(isBlockingFailure('suppressed')).toBe(true);
    expect(isBlockingFailure('rate_limited')).toBe(false);
    expect(isBlockingFailure('other')).toBe(false);
    expect(isBlockingFailure(null)).toBe(false);
  });
});

describe('cooldownStart', () => {
  it('um 429 bloqueia o reenvio a partir de agora; as outras falhas não', () => {
    expect(cooldownStart('rate_limited', 1000)).toBe(1000);
    expect(cooldownStart('unavailable', 1000)).toBeNull();
    expect(cooldownStart(null, 1000)).toBeNull();
  });
});

describe('resendButton', () => {
  it('conta 30 s desde o envio e liberta no fim', () => {
    expect(resendButton(0, 0, false)).toEqual({ disabled: true, seconds: 30 });
    expect(resendButton(0, 10_500, false)).toEqual({ disabled: true, seconds: 20 });
    expect(resendButton(0, 30_000, false)).toEqual({ disabled: false, seconds: 0 });
  });

  it('fica desativado enquanto o pedido corre, mesmo sem espera', () => {
    expect(resendButton(0, 60_000, true)).toEqual({ disabled: true, seconds: 0 });
  });
});

describe('supportMailto', () => {
  it('monta um mailto com o email da pessoa no corpo', () => {
    const href = supportMailto('ana@exemplo.pt', 'link');
    expect(href.startsWith('mailto:')).toBe(true);
    expect(decodeURIComponent(href)).toContain('ana@exemplo.pt');
  });
});
