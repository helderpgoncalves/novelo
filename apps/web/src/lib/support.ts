/** Contacto da equipa para pedidos de acesso e relatos de erro (o remetente configurado em EMAIL_FROM da API). */
export const SUPPORT_EMAIL = 'novelo@heldergoncalves.io';

export const mailtoLink = (subject: string, body: string): string =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

/** Referência curta para o utilizador citar quando não há id de pedido da API (erro só do browser). */
export const makeClientRef = (): string =>
  `web-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
