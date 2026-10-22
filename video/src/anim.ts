import { Easing, interpolate, spring } from 'remotion';
import { FPS } from './theme';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0 → 1 entre `start` e `start + dur` com saída suave. */
export function prog(frame: number, start: number, dur: number, easing = easeOut): number {
  return interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing });
}

/** Mola sem ressalto exagerado, para entradas. */
export function pop(frame: number, start: number, damping = 18): number {
  return spring({ frame: frame - start, fps: FPS, config: { damping, stiffness: 140, mass: 0.7 } });
}

/** Entrada típica: sobe 40 px e aparece. */
export function rise(frame: number, start: number, dur = 18, dist = 40) {
  const p = prog(frame, start, dur);
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` };
}

/** Saída: desaparece nos últimos `dur` fotogramas de uma cena com `total` fotogramas. */
export function fadeOut(frame: number, total: number, dur = 10): number {
  return interpolate(frame, [total - dur, total], [1, 0], clamp);
}

/** Valor por fotogramas-chave [[fotograma, valor], ...], com transição suave entre eles. */
export function kf(frame: number, keys: Array<[number, number]>): number {
  if (keys.length === 0) return 0;
  const first = keys[0] as [number, number];
  if (frame <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1] as [number, number];
    const b = keys[i] as [number, number];
    if (frame <= b[0]) return interpolate(frame, [a[0], b[0]], [a[1], b[1]], { ...clamp, easing: easeInOut });
  }
  return (keys[keys.length - 1] as [number, number])[1];
}
