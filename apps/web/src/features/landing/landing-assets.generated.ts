// GERADO por scripts/brand/hero_derivatives.py (`just brand-landing`). Não editar à mão.
// Nomes com hash do conteúdo: o ficheiro nunca muda sem o nome mudar (cache imutável).

export type HeroTone = 'light' | 'dark';
export type HeroSource = { readonly w: number; readonly src: string };
export type HeroFamily = Record<
  HeroTone,
  { avif: readonly HeroSource[]; webp: readonly HeroSource[] }
>;

export const HERO_WIDE_MEDIA = '(min-width: 640px) and (min-aspect-ratio: 6/5)';
export const HERO_WIDE_SIZES = 'max(100vw, min(160vh, 1536px))';
export const HERO_TALL_SIZES = '100vw';
/** Cor média do céu: fundo sólido do hero enquanto a imagem carrega. */
export const HERO_SKY: Record<HeroTone, string> = { light: '#EFE8DC', dark: '#2E382C' };
/** Dimensões intrínsecas (largura, altura) da variante mais pequena de cada família. */
export const HERO_INTRINSIC = { wide: [960, 600], tall: [544, 680] } as const;

export const HERO_WIDE: HeroFamily = {
  light: {
    avif: [
      { w: 960, src: 'hero-wide-light-960.3c917fa4.avif' },
      { w: 1440, src: 'hero-wide-light-1440.1d9426a5.avif' },
      { w: 1920, src: 'hero-wide-light-1920.50418952.avif' },
      { w: 2400, src: 'hero-wide-light-2400.3dc52f9f.avif' },
    ],
    webp: [
      { w: 960, src: 'hero-wide-light-960.677b8191.webp' },
      { w: 1440, src: 'hero-wide-light-1440.416c53e8.webp' },
      { w: 1920, src: 'hero-wide-light-1920.0f68a5a9.webp' },
      { w: 2400, src: 'hero-wide-light-2400.fcc892d2.webp' },
    ],
  },
  dark: {
    avif: [
      { w: 960, src: 'hero-wide-dark-960.feab0cea.avif' },
      { w: 1440, src: 'hero-wide-dark-1440.3615641d.avif' },
      { w: 1920, src: 'hero-wide-dark-1920.40a3f9d2.avif' },
      { w: 2400, src: 'hero-wide-dark-2400.5e267de3.avif' },
    ],
    webp: [
      { w: 960, src: 'hero-wide-dark-960.34d6da75.webp' },
      { w: 1440, src: 'hero-wide-dark-1440.4a4b8dad.webp' },
      { w: 1920, src: 'hero-wide-dark-1920.d9a8d5fb.webp' },
      { w: 2400, src: 'hero-wide-dark-2400.84fc1d53.webp' },
    ],
  },
};

export const HERO_TALL: HeroFamily = {
  light: {
    avif: [
      { w: 544, src: 'hero-tall-light-544.eccc635e.avif' },
      { w: 816, src: 'hero-tall-light-816.f85bc935.avif' },
      { w: 1088, src: 'hero-tall-light-1088.244ea27a.avif' },
      { w: 1360, src: 'hero-tall-light-1360.2089b2fa.avif' },
    ],
    webp: [
      { w: 544, src: 'hero-tall-light-544.774777eb.webp' },
      { w: 816, src: 'hero-tall-light-816.ac03377b.webp' },
      { w: 1088, src: 'hero-tall-light-1088.243f5b69.webp' },
      { w: 1360, src: 'hero-tall-light-1360.3662dea1.webp' },
    ],
  },
  dark: {
    avif: [
      { w: 544, src: 'hero-tall-dark-544.2eea3c9c.avif' },
      { w: 816, src: 'hero-tall-dark-816.0742d644.avif' },
      { w: 1088, src: 'hero-tall-dark-1088.97b152c8.avif' },
      { w: 1360, src: 'hero-tall-dark-1360.f7d971b3.avif' },
    ],
    webp: [
      { w: 544, src: 'hero-tall-dark-544.a0f20180.webp' },
      { w: 816, src: 'hero-tall-dark-816.9850b85b.webp' },
      { w: 1088, src: 'hero-tall-dark-1088.4fb68d9c.webp' },
      { w: 1360, src: 'hero-tall-dark-1360.a500d0c6.webp' },
    ],
  },
};
