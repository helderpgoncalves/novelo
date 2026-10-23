import { afterEach, describe, expect, it } from 'vitest';
import { overwriteGetLocale } from '@/paraglide/runtime';
import {
  CREDIT_MAX,
  creditProblem,
  formatPhotoCredit,
  NO_PHOTO_CHOICE,
  normaliseCredit,
  photoActionFor,
  photoAlt,
  photoChoiceReady,
  photoErrorMessage,
  photoRequestFrom,
} from './lot-photos';

afterEach(() => overwriteGetLocale(() => 'pt-PT'));

const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

describe('crédito', () => {
  it('colapsa espaços e trata vazio como sem crédito', () => {
    expect(normaliseCredit('  Maria   Silva,\n CC BY 4.0 ')).toBe('Maria Silva, CC BY 4.0');
    expect(normaliseCredit('   ')).toBeNull();
  });

  it('recusa HTML e textos acima de 240 caracteres', () => {
    expect(creditProblem('Autor <b>x</b>')).toBe('html');
    expect(creditProblem('a'.repeat(CREDIT_MAX))).toBeNull();
    expect(creditProblem('a'.repeat(CREDIT_MAX + 1))).toBe('too_long');
    expect(creditProblem('')).toBeNull();
  });

  it('formata a legenda só quando há atribuição', () => {
    expect(formatPhotoCredit(' Ana, CC0 ')).toBe('Crédito: Ana, CC0');
    expect(formatPhotoCredit(null)).toBeNull();
    expect(formatPhotoCredit('  ')).toBeNull();
  });
});

describe('decisão de guardar a fotografia', () => {
  it('por omissão não guarda nada e não bloqueia a confirmação', () => {
    expect(photoChoiceReady(NO_PHOTO_CHOICE)).toBe(true);
    expect(photoRequestFrom(NO_PHOTO_CHOICE, file)).toBeNull();
  });

  it('exige o consentimento quando se pede para guardar', () => {
    const asked = { ...NO_PHOTO_CHOICE, save: true };
    expect(photoChoiceReady(asked)).toBe(false);
    expect(photoRequestFrom(asked, file)).toBeNull();
    expect(photoChoiceReady({ ...asked, confirmed: true })).toBe(true);
  });

  it('um crédito inválido bloqueia, mesmo com consentimento', () => {
    expect(photoChoiceReady({ save: true, confirmed: true, credit: '<script>' })).toBe(false);
  });

  it('cria o pedido com o crédito normalizado, ou nulo', () => {
    expect(photoRequestFrom({ save: true, confirmed: true, credit: '  Ana  CC0 ' }, file)).toEqual({
      file,
      credit: 'Ana CC0',
    });
    expect(photoRequestFrom({ save: true, confirmed: true, credit: '' }, file)?.credit).toBeNull();
    expect(photoRequestFrom({ save: true, confirmed: true, credit: '' }, null)).toBeNull();
  });
});

describe('estado do lote', () => {
  it('só acrescenta ou substitui antes da entrega', () => {
    expect(photoActionFor(false, 'collected')).toBe('add');
    expect(photoActionFor(true, 'sorted')).toBe('replace');
    expect(photoActionFor(false, 'delivered')).toBeNull();
    expect(photoActionFor(true, 'delivered')).toBeNull();
  });
});

describe('texto alternativo', () => {
  it('inclui o tipo de peça e a marca quando existe', () => {
    expect(photoAlt('tshirt', null)).toBe('Fotografia da peça: T-shirt');
    expect(photoAlt('tshirt', 'Zara')).toBe('Fotografia da peça: T-shirt, marca Zara');
  });
});

describe('erros', () => {
  it('traduz consent_required e o 409 de lote entregue', () => {
    expect(photoErrorMessage({ code: 'consent_required', message: 'x' })).toMatch(/confirmação/);
    expect(photoErrorMessage({ code: 'conflict', message: 'x' })).toMatch(/já foi entregue/);
    overwriteGetLocale(() => 'en');
    expect(photoErrorMessage({ code: 'conflict', message: 'x' })).toMatch(/already been delivered/);
  });

  it('outros erros seguem o mapa geral', () => {
    expect(photoErrorMessage({ code: 'rate_limited', message: 'x' })).not.toMatch(/entregue/);
  });
});
