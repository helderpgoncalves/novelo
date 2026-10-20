import { m } from '@/paraglide/messages';
import { HACKATHON_COVER } from './hackathon-cover.generated';

const BASE = '/landing';

const set = (items: readonly { src: string; w: number }[]) =>
  items.map((i) => `${BASE}/${i.src} ${i.w}w`).join(', ');

/**
 * Capa oficial do Hack4Guimarães 2035: derivados AVIF e WebP com hash do conteúdo (`just brand-hackathon`), dimensões
 * explícitas (CLS 0), carregamento preguiçoso. Origem e termos de uso em `public/landing/CREDITS.md`.
 */
export function HackathonCover({ sizes, className }: { sizes: string; className?: string }) {
  const fallback = HACKATHON_COVER.webp[1];
  return (
    <picture>
      <source type="image/avif" srcSet={set(HACKATHON_COVER.avif)} sizes={sizes} />
      <source type="image/webp" srcSet={set(HACKATHON_COVER.webp)} sizes={sizes} />
      <img
        src={`${BASE}/${fallback.src}`}
        alt={m.footer_hack_alt()}
        width={HACKATHON_COVER.width}
        height={HACKATHON_COVER.height}
        loading="lazy"
        decoding="async"
        className={className}
      />
    </picture>
  );
}
