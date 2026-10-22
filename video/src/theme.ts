// Tokens da marca (docs/marca/guia-de-marca.md).
export const C = {
  linho: '#F4F1EA',
  tinta: '#14211D',
  noite: '#0F1815',
  floresta: '#2E6B57',
  florestaClara: '#7FB39C',
  pedra: '#5E6B66',
  pedraEscura: '#46534E',
  areia: '#C4A06A',
  linha: '#DCD5C8',
  fioEscuro: '#2A3A33',
  linhoSuave: '#ECE7DC',
} as const;

export const FONT = {
  title: 'Newsreader, Georgia, serif',
  text: 'Inter, system-ui, sans-serif',
} as const;

export const FPS = 30;
/** 100 BPM: uma batida = 18 fotogramas, um compasso = 72. A música é gerada sobre a mesma grelha. */
export const BEAT = 18;
export const BAR = BEAT * 4;
