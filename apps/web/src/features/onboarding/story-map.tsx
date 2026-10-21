import { type CSSProperties, useMemo } from 'react';
import raw from '@/features/landing/data/guimaraes-sites.json';
import { MAP } from '@/features/landing/facts';
import {
  byRing,
  parseSites,
  rankParishes,
  type Site,
  siteRadius,
  siteTone,
  TONE_OPACITY,
} from '@/features/landing/sites-map-model';
import { formatNumber, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

const NAMES = MAP.parishes.map((p) => p.name);

/** Os dados do mapa da landing (os mesmos locais, a mesma procura repartida), lidos uma vez. */
export function useSitesData() {
  return useMemo(() => {
    const sites = parseSites(raw);
    return {
      sites,
      rings: byRing(sites),
      ranked: rankParishes(raw, NAMES),
      parishes: MAP.parishes.length,
    };
  }, []);
}

function Dots({ sites }: { sites: readonly Site[] }) {
  return sites.map((s, i) => (
    <circle
      // biome-ignore lint/suspicious/noArrayIndexKey: lista estática gerada, nunca reordenada.
      key={i}
      cx={s.x}
      cy={s.y}
      r={siteRadius(s.t)}
      fillOpacity={TONE_OPACITY[siteTone(s.t)]}
    />
  ));
}

/**
 * Mini-mapa da apresentação: as freguesias desenham-se e os locais municipais acendem em dez ondas a partir do centro da
 * cidade (sem movimento: já acesos). As três freguesias com mais têxtil por desviar ficam realçadas. SVG puro.
 */
export function StoryMap({ highlight }: { highlight: readonly number[] }) {
  const { sites, rings, ranked } = useSitesData();
  const top = new Set(highlight);
  // Marcadores numerados no centro dos locais de cada freguesia em destaque (a ordem da lista ao lado).
  const markers = highlight.map((index, n) => {
    const own = sites.filter((s) => s.parish === index);
    const x = own.reduce((a, s) => a + s.x, 0) / Math.max(own.length, 1);
    const y = own.reduce((a, s) => a + s.y, 0) / Math.max(own.length, 1);
    return { index, n: n + 1, x, y };
  });
  const label = m.story_where_map_label({
    sites: formatNumber(sites.length),
    top: ranked
      .slice(0, 3)
      .map((p) => `${p.name} (${formatTonnes(p.t)})`)
      .join(', '),
  });
  return (
    <svg
      viewBox={`0 0 ${MAP.width} ${MAP.height}`}
      role="img"
      aria-label={label}
      className="ob-sites h-auto w-full"
    >
      <g strokeLinejoin="round">
        {MAP.parishes.map((p, i) => (
          <path
            key={p.id}
            d={p.d}
            className={top.has(i) ? 'fill-primary/12' : 'fill-card/70'}
            stroke="none"
          />
        ))}
      </g>
      <g fill="none" stroke="var(--foreground)" strokeOpacity="0.3" strokeLinejoin="round">
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
      <g fill="var(--primary)" stroke="var(--background)" strokeWidth="1.4">
        {rings.map((ring, r) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: os anéis são fixos (0-9).
          <g key={r} data-ring="" style={{ '--r': r } as CSSProperties}>
            <Dots sites={ring} />
          </g>
        ))}
      </g>
      <g fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round">
        {highlight.map((i) => (
          <path
            key={i}
            d={MAP.parishes[i]?.d}
            vectorEffect="non-scaling-stroke"
            data-ring=""
            style={{ '--r': 10 } as CSSProperties}
          />
        ))}
      </g>
      <g>
        {markers.map((mk) => (
          <g
            key={mk.index}
            data-ring=""
            style={{ '--r': 11 + mk.n } as CSSProperties}
            transform={`translate(${mk.x} ${mk.y})`}
          >
            <circle r="24" fill="var(--foreground)" stroke="var(--background)" strokeWidth="4" />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--background)"
              className="ob-mono"
              fontSize="24"
              fontWeight="500"
            >
              {mk.n}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
