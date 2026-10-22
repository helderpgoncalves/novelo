import { useEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * Transição em meio-tom: pontos da cor da cena seguinte crescem até cobrir o ecrã (antes do corte)
 * e encolhem depois, revelando a cena nova. `at` é o fotograma do corte; dura 2 × `half`.
 */
export function DotWipe({ at, color, half = 9, step = 48, dir = [1, 0.4] }: { at: number; color: string; half?: number; step?: number; dir?: [number, number] }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const t = (frame - (at - half)) / (2 * half); // 0..1
  const active = t > 0 && t < 1;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (!active) return;
    ctx.fillStyle = color;
    const len = Math.hypot(dir[0], dir[1]);
    const ux = dir[0] / len;
    const uy = dir[1] / len;
    const span = Math.abs(ux) * width + Math.abs(uy) * height;
    const rMax = step * 0.75;
    for (let y = -step; y < height + step; y += step) {
      for (let x = -step + ((y / step) % 2 ? step / 2 : 0); x < width + step; x += step) {
        const pos = ((ux >= 0 ? x : width - x) * Math.abs(ux) + (uy >= 0 ? y : height - y) * Math.abs(uy)) / span; // 0..1
        // a frente de onda percorre o ecrã: cresce na 1.ª metade, encolhe na 2.ª
        const grow = Math.min(1, Math.max(0, (t * 2 - pos * 0.6) / 0.4));
        const shrink = Math.min(1, Math.max(0, ((t - 0.5) * 2 - pos * 0.6) / 0.4));
        const s = t < 0.5 ? grow : 1 - shrink;
        if (s <= 0.01) continue;
        ctx.beginPath();
        ctx.arc(x, y, rMax * Math.pow(s, 0.8), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [t, active, color, width, height, step, dir]);
  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }} />;
}
