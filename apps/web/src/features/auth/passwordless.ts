/** Lógica pura da entrada sem password (link por email e QR): sem React, testável à parte. */

/** Validade do link, em minutos (o mesmo valor que a API usa em `MAGIC_LINK_MINUTES`). */
export const MAGIC_LINK_MINUTES = 15;
/** Espera antes de deixar pedir outro link. */
export const RESEND_SECONDS = 30;

const LAST_EMAIL_KEY = 'novelo.lastEmail';

/**
 * Só caminhos da própria app: começa por `/`, sem `//` nem `\` (que o browser trata como outro sítio),
 * sem esquemas nem caracteres de controlo. Qualquer outra coisa volta a `/`.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || next.length > 500) return '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  // biome-ignore lint/suspicious/noControlCharactersInRegex: é precisamente o que se quer recusar
  if (/[\u0000-\u001f\u007f]/.test(next)) return '/';
  return next;
}

/** Segundos que faltam para poder reenviar (nunca negativo, arredondado para cima). */
export function secondsLeft(sentAt: number, now: number, cooldown = RESEND_SECONDS): number {
  return Math.max(0, Math.ceil(cooldown - (now - sentAt) / 1000));
}

export interface MailProvider {
  name: string;
  url: string;
}

/** App de email a sugerir, só quando o domínio a identifica sem margem para dúvidas. */
export function mailProvider(email: string): MailProvider | null {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { name: 'Gmail', url: 'https://mail.google.com/mail/u/0/#inbox' };
  }
  if (/^(outlook|hotmail|live|msn)\.[a-z.]+$/.test(domain)) {
    return { name: 'Outlook', url: 'https://outlook.live.com/mail/0/inbox' };
  }
  if (/^(yahoo|ymail)\.[a-z.]+$/.test(domain)) {
    return { name: 'Yahoo Mail', url: 'https://mail.yahoo.com/' };
  }
  if (domain === 'icloud.com' || domain === 'me.com') {
    return { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' };
  }
  if (domain === 'proton.me' || domain === 'protonmail.com') {
    return { name: 'Proton Mail', url: 'https://mail.proton.me/u/0/inbox' };
  }
  return null;
}

/** Email com ar de email: a validação a sério é a da API. */
export const looksLikeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

/** Pelo menos duas letras; o nome é só para cumprimentar. */
export const looksLikeName = (value: string): boolean => value.trim().length >= 2;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // modo privado ou armazenamento bloqueado
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // sem armazenamento: perde-se só a comodidade
  }
}

export const readLastEmail = (): string => {
  const value = read(LAST_EMAIL_KEY) ?? '';
  return looksLikeEmail(value) ? value : '';
};

export const storeLastEmail = (email: string): void => {
  if (looksLikeEmail(email)) write(LAST_EMAIL_KEY, email.trim());
};

export const storage = { read, write };
