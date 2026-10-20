/**
 * Pista local de sessão: um cookie legível (`novelo_session=1`) sem segredos. NUNCA concede acesso (a sessão real são
 * os cookies httpOnly e a API continua a validar tudo); só evita a ida à API a quem nunca entrou, para que a landing
 * apareça de imediato. Sem pista -> landing; com pista -> verifica-se a sessão a sério.
 */
const NAME = 'novelo_session';
const MAX_AGE_S = 60 * 60 * 24 * 30;
/** Evento na `window` quando a pista passa a existir (entrou): o service worker só se regista a partir daí. */
export const SESSION_EVENT = 'novelo:session';

export function hasSessionHint(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((part) => part === `${NAME}=1`);
}

export function setSessionHint(): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  // biome-ignore lint/suspicious/noDocumentCookie: pista não sensível; a Cookie Store API ainda não é universal.
  document.cookie = `${NAME}=1; Path=/; Max-Age=${MAX_AGE_S}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function clearSessionHint(): void {
  if (typeof document === 'undefined') return;
  // biome-ignore lint/suspicious/noDocumentCookie: ver acima.
  document.cookie = `${NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
