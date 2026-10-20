import { type ClassScale, classOf } from './choropleth';

/**
 * Cores do coropleto (escala sequencial de seis classes, verde claro → verde escuro da marca) e do desenho do mapa,
 * em variáveis CSS para claro e escuro. Medidas a partir dos tokens da marca (Linho, Tinta, Floresta):
 * claro: classes 0-3 com texto Tinta (≥ 6:1) e 4-5 com texto Linho (≥ 4,5:1);
 * escuro: classes 0-2 com texto claro (≥ 5,9:1) e 3-5 com texto escuro (≥ 5,6:1).
 */
export const RAMP_SIZE = 6;

export const MAP_CSS = `
.nv-map{
  --nv-0:#dbe9e0;--nv-1:#c0d9cb;--nv-2:#9bc4af;--nv-3:#72a88f;--nv-4:#39795f;--nv-5:#1f5342;
  --nv-t0:#14211d;--nv-t1:#14211d;--nv-t2:#14211d;--nv-t3:#14211d;--nv-t4:#f4f1ea;--nv-t5:#f4f1ea;
  --nv-neutral:#ece7dc;--nv-tn:#14211d;
  --nv-nodata:#e7e2d6;--nv-stripe:#7d8984;
  --nv-ink:#14211d;--nv-card:#faf8f3;
  --nv-line:rgb(20 33 29 / .6);--nv-casing:rgb(250 248 243 / .9);
  --nv-dot:#5e6b66;--nv-dot-edge:#faf8f3;--nv-cover:#b07a1f;
}
.dark .nv-map{
  --nv-0:#1f3029;--nv-1:#2a463c;--nv-2:#376354;--nv-3:#5f9c85;--nv-4:#8ec2ab;--nv-5:#c2e1d2;
  --nv-t0:#f1eee6;--nv-t1:#f1eee6;--nv-t2:#f1eee6;--nv-t3:#0f1815;--nv-t4:#0f1815;--nv-t5:#0f1815;
  --nv-neutral:#1a2823;--nv-tn:#f1eee6;
  --nv-nodata:#1a2823;--nv-stripe:#8d9f98;
  --nv-ink:#f1eee6;--nv-card:#14211d;
  --nv-line:rgb(241 238 230 / .5);--nv-casing:rgb(20 33 29 / .9);
  --nv-dot:#9fb0a9;--nv-dot-edge:#14211d;--nv-cover:#e3b566;
}
.nv-map svg *{outline:none}
.nv-underlay{fill:none;stroke:var(--nv-ink);stroke-width:6px;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.nv-casing{fill:none;stroke:var(--nv-casing);stroke-width:1.8px;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.nv-line{fill:none;stroke:var(--nv-line);stroke-width:.85px;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.nv-sel-fill{filter:drop-shadow(0 3px 5px rgb(20 33 29 / .45))}
.nv-sel-casing{fill:none;stroke:var(--nv-card);stroke-width:6px;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.nv-sel-line{fill:none;stroke:var(--nv-ink);stroke-width:3px;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.nv-cov-casing{fill:none;stroke:var(--nv-card);stroke-width:5px;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.nv-cov-line{fill:none;stroke:var(--nv-cover);stroke-width:2.5px;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.nv-covered-key{border:3px solid var(--nv-cover);background:var(--nv-card)}
.nv-hover{fill:none;stroke:var(--nv-ink);stroke-width:2.25px;stroke-linejoin:round;vector-effect:non-scaling-stroke;pointer-events:none}
.nv-active{fill:none;stroke:var(--nv-ink);stroke-width:2.5px;stroke-dasharray:6 4;stroke-linejoin:round;vector-effect:non-scaling-stroke;pointer-events:none}
.nv-label{font-weight:600;paint-order:stroke;stroke-linejoin:round;text-anchor:middle;pointer-events:none;letter-spacing:.005em}
.nv-dot{fill:var(--nv-dot);fill-opacity:.85;stroke:var(--nv-dot-edge);pointer-events:none}
.nv-swatch{display:inline-block;width:1.125rem;height:1.125rem;border-radius:.25rem;box-shadow:inset 0 0 0 1px rgb(20 33 29 / .35);flex:none}
.dark .nv-swatch{box-shadow:inset 0 0 0 1px rgb(241 238 230 / .35)}
.nv-hatch{background:repeating-linear-gradient(45deg,var(--nv-stripe) 0 1.5px,var(--nv-nodata) 1.5px 5px)}
.nv-sel-fill,.nv-hover,.nv-active{transition:none}
@media (prefers-reduced-motion:no-preference){.nv-label{transition:opacity .12s}}
`;

/** Posição da classe `c` (de `n`) na rampa de seis cores: usa a rampa toda, mesmo com poucas classes. */
export function rampIndex(c: number, n: number): number {
  if (n <= 1) return 3;
  return Math.round((c * (RAMP_SIZE - 1)) / (n - 1));
}

export interface Paint {
  fill: string;
  /** Cor do texto da etiqueta e do seu halo (a cor do fundo), para a leitura nunca depender do que está por baixo. */
  text: string;
  halo: string;
}

/**
 * Cor de uma freguesia: classe da escala (`scale`), cinzento neutro com círculos por cima (`circles`) ou
 * às riscas quando falta o dado (`binary` só risca quem tem a lacuna). `hatch` é o `url(#…)` do padrão.
 */
export function paintFor(
  kind: 'scale' | 'circles' | 'binary',
  value: number | undefined,
  scale: ClassScale,
  hatch: string,
): Paint {
  const nodata: Paint = { fill: hatch, text: 'var(--nv-tn)', halo: 'var(--nv-nodata)' };
  if (value === undefined || !Number.isFinite(value)) return nodata;
  if (kind === 'circles') {
    return { fill: 'var(--nv-neutral)', text: 'var(--nv-tn)', halo: 'var(--nv-neutral)' };
  }
  if (kind === 'binary') {
    return value > 0 ? nodata : { fill: 'var(--nv-1)', text: 'var(--nv-t1)', halo: 'var(--nv-1)' };
  }
  const c = classOf(value, scale);
  if (c < 0) return nodata;
  const i = rampIndex(c, scale.count);
  return { fill: `var(--nv-${i})`, text: `var(--nv-t${i})`, halo: `var(--nv-${i})` };
}
