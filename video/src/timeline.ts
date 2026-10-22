import { BAR } from './theme';

/** Cenas em compassos (100 BPM, 72 fotogramas por compasso). A música (scripts/music.py) lê o mesmo ficheiro. */
export const SCENES = [
  { id: 'open', bars: 2, bg: 'dark' },
  { id: 'counter', bars: 3, bg: 'dark' },
  { id: 'waffle', bars: 3, bg: 'light' },
  { id: 'destination', bars: 2, bg: 'light' },
  { id: 'law', bars: 4, bg: 'light' },
  { id: 'map', bars: 3, bg: 'dark' },
  { id: 'pivot', bars: 4, bg: 'light' },
  { id: 'network', bars: 5, bg: 'dark' },
  { id: 'results', bars: 5, bg: 'light' },
  { id: 'montage', bars: 12, bg: 'light' },
  { id: 'criteria', bars: 3, bg: 'light' },
  { id: 'rigor', bars: 2, bg: 'dark' },
  { id: 'close', bars: 4, bg: 'dark' },
] as const;

export type SceneId = (typeof SCENES)[number]['id'];

export const TIMELINE = (() => {
  let at = 0;
  return SCENES.map((s) => {
    const from = at;
    at += s.bars * BAR;
    return { ...s, from, dur: s.bars * BAR };
  });
})();

/** Fotogramas extra no fim, para a última nota da música soar. */
export const TAIL = 48;
export const TOTAL_FRAMES = TIMELINE.reduce((a, s) => a + s.dur, 0) + TAIL;
