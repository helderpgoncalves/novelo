import { getLocale } from '@/lib/i18n';

/** Origem pública do site: todos os URLs de partilha e canonical são absolutos. */
export const SITE_URL = 'https://novelo.helder.si';

/** Imagem de partilha (Open Graph, 1200 × 630) de uma página no idioma atual: `public/og/novelo-partilha-*`. */
export const ogImage = (kind: 'landing' | 'entrar' | 'passaporte' | 'relatorio'): string =>
  `${SITE_URL}/og/novelo-partilha-${kind}-${getLocale() === 'en' ? 'en' : 'pt'}.png`;
