import { type CSSProperties, type ReactNode, useMemo, useRef, useState } from 'react';
import { formatNumber, formatTonnes } from '@/lib/format';
import { useInViewOnce } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import raw from './data/guimaraes-sites.json';
import { FACTS, MAP } from './facts';
import { CARD, Estimate, FigCaption, MONO } from './layout';
import {
  byRing,
  LEGEND_T,
  parseSites,
  rankParishes,
  type Site,
  siteRadius,
  siteTone,
  TONE_OPACITY,
} from './sites-map-model';

const NAMES = MAP.parishes.map((p) => p.name);
const TOP = 8;

const sitesLabel = (n: number) =>
  n === 1 ? m.landing_map_sites_one() : m.landing_map_sites_other({ count: formatNumber(n) });

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
 * «Onde se perdem as 2 325 t»: as 48 freguesias (CAOP 2019) e os 1 574 locais públicos com contentores municipais, cada um do
 * tamanho do têxtil estimado que lá se perde (a procura da freguesia repartida pelos contentores, como no modelo). Os pontos
 * entram em ondas a partir do centro da cidade (só com movimento permitido). Ao lado, as freguesias por têxtil por desviar:
 * escolher uma realça-a no mapa; a lista completa é o equivalente acessível do mapa. SVG puro, sem bibliotecas de mapas;
 * carregado à parte (`lazy`) para não pesar no primeiro ecrã.
 */
export function SitesMap({ aside }: { aside?: ReactNode }) {
  const sites = useMemo(() => parseSites(raw), []);
  const rings = useMemo(() => byRing(sites), [sites]);
  const ranked = useMemo(() => rankParishes(raw, NAMES), []);
  const totals = useMemo(() => new Map(ranked.map((p) => [p.index, p])), [ranked]);
  const [pinned, setPinned] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? pinned;
  const focus = shown === null ? undefined : totals.get(shown);
  const focusSites = useMemo(
    () => (shown === null ? [] : sites.filter((s) => s.parish === shown)),
    [shown, sites],
  );
  const ref = useRef<SVGSVGElement>(null);
  const seen = useInViewOnce(ref);
  const max = ranked[0]?.t ?? 1;
  const toggle = (i: number) => setPinned((p) => (p === i ? null : i));
  const label = m.landing_map_label({
    count: formatNumber(sites.length),
    top: ranked
      .slice(0, 3)
      .map((p) => p.name)
      .join(', '),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
      <figure
        className={cn(
          CARD,
          'flex flex-col overflow-hidden lg:col-span-7',
          'max-sm:-mx-4 max-sm:rounded-[1.75rem] max-sm:border-x-0',
        )}
      >
        <div className="flex min-h-[4.75rem] items-center justify-between gap-4 border-border border-b px-5 py-3.5 sm:px-7">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="lp-kicker truncate">{focus?.name ?? m.landing_map_readout_all()}</p>
            <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <span className="font-medium font-serif text-2xl tabular-nums leading-none sm:text-[1.75rem]">
                {formatTonnes(focus?.t ?? FACTS.residualT)}
              </span>
              <span className={MONO}>
                {m.landing_map_per_year()} · {sitesLabel(focus?.sites ?? sites.length)}
              </span>
            </p>
          </div>
          {pinned !== null ? (
            <button
              type="button"
              onClick={() => setPinned(null)}
              className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-border px-3.5 font-medium text-[13px] outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
            >
              {m.landing_map_clear()}
            </button>
          ) : (
            <Estimate className="ml-0 shrink-0 text-muted-foreground" />
          )}
        </div>
        <div className="relative px-3 py-4 sm:px-6 sm:py-6">
          <svg
            ref={ref}
            viewBox={`0 0 ${MAP.width} ${MAP.height}`}
            role="img"
            aria-label={label}
            data-in={seen}
            className="lp-draw lp-sites mx-auto h-auto w-full max-w-[40rem]"
            onPointerLeave={() => setHover(null)}
          >
            <g strokeLinejoin="round">
              {MAP.parishes.map((p, i) => (
                // biome-ignore lint/a11y/noStaticElementInteractions: atalho de rato e toque; o equivalente por teclado é a lista de freguesias ao lado.
                <path
                  key={p.id}
                  d={p.d}
                  className={cn(
                    'cursor-pointer transition-[fill] duration-300',
                    shown === i ? 'fill-primary/12' : 'fill-background/70 hover:fill-primary/6',
                  )}
                  stroke="none"
                  onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(i)}
                  onClick={() => toggle(i)}
                />
              ))}
            </g>
            <g
              fill="none"
              stroke="var(--foreground)"
              strokeOpacity="0.32"
              strokeLinejoin="round"
              pointerEvents="none"
            >
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
            <g
              fill="var(--primary)"
              stroke="var(--card)"
              strokeWidth="1.4"
              pointerEvents="none"
              className="transition-opacity duration-300"
              opacity={shown === null ? 1 : 0.2}
            >
              {rings.map((ring, r) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: os anéis são fixos (0-9).
                <g key={r} data-ring="" style={{ '--r': r } as CSSProperties}>
                  <Dots sites={ring} />
                </g>
              ))}
            </g>
            {shown !== null && (
              <g pointerEvents="none">
                <path
                  d={MAP.parishes[shown]?.d}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
                <g fill="var(--primary)" stroke="var(--card)" strokeWidth="1.4">
                  <Dots sites={focusSites} />
                </g>
              </g>
            )}
          </svg>
        </div>
        <div className="mt-auto flex flex-col gap-4 border-border border-t px-5 py-4 sm:px-7">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className={cn(MONO, 'w-full text-foreground sm:w-auto')}>
              {m.landing_map_legend_title()}
            </p>
            <ul className="flex items-center gap-5" aria-hidden="true">
              {LEGEND_T.map((t) => {
                const r = siteRadius(t) * 0.62;
                return (
                  <li key={t} className="flex items-center gap-2">
                    <svg
                      width={Math.ceil(r * 2) + 2}
                      height={Math.ceil(r * 2) + 2}
                      className="shrink-0"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <circle
                        cx={r + 1}
                        cy={r + 1}
                        r={r}
                        fill="var(--primary)"
                        fillOpacity={TONE_OPACITY[siteTone(t)]}
                      />
                    </svg>
                    <span className={cn(MONO, 'tabular-nums')}>
                      {formatTonnes(t, t < 1 ? 1 : 0)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className={cn(MONO, 'flex items-center gap-2')}>
              <span
                aria-hidden="true"
                className="inline-block h-3 w-4 rounded-[3px] border border-foreground/35"
              />
              {m.landing_map_legend_outline()}
            </p>
          </div>
          <FigCaption label={m.landing_map_fig()} className="max-w-none">
            {m.landing_map_caption({ kg: formatNumber(FACTS.residualKgPerInhabMonth, 3) })}
          </FigCaption>
        </div>
      </figure>

      <div className="flex flex-col gap-5 lg:col-span-5">
        <div className={cn(CARD, 'flex flex-col p-5 sm:p-7')}>
          <h3 className="lp-kicker">{m.landing_map_rank_title()}</h3>
          <p className={cn(MONO, 'mt-1.5')}>{m.landing_map_rank_hint()}</p>
          <ol className="mt-4 flex flex-col">
            {ranked.slice(0, TOP).map((p, i) => (
              <li key={p.index}>
                <button
                  type="button"
                  aria-pressed={pinned === p.index}
                  onClick={() => toggle(p.index)}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(p.index)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(p.index)}
                  onBlur={() => setHover(null)}
                  className={cn(
                    'group grid min-h-12 w-full grid-cols-[1.75rem_1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2 text-left outline-none transition-colors',
                    'hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring',
                    pinned === p.index && 'bg-primary/10',
                  )}
                >
                  <span className={cn(MONO, 'tabular-nums')}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-medium text-[0.9375rem] leading-snug">{p.name}</span>
                  <span className="font-mono text-[13px] tabular-nums">{formatTonnes(p.t)}</span>
                  <span
                    aria-hidden="true"
                    className="col-start-2 col-end-4 h-1.5 rounded-full bg-border/70"
                  >
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${(p.t / max) * 100}%` }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <details className="group mt-3 border-border border-t pt-3">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-2 font-medium text-primary text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              {m.landing_map_rank_all({ count: formatNumber(ranked.length) })}
              <span
                aria-hidden="true"
                className="transition-transform duration-300 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <ol className="mt-2 grid gap-x-6 px-2 text-[13px] sm:grid-cols-2">
              {ranked.map((p, i) => (
                <li
                  key={p.index}
                  className="flex items-baseline justify-between gap-3 border-border/60 border-b py-1.5"
                >
                  <span className="min-w-0 text-muted-foreground">
                    <span className="mr-2 font-mono tabular-nums">{i + 1}.</span>
                    {p.name}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums">{formatTonnes(p.t)}</span>
                </li>
              ))}
            </ol>
          </details>
        </div>
        {aside}
      </div>
    </div>
  );
}
