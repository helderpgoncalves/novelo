import { describe, expect, it } from 'vitest';
import { AVATAR_TONES, contrastRatio, displayName, hashString, initialsOf, toneOf } from './person';

describe('displayName', () => {
  it('usa o nome quando existe', () => {
    expect(displayName({ name: '  Ana Silva ', email: 'a@x.pt' })).toBe('Ana Silva');
  });
  it('sem nome usa a parte local do email com maiúscula, nunca o email inteiro', () => {
    expect(displayName({ name: null, email: 'helder@heldergoncalves.io' })).toBe('Helder');
    expect(displayName({ name: '  ', email: 'flavio.f@x.pt' })).toBe('Flavio.f');
  });
  it('vazio quando não há nada', () => {
    expect(displayName({})).toBe('');
  });
});

describe('initialsOf', () => {
  it('primeira e última palavra do nome', () => {
    expect(initialsOf({ name: 'Hélder Gonçalves' })).toBe('HG');
    expect(initialsOf({ name: 'Ana Maria Pereira Silva' })).toBe('AS');
  });
  it('ignora partículas em nomes compostos', () => {
    expect(initialsOf({ name: 'Maria da Silva' })).toBe('MS');
    expect(initialsOf({ name: 'João de Deus dos Santos' })).toBe('JS');
  });
  it('remove acentos e passa a maiúsculas', () => {
    expect(initialsOf({ name: 'álvaro éder' })).toBe('AE');
    expect(initialsOf({ name: 'Ângela' })).toBe('A');
  });
  it('uma só palavra dá uma letra', () => {
    expect(initialsOf({ name: 'Madonna' })).toBe('M');
  });
  it('sem nome usa o email, separando por ponto, hífen e sublinhado', () => {
    expect(initialsOf({ email: 'helder.goncalves@x.pt' })).toBe('HG');
    expect(initialsOf({ email: 'ana_maria-silva@x.pt' })).toBe('AS');
    expect(initialsOf({ name: '', email: 'flavio@x.pt' })).toBe('F');
  });
  it('vazio quando não há nada utilizável', () => {
    expect(initialsOf({})).toBe('');
    expect(initialsOf({ name: '  ', email: '' })).toBe('');
    expect(initialsOf({ name: '---' })).toBe('');
  });
});

describe('toneOf', () => {
  it('o mesmo email dá sempre a mesma cor, ignorando maiúsculas e espaços', () => {
    expect(toneOf({ email: 'Ana@x.pt' })).toBe(toneOf({ email: ' ana@x.pt ' }));
    expect(hashString('ana@x.pt')).toBe(hashString('ana@x.pt'));
  });
  it('distribui por vários tons', () => {
    const used = new Set(
      Array.from({ length: 200 }, (_, i) => toneOf({ email: `pessoa${i}@x.pt` })),
    );
    expect(used.size).toBeGreaterThanOrEqual(6);
  });
  it('sem email usa o nome', () => {
    expect(toneOf({ name: 'Ana' })).toBe(toneOf({ name: 'ana' }));
  });
  it('todos os tons cumprem AA (4,5:1) em claro e escuro', () => {
    for (const t of AVATAR_TONES) {
      expect(contrastRatio(t.bg, t.fg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.darkBg, t.darkFg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('contrastRatio', () => {
  it('preto sobre branco é 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });
});
