import { describe, expect, it } from 'vitest';
import { shortHost } from './qr-url';

describe('shortHost', () => {
  it('mostra só o domínio', () => {
    expect(shortHost('https://novelo.helder.si/join?c=x')).toBe('novelo.helder.si');
  });
  it('devolve o texto se não for um URL', () => {
    expect(shortHost('texto solto')).toBe('texto solto');
  });
});
