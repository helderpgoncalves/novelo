import { useEffect, useRef } from 'react';
import {
  HERO_INTRINSIC,
  HERO_TALL,
  HERO_TALL_SIZES,
  HERO_WIDE,
  HERO_WIDE_MEDIA,
  HERO_WIDE_SIZES,
  type HeroSource,
} from '@/features/landing/landing-assets.generated';
import { dataSaver } from '@/lib/motion';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * Fotografias de Guimarães em meio-tom Novelo, em derivados AVIF + WebP gerados por `just brand-landing` (nomes com hash do
 * conteúdo: cache imutável; créditos na página «Créditos e licenças» (`features/landing/photo-credits.ts`) e em `public/landing/CREDITS.md`). Aqui vivem os
 * componentes que as mostram: tema claro/escuro, dimensões explícitas (CLS 0) e a menor largura com `Save-Data`.
 */

const BASE = '/landing';

const srcSet = (items: readonly HeroSource[], saver: boolean) =>
  (saver ? items.slice(0, 1) : items).map((i) => `${BASE}/${i.src} ${i.w}w`).join(', ');

/** Aparece com um fade curto e um zoom quase impercetível, só quando a imagem chega depois do primeiro desenho. */
function useFadeIn() {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (!img || img.complete) return;
    img.dataset.fade = 'wait';
    const show = () => {
      img.dataset.fade = 'in';
    };
    img.addEventListener('load', show, { once: true });
    img.addEventListener('error', show, { once: true });
    return () => {
      img.removeEventListener('load', show);
      img.removeEventListener('error', show);
    };
  }, []);
  return ref;
}

/**
 * Fotografia do hero (a Penha ao fim do dia). Direção de arte: `wide` (16:10, texto à esquerda sobre o céu) em ecrã largo e
 * `tall` (4:5, centrada no pico) em ecrã estreito ou de pé. É candidato a LCP: `fetchpriority="high"`, sem `loading="lazy"`,
 * `decoding="async"`; o fundo sólido da secção (cor do céu) cobre a espera. Decorativa (`alt=""`).
 */
export function HeroPicture({ className }: { className?: string }) {
  const tone = useTheme().resolvedTheme;
  const saver = dataSaver();
  const ref = useFadeIn();
  const wide = HERO_WIDE[tone];
  const tall = HERO_TALL[tone];
  const [tw, th] = HERO_INTRINSIC.tall;
  return (
    <picture>
      <source
        media={HERO_WIDE_MEDIA}
        type="image/avif"
        srcSet={srcSet(wide.avif, saver)}
        sizes={HERO_WIDE_SIZES}
      />
      <source
        media={HERO_WIDE_MEDIA}
        type="image/webp"
        srcSet={srcSet(wide.webp, saver)}
        sizes={HERO_WIDE_SIZES}
      />
      <source type="image/avif" srcSet={srcSet(tall.avif, saver)} sizes={HERO_TALL_SIZES} />
      <source type="image/webp" srcSet={srcSet(tall.webp, saver)} sizes={HERO_TALL_SIZES} />
      <img
        ref={ref}
        src={`${BASE}/${tall.webp[1]?.src ?? tall.webp[0]?.src}`}
        alt=""
        width={tw}
        height={th}
        fetchPriority="high"
        decoding="auto"
        className={cn('lp-photo size-full object-cover', className)}
      />
    </picture>
  );
}

/**
 * Faixa de transição entre secções: uma fatia do Paço dos Duques com degradé nas quatro arestas, a dissolver-se no papel.
 * Decorativa; sem texto por cima.
 */
export function PhotoBand({ flip = false, className }: { flip?: boolean; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'photo-bg photo-paco photo-band h-20 w-full lg:h-28',
        flip && '-scale-y-100',
        className,
      )}
    />
  );
}
