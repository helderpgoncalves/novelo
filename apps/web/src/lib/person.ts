/** Lógica pura de apresentação de uma pessoa: nome, iniciais e cor estável. */

export interface Person {
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'van', 'von', 'del', 'di']);

const clean = (value: string | null | undefined): string => (value ?? '').trim();

const localPart = (email: string): string => email.split('@')[0] ?? '';

const upperFirst = (text: string): string =>
  text ? text.charAt(0).toLocaleUpperCase('pt-PT') + text.slice(1) : text;

/** O nome a mostrar: `name`; se faltar, a parte local do email com a 1.ª letra maiúscula (nunca o email inteiro). */
export function displayName(person: Person): string {
  const name = clean(person.name);
  if (name) return name;
  return upperFirst(localPart(clean(person.email)));
}

const stripMarks = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '');

const words = (text: string, separators: RegExp): string[] =>
  stripMarks(text)
    .split(separators)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);

/** 1–2 letras maiúsculas, sem acentos: primeira e última palavra do nome; senão, do email. Vazio se nada servir. */
export function initialsOf(person: Person): string {
  const name = clean(person.name);
  let parts = name ? words(name, /\s+/) : [];
  if (parts.length > 2) {
    const significant = parts.filter((w) => !PARTICLES.has(w.toLowerCase()));
    if (significant.length >= 2) parts = significant;
  }
  if (parts.length === 0) parts = words(localPart(clean(person.email)), /[._\-+\s]+/);
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return [first, last]
    .filter((w): w is string => Boolean(w))
    .map((w) => w.charAt(0).toLocaleUpperCase('pt-PT'))
    .join('');
}

export interface AvatarTone {
  /** Claro: fundo e texto. */
  bg: string;
  fg: string;
  /** Escuro: fundo e texto. */
  darkBg: string;
  darkFg: string;
}

/** Tons suaves da paleta da marca (floresta, areia, pedra) e vizinhos; texto com contraste AA (≥ 4,5:1) nos dois temas. */
export const AVATAR_TONES: readonly AvatarTone[] = [
  { bg: '#d6e6de', fg: '#1f4a3c', darkBg: '#1f3a31', darkFg: '#a9d3c1' },
  { bg: '#ebddc0', fg: '#5a4520', darkBg: '#3a3220', darkFg: '#e3cb98' },
  { bg: '#dde2df', fg: '#2f3a36', darkBg: '#2a3531', darkFg: '#c5d0cb' },
  { bg: '#f0d5cc', fg: '#7a2e22', darkBg: '#4a2a24', darkFg: '#f0b8ab' },
  { bg: '#d5e0ea', fg: '#26425a', darkBg: '#23364a', darkFg: '#b4cce2' },
  { bg: '#e4d6e4', fg: '#55305a', darkBg: '#3e2a42', darkFg: '#ddb9e2' },
  { bg: '#e2e4c6', fg: '#4a4f1a', darkBg: '#3a3c1c', darkFg: '#d0d48c' },
  { bg: '#f2dfc4', fg: '#7a4a12', darkBg: '#4a3418', darkFg: '#edc48c' },
];

/** FNV-1a de 32 bits: determinístico e barato. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** O tom da pessoa: sempre o mesmo para o mesmo email (sem maiúsculas nem espaços), senão para o nome. */
export function toneOf(person: Person): AvatarTone {
  const key = clean(person.email).toLowerCase() || clean(person.name).toLowerCase();
  return AVATAR_TONES[hashString(key) % AVATAR_TONES.length] ?? (AVATAR_TONES[0] as AvatarTone);
}

const channel = (hex: string, offset: number): number => {
  const c = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number =>
  0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);

/** Razão de contraste WCAG entre duas cores `#rrggbb`. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
