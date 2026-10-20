import { m } from '@/paraglide/messages';

/** Motivo (curto) pelo qual a pesquisa na web não pode ligar-se a este utilizador. */
export function webSearchUnavailableText(
  reason: 'disabled_by_system' | 'region' | 'guest' | null | undefined,
): string {
  switch (reason) {
    case 'disabled_by_system':
      return m.chat_set_web_unavailable_disabled_by_system();
    case 'region':
      return m.chat_set_web_unavailable_region();
    case 'guest':
      return m.chat_set_web_unavailable_guest();
    default:
      return m.chat_set_web_unavailable();
  }
}
