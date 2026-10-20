import { dataSaver } from '@/lib/motion';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * Linguagem dither/meio-tom da marca (docs/marca/linguagem-dither.md). Os ativos AVIF estão em `public/landing/`
 * (gerados por `just brand-landing`); aqui vivem os componentes que os desenham, com o tema (`.dark`) a escolher
 * a versão clara ou escura, dimensões explícitas (CLS 0) e a menor largura com `Save-Data`.
 */

const BASE = '/landing';

const set = (name: string, widths: readonly number[], saver: boolean) =>
  (saver ? widths.slice(0, 1) : widths).map((w) => `${BASE}/${name}-${w}.avif ${w}w`).join(', ');

/**
 * Fotografia do hero (Penha ao pôr do sol em pontos dourados e verdes), com direção de arte: 4:5 abaixo de 768 px,
 * 4:3 até 1023 px e 16:9 acima. AVIF; o fallback WebP só existe nas larguras pequenas (640 px), que é o que um
 * navegador sem AVIF recebe. `fetchpriority="high"` e sem `loading="lazy"`: é candidato a LCP. Decorativa (`alt=""`).
 */
export function HeroPicture({ className }: { className?: string }) {
  const tone = useTheme().resolvedTheme;
  const saver = dataSaver();
  return (
    <picture>
      <source
        media="(max-width: 767px)"
        type="image/avif"
        srcSet={set(`hero-mobile-${tone}`, [432, 864, 1296], saver)}
        sizes="100vw"
      />
      <source
        media="(max-width: 1023px)"
        type="image/avif"
        srcSet={set(`hero-4x3-${tone}`, [768, 1536], saver)}
        sizes="100vw"
      />
      <source
        type="image/avif"
        srcSet={set(`hero-16x9-${tone}`, [640, 1280, 1920], saver)}
        sizes="100vw"
      />
      <img
        src={`${BASE}/hero-16x9-${tone}-640.webp`}
        alt=""
        width={1280}
        height={720}
        fetchPriority="high"
        decoding="async"
        className={cn('size-full object-cover', className)}
      />
    </picture>
  );
}

/** Painel do ecrã de entrada (3:4, 960/1440 px). Lazy: é decorativo e não pode competir com o formulário. */
export function PanelPicture({ className }: { className?: string }) {
  const tone = useTheme().resolvedTheme;
  const saver = dataSaver();
  return (
    <picture>
      <source
        type="image/avif"
        srcSet={set(`login-painel-${tone}`, [960, 1440], saver)}
        sizes="(min-width: 1024px) 54vw, 100vw"
      />
      <img
        src={`${BASE}/login-painel-${tone}-960.avif`}
        alt=""
        width={960}
        height={1280}
        loading="lazy"
        decoding="async"
        className={cn('size-full object-cover object-[58%_60%]', className)}
      />
    </picture>
  );
}

/** Faixa fina do ecrã de entrada em telemóvel (10:3, 1200/2400 px). */
export function StripPicture({ className }: { className?: string }) {
  const tone = useTheme().resolvedTheme;
  const saver = dataSaver();
  return (
    <picture>
      <source
        type="image/avif"
        srcSet={set(`login-faixa-${tone}`, [1200, 2400], saver)}
        sizes="100vw"
      />
      <img
        src={`${BASE}/login-faixa-${tone}-1200.avif`}
        alt=""
        width={1200}
        height={360}
        decoding="async"
        fetchPriority="low"
        className={cn('size-full object-cover object-right', className)}
      />
    </picture>
  );
}

/** Faixa de densidade entre secções (textura «dunas»): decorativa, sem texto por cima. `flip` inverte o sentido. */
export function DitherBand({ flip = false, className }: { flip?: boolean; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('tx tx-dunas h-16 w-full lg:h-24', flip && '-scale-y-100', className)}
    />
  );
}
