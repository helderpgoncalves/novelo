/** Lógica pura da faixa de impersonação. */

/** Segundos que faltam até `expiresAt` (ISO), nunca negativos; `null` se a data não existe ou é inválida. */
export function secondsUntil(expiresAt: string | null | undefined, now: number): number | null {
  if (!expiresAt) return null;
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - now) / 1000));
}

/** mm:ss (ou h:mm:ss se passar da hora), com zeros à esquerda. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(hours > 0 ? minutes : Math.floor(s / 60)).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Quando avisar leitores de ecrã: só nos marcos (5 min, 1 min, 30 s), nunca a cada segundo.
 * Devolve o marco em que estamos, ou `null` se ainda falta muito.
 */
export function announceMark(remaining: number | null): 300 | 60 | 30 | null {
  if (remaining === null) return null;
  if (remaining <= 30) return 30;
  if (remaining <= 60) return 60;
  if (remaining <= 300) return 300;
  return null;
}
