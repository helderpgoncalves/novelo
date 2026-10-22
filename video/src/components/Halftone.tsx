import { useEffect, useMemo, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import fields from '../data/halftone.json';
import { C } from '../theme';

type Field = { cols: number; rows: number; step: number; tone: 'dark' | 'light'; data: string };
const FIELDS = fields as Record<string, Field>;

function hex(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function mix(a: [number, number, number], b: [number, number, number], t: number) {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

// Rampas da linguagem dither (scripts/brand/hero_derivatives.py): claro Areia → Floresta → Tinta; escuro Fio escuro → Areia.
type Stop = [number, [number, number, number]];
const RAMP_LIGHT: Stop[] = [[0, hex(C.areia)], [0.42, [0xb4, 0x93, 0x55]], [0.7, hex(C.floresta)], [1, hex(C.tinta)]];
const RAMP_DARK: Stop[] = [[0, [0x3e, 0x66, 0x58]], [0.28, [0x4f, 0x7a, 0x66]], [0.52, [0xa0, 0x8b, 0x5c]], [0.8, hex(C.areia)], [1, [0xe3, 0xc9, 0x8f]]];
function inkFor(ramp: Stop[], d: number) {
  for (let k = 1; k < ramp.length; k++) {
    const a = ramp[k - 1] as Stop;
    const b = ramp[k] as Stop;
    if (d <= b[0]) return mix(a[1], b[1], (d - a[0]) / (b[0] - a[0]));
  }
  const last = ramp[ramp.length - 1] as Stop;
  return mix(last[1], last[1], 0);
}

/**
 * Meio-tom da linguagem dither (pontos redondos numa grelha a 45º, tamanho = densidade), animado:
 * os pontos nascem numa onda a partir de `origin` (0..1) e a imagem aproxima-se devagar.
 */
export function Halftone({
  name,
  width,
  height,
  start = 0,
  revealFrames = 60,
  origin = [0.5, 0.5],
  zoomFrom = 1,
  zoomTo = 1.06,
  zoomFrames = 300,
  dim = 1,
  fade,
}: {
  name: string;
  width: number;
  height: number;
  start?: number;
  revealFrames?: number;
  origin?: [number, number];
  zoomFrom?: number;
  zoomTo?: number;
  zoomFrames?: number;
  dim?: number;
  /** Aclara a densidade de um lado (como o `fade_left` da landing) para o texto ter contraste, sem pôr nada por cima. */
  fade?: { side: 'left' | 'top'; from: number; to: number; floor?: number };
}) {
  const frame = useCurrentFrame() - start;
  const ref = useRef<HTMLCanvasElement>(null);
  const field = FIELDS[name];
  const values = useMemo(() => (field ? Uint8Array.from(atob(field.data), (c) => c.charCodeAt(0)) : null), [field]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !field || !values) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dark = field.tone === 'dark';
    ctx.fillStyle = dark ? C.noite : C.linho;
    ctx.fillRect(0, 0, width, height);
    const z = zoomFrom + (zoomTo - zoomFrom) * Math.min(1, Math.max(0, frame / zoomFrames));
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(z, z);
    ctx.translate(-width / 2, -height / 2);
    const { cols, rows, step } = field;
    const sx = width / (cols - 1);
    const sy = height / (rows - 1);
    const ox = origin[0] * width;
    const oy = origin[1] * height;
    const maxDist = Math.hypot(Math.max(ox, width - ox), Math.max(oy, height - oy));
    const ramp = dark ? RAMP_DARK : RAMP_LIGHT;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        // grelha a 45º: só os pontos com i + j par
        if ((i + j) % 2) continue;
        let d = (values[j * cols + i] ?? 0) / 255;
        if (fade) {
          const pos = fade.side === 'left' ? i / (cols - 1) : j / (rows - 1);
          const k = Math.min(1, Math.max(0, (pos - fade.from) / (fade.to - fade.from)));
          const s = k * k * (3 - 2 * k);
          d *= (fade.floor ?? 0.1) + (1 - (fade.floor ?? 0.1)) * s;
        }
        const x = i * sx;
        const y = j * sy;
        const dist = Math.hypot(x - ox, y - oy) / maxDist;
        const local = Math.min(1, Math.max(0, (frame - dist * revealFrames * 0.7) / (revealFrames * 0.3)));
        if (local <= 0) continue;
        const ease = 1 - Math.pow(1 - local, 3);
        const r = step * Math.sqrt((2 * d) / Math.PI) * ease * dim;
        if (r < 0.25) continue;
        ctx.fillStyle = inkFor(ramp, d);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }, [frame, field, values, width, height, origin, revealFrames, zoomFrom, zoomTo, zoomFrames, dim, fade]);

  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0 }} />;
}
