import { useId, useRef } from 'react';
import { useInViewOnce } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { MAP } from './facts';

/** Raio dos pontos de meio-tom por quintil de densidade (grelha de 14 unidades): mais gente por hectare, ponto maior. */
const DOT_R = [0.9, 2.1, 3.3, 4.5, 5.7] as const;

/**
 * Mapa das 48 freguesias de Guimarães (CAOP 2019) em SVG: geometria oficial simplificada e densidade populacional
 * (INE ÷ área CAOP, em quintis) desenhada em meio-tom, a linguagem dither da marca. Contorno que se desenha ao
 * entrar e, opcionalmente, as 71 localidades com coordenadas. Sem bibliotecas de mapas.
 */
export function ParishMap({
  places = false,
  label,
  className,
}: {
  places?: boolean;
  label: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const ref = useRef<SVGSVGElement>(null);
  const seen = useInViewOnce(ref);
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${MAP.width} ${MAP.height}`}
      role="img"
      aria-label={label}
      data-in={seen}
      className={cn('lp-draw h-auto w-full', className)}
    >
      <defs>
        {DOT_R.map((r, i) => (
          <pattern key={r} id={`${uid}-d${i}`} width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="var(--dither-ground)" />
            <circle cx="3.5" cy="3.5" r={r} fill="var(--primary)" />
            <circle cx="10.5" cy="10.5" r={r} fill="var(--primary)" />
          </pattern>
        ))}
      </defs>
      <g data-fade="">
        {MAP.parishes.map((p) => (
          <path key={p.id} d={p.d} fill={`url(#${uid}-d${p.b})`} />
        ))}
      </g>
      <g fill="none" stroke="var(--foreground)" strokeOpacity="0.55" strokeLinejoin="round">
        {MAP.parishes.map((p) => (
          <path
            key={p.id}
            d={p.d}
            data-draw=""
            pathLength={1}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      {places && (
        <g data-fade="" fill="var(--dither-gold)" stroke="var(--background)" strokeWidth="1.5">
          {MAP.places.map(([x, y], i) => (
            // Há localidades com as mesmas coordenadas arredondadas: a chave é a posição na lista (estática).
            // biome-ignore lint/suspicious/noArrayIndexKey: lista estática gerada, nunca reordenada.
            <circle key={i} cx={x} cy={y} r="6" />
          ))}
        </g>
      )}
    </svg>
  );
}
