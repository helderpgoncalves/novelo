/**
 * Lógica pura do "puxar para atualizar": resistência elástica, limiar e leitura do gesto.
 * Sem DOM nem React, para ser testada à mão (ver `pull-to-refresh-math.test.ts`).
 */

/** Distância (já com resistência) a partir da qual o gesto fica "armado". */
export const PULL_THRESHOLD = 72;
/** Assíntota da resistência: por mais que se arraste, o indicador nunca passa daqui. */
export const PULL_MAX = 160;
/** Onde o indicador fica a rodar enquanto os dados atualizam. */
export const PULL_HOLD = 64;
/** Movimento mínimo (px) antes de decidir se o gesto é um "puxar" ou uma rolagem normal. */
export const PULL_SLOP = 8;
/** O eixo vertical tem de dominar o horizontal por esta razão para contar como "puxar". */
export const AXIS_RATIO = 1.3;

/** Graus de rotação por px puxado: interior mais rápido, exterior mais lento e em sentido contrário ao médio. */
export const ARC_DEG_PER_PX = { inner: 5, mid: -3.4, outer: 2 } as const;

/**
 * Elástico tipo iOS: no início acompanha o dedo 1:1 e vai ficando mais duro até `PULL_MAX`.
 * `raw` é o deslocamento do dedo desde o início do gesto (px); devolve a posição do indicador.
 */
export function resist(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return PULL_MAX * (1 - 1 / (raw / PULL_MAX + 1));
}

/** Distância do dedo necessária para atingir uma dada posição resistida (inversa de `resist`). */
export function rawForPull(pull: number): number {
  if (pull <= 0) return 0;
  const p = Math.min(pull, PULL_MAX * 0.999);
  return PULL_MAX * (1 / (1 - p / PULL_MAX) - 1);
}

export const isArmed = (pull: number): boolean => pull >= PULL_THRESHOLD;

/** 0..1 até ao limiar. */
export const progressOf = (pull: number): number => Math.min(1, Math.max(0, pull / PULL_THRESHOLD));

/** O símbolo cresce e ganha opacidade de 0,4 a 1 até ao limiar. */
export function appearance(pull: number): { scale: number; opacity: number } {
  const v = 0.4 + 0.6 * progressOf(pull);
  return { scale: v, opacity: v };
}

export type GestureKind = 'pending' | 'pull' | 'ignore';

/**
 * Decide o que o gesto é, assim que há movimento suficiente: só conta como "puxar" se for para baixo e
 * o eixo vertical dominar. Para cima ou na horizontal é uma rolagem/arrasto normal e deixa-se em paz.
 */
export function classifyGesture(dx: number, dy: number): GestureKind {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < PULL_SLOP) return 'pending';
  if (dy > 0 && dy > Math.abs(dx) * AXIS_RATIO) return 'pull';
  return 'ignore';
}

/** Deslocamento que conta para o elástico: descontado o `PULL_SLOP` já gasto a decidir o gesto. */
export const rawFromDelta = (dy: number): number => Math.max(0, dy - PULL_SLOP);

/** Mantém o tempo de espera visível entre `min` e `max` ms (evita piscar e esperas sem fim). */
export function clampWait(elapsedMs: number, min: number, max: number): number {
  return Math.min(Math.max(elapsedMs, min), max);
}

/** Ângulo (graus, -180..180] a partir de uma matriz CSS `matrix(a, b, ...)`; 0 se não houver rotação. */
export function angleFromMatrix(transform: string): number {
  const match = /^matrix\(([^)]+)\)$/.exec(transform.trim());
  if (!match?.[1]) return 0;
  const [a, b] = match[1].split(',').map((n) => Number.parseFloat(n));
  if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return (Math.atan2(b, a) * 180) / Math.PI;
}

/** Quanto falta rodar, no sentido `dir` (1 horário, -1 anti-horário), para o arco ficar alinhado (0°). */
export function degreesToAlign(angle: number, dir: 1 | -1): number {
  const mod = (((dir === 1 ? -angle : angle) % 360) + 360) % 360;
  return dir * mod;
}
