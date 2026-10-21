import type { CSSProperties, ReactNode } from 'react';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { CountUp } from './count-up';
import { FACTS } from './facts';
import {
  BODY,
  CARD,
  Cite,
  CONTAINER,
  Estimate,
  FigCaption,
  Heading,
  MONO,
  Section,
  STAT,
} from './layout';
import { sectionNumber } from './sections';

const stagger = (i: number) => ({ '--i': i }) as CSSProperties;

const DESTINATIONS = [
  { id: 'reuse', t: 178.995, share: FACTS.reuse, tone: 'bg-primary' },
  { id: 'recycling', t: 79.933, share: FACTS.recycling, tone: 'bg-chart-2' },
  { id: 'reject', t: 42.338, share: FACTS.reject, tone: 'bg-areia' },
] as const;

/** Etiqueta mono de cartão (kicker). */
function Kicker({ children }: { children: ReactNode }) {
  return <p className="lp-kicker">{children}</p>;
}

/**
 * O problema, em bento assimétrico: um cartão grande com o número que importa (11,5 % do têxtil gerado, estimativa) e a
 * diretiva europeia, e três pequenos com factos e fontes (remissões [n] para as Referências).
 */
export function Problem() {
  const labels = {
    reuse: m.landing_dest_reuse(),
    recycling: m.landing_dest_recycling(),
    reject: m.landing_dest_reject(),
  };
  const network = [
    { id: 'circuits', value: FACTS.circuits, label: m.landing_net_circuits() },
    { id: 'vehicles', value: FACTS.vehicles, label: m.landing_net_vehicles() },
    { id: 'places', value: FACTS.places, label: m.landing_net_places() },
  ] as const;
  const ledger: {
    id: string;
    op: string;
    label: string;
    value: string;
    count?: number;
    total?: boolean;
    estimate?: boolean;
  }[] = [
    { id: 'rsu', op: '', label: m.landing_ledger_rsu(), value: formatTonnes(FACTS.rsuT, 0) },
    {
      id: 'share',
      op: '×',
      label: m.landing_ledger_share(),
      value: formatPercent(FACTS.textileShareOfRsuPct),
    },
    {
      id: 'residual',
      op: '=',
      label: m.landing_ledger_residual(),
      value: formatTonnes(FACTS.residualT),
      count: FACTS.residualT,
      total: true,
      estimate: true,
    },
    {
      id: 'collected',
      op: '+',
      label: m.landing_ledger_collected({ count: formatNumber(FACTS.entities) }),
      value: formatTonnes(FACTS.collectedT),
    },
    {
      id: 'potential',
      op: '=',
      label: m.landing_ledger_potential(),
      value: formatTonnes(FACTS.potentialT),
      count: FACTS.potentialT,
      total: true,
      estimate: true,
    },
  ];
  return (
    <Section id="problema">
      <div className={`${CONTAINER} flex flex-col gap-12 lg:gap-16`}>
        <Heading
          id="problema"
          n={sectionNumber('problema')}
          size="xl"
          eyebrow={m.landing_problem_eyebrow()}
          title={m.landing_problem_title()}
          lead={
            <>
              {m.landing_problem_lead()}
              <Cite n={4} />
              <Cite n={1} />
              <Cite n={3} />
            </>
          }
        />
        <div data-reveal="" data-fx="stagger" className="grid gap-4 lg:grid-cols-12 lg:gap-5">
          <article
            data-s=""
            style={stagger(0)}
            className={cn(
              CARD,
              'photo-bg photo-fabrica relative flex flex-col gap-7 overflow-hidden p-7 sm:p-9 lg:col-span-7 lg:row-span-3',
              'max-sm:-mx-4 max-sm:rounded-[1.75rem] max-sm:border-x-0',
            )}
          >
            <Kicker>{m.landing_gap_title()}</Kicker>
            <div className="relative">
              <p className={cn(STAT, 'lp-bignum')}>
                <CountUp value={FACTS.capturePct} format={(n) => formatPercent(n)} />
              </p>
              <p className="mt-3 flex flex-wrap items-center gap-y-2 font-medium text-lg">
                {m.landing_gap_value_label()}
                <Estimate className="text-muted-foreground" />
              </p>
            </div>
            <div
              role="img"
              aria-label={`${formatPercent(FACTS.capturePct)} ${m.landing_gap_value_label()} (${m.landing_estimate_tag()})`}
              className="lp-dotbar lp-dotbar-lg"
            >
              <span style={{ width: `${FACTS.capturePct}%` }} />
            </div>
            <div className="relative rounded-2xl border border-border bg-card/90 p-5 sm:p-6">
              <p className="lp-kicker">{m.landing_ledger_label()}</p>
              <dl className="mt-3 flex flex-col">
                {ledger.map((row) => (
                  <div
                    key={row.id}
                    className={cn(
                      'grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-x-2 py-2.5 sm:gap-x-3',
                      row.total && 'border-border border-t',
                    )}
                  >
                    <span aria-hidden="true" className="font-mono text-muted-foreground text-sm">
                      {row.op}
                    </span>
                    <dt
                      className={cn(
                        'text-pretty text-sm leading-snug sm:text-[0.9375rem]',
                        row.total ? 'font-medium text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {row.label}
                      {row.estimate && <Estimate className="text-muted-foreground" />}
                    </dt>
                    <dd
                      className={cn(
                        'text-right font-medium font-serif tabular-nums leading-none',
                        row.total ? 'text-2xl sm:text-[1.75rem]' : 'text-xl',
                        row.id === 'residual' && 'text-primary',
                      )}
                    >
                      {row.count === undefined ? (
                        row.value
                      ) : (
                        <CountUp
                          value={row.count}
                          format={(v) => formatTonnes(v)}
                          duration={1200}
                        />
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="relative mt-auto border-primary border-l-2 pl-5 text-pretty text-[0.9375rem] leading-relaxed sm:text-base">
              {m.landing_problem_directive()}
              <Cite n={2} />
            </p>
          </article>

          <article
            data-s=""
            style={stagger(1)}
            className={cn(CARD, 'flex flex-col gap-4 p-6 lg:col-span-5')}
          >
            <Kicker>{m.landing_benchmark_title()}</Kicker>
            <p className={cn(STAT, 'text-4xl sm:text-5xl')}>
              {m.landing_benchmark_vs({ a: formatNumber(1.92, 2), b: formatNumber(4.27, 2) })}
            </p>
            <p className="font-medium">{m.landing_benchmark_label()}</p>
            <p className={`${MONO} mt-auto border-border border-t pt-4`}>
              {m.landing_benchmark_source()}
              <Cite n={6} />
            </p>
          </article>

          <article
            data-s=""
            style={stagger(2)}
            className={cn(CARD, 'flex flex-col gap-4 p-6 lg:col-span-5')}
          >
            <Kicker>{m.landing_dest_title()}</Kicker>
            <div
              role="img"
              aria-label={DESTINATIONS.map((d) => `${labels[d.id]} ${formatPercent(d.share)}`).join(
                ', ',
              )}
              className="flex h-3 gap-1"
            >
              {DESTINATIONS.map((d) => (
                <span
                  key={d.id}
                  className={cn('lp-grow rounded-full', d.tone)}
                  style={{ flex: d.share, ...stagger(3) }}
                />
              ))}
            </div>
            <ul className="grid gap-2 text-sm">
              {DESTINATIONS.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden="true" className={`size-2.5 rounded-full ${d.tone}`} />
                    {labels[d.id]}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatPercent(d.share)}{' '}
                    <span className="text-muted-foreground">· {formatTonnes(d.t)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className={`${MONO} mt-auto border-border border-t pt-4`}>
              {m.landing_fig_4_caption()}
              <Cite n={4} />
            </p>
          </article>

          <article
            data-s=""
            style={stagger(3)}
            className={cn(CARD, 'flex flex-col gap-4 p-6 lg:col-span-5')}
          >
            <Kicker>{m.landing_impact_eyebrow()}</Kicker>
            <dl className="grid grid-cols-3 gap-3">
              {network.map((n) => (
                <div key={n.id} className="flex flex-col gap-1.5">
                  <dd className={cn(STAT, 'order-1 text-4xl sm:text-5xl')}>
                    <CountUp value={n.value} format={(v) => formatNumber(Math.round(v))} />
                  </dd>
                  <dt className="order-2 text-muted-foreground text-sm">{n.label}</dt>
                </div>
              ))}
            </dl>
            <p className={`${MONO} mt-auto border-border border-t pt-4`}>
              {m.landing_stat_collected_source()}
              <Cite n={4} />
            </p>
          </article>
        </div>
      </div>
    </Section>
  );
}

const sv = {
  viewBox: '0 0 40 40',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  focusable: false,
  className: 'size-9',
} as const;

/** Micro-ilustrações dos cinco passos do pipeline (decorativas, só traço e a cor primária da marca). */
const NODE_ART = [
  // Dados: cilindros empilhados.
  <svg key="data" aria-hidden="true" {...sv}>
    <ellipse cx="20" cy="10" rx="11" ry="4" />
    <path d="M9 10v10c0 2.2 4.9 4 11 4s11-1.8 11-4V10M9 20v10c0 2.2 4.9 4 11 4s11-1.8 11-4V20" />
  </svg>,
  // Procura: meio-tom de pontos que crescem.
  <svg key="demand" aria-hidden="true" {...sv} stroke="none" fill="currentColor">
    {[0, 1, 2].flatMap((y) =>
      [0, 1, 2].map((x) => (
        <circle key={`${x}${y}`} cx={9 + x * 11} cy={9 + y * 11} r={1.2 + ((x + y) / 4) * 3.4} />
      )),
    )}
  </svg>,
  // Otimizador: rede com um nó escolhido.
  <svg key="solver" aria-hidden="true" {...sv}>
    <path d="M8 29 20 9l12 18M8 29h24M20 9v14M8 29l12-6 12 4" />
    <circle cx="20" cy="23" r="4" className="fill-primary" />
    <circle cx="8" cy="29" r="2.5" className="fill-card" />
    <circle cx="20" cy="9" r="2.5" className="fill-card" />
    <circle cx="32" cy="27" r="2.5" className="fill-card" />
  </svg>,
  // Cenários: dois grupos de barras.
  <svg key="scen" aria-hidden="true" {...sv}>
    <path d="M6 34h28" />
    <rect x="9" y="18" width="5" height="16" rx="1" className="fill-primary/25" />
    <rect x="16" y="10" width="5" height="24" rx="1" className="fill-primary" />
    <rect x="25" y="22" width="5" height="12" rx="1" className="fill-primary/25" />
  </svg>,
  // Copiloto: balão com visto.
  <svg key="copilot" aria-hidden="true" {...sv}>
    <path d="M7 10h26v16H21l-7 6v-6H7z" />
    <path d="m14 18 4 4 8-8" />
  </svg>,
];

/**
 * Método: pipeline horizontal (dados → procura → otimizador → cenários → Copiloto) ligado por um fio SVG que se desenha ao
 * entrar (vertical em telemóvel); cada passo com a sua micro-ilustração. Por baixo, o modelo em três linhas e a calibração.
 */
export function Method() {
  const nodes = [
    [m.landing_pipe_data(), m.landing_pipe_data_sub()],
    [m.landing_pipe_demand(), m.landing_pipe_demand_sub()],
    [m.landing_pipe_solver(), m.landing_pipe_solver_sub()],
    [m.landing_pipe_scenarios(), m.landing_pipe_scenarios_sub()],
    [m.landing_pipe_copilot(), m.landing_pipe_copilot_sub()],
  ] as const;
  const formulas = [
    [
      m.landing_formula_demand(),
      <>
        D<sub>z</sub> = P<sub>z</sub> · q · 12
      </>,
    ],
    [
      m.landing_formula_capture(),
      <>
        C<sub>z</sub> = D<sub>z</sub> · c<sub>m</sub>
      </>,
    ],
    [
      m.landing_formula_cost(),
      <>
        €/t = custo anual ÷ Σ C<sub>z</sub>
      </>,
    ],
  ] as const;
  return (
    <Section id="metodo" tone="band" className="lp-dotgrid">
      <div className={`${CONTAINER} flex flex-col gap-14 lg:gap-20`}>
        <Heading
          id="metodo"
          n={sectionNumber('metodo')}
          align="center"
          eyebrow={m.landing_method_eyebrow()}
          title={m.landing_method_title()}
          lead={m.landing_method_lead()}
        />
        <figure className="flex flex-col gap-8">
          <div role="img" aria-label={m.landing_pipe_label()}>
            <ol
              data-reveal=""
              data-fx="stagger"
              aria-hidden="true"
              className="lp-pipe relative grid gap-9 lg:grid-cols-5 lg:gap-6"
            >
              <svg
                aria-hidden="true"
                className="lp-thread lp-thread-h"
                viewBox="0 0 100 1"
                preserveAspectRatio="none"
                focusable="false"
              >
                <line x1="0" x2="100" y1="0.5" y2="0.5" className="stroke-border" strokeWidth="1" />
                <line
                  data-draw=""
                  pathLength={1}
                  x1="0"
                  x2="100"
                  y1="0.5"
                  y2="0.5"
                  className="stroke-primary"
                  strokeWidth="1"
                />
              </svg>
              {nodes.map(([title, sub], i) => (
                <li key={title} data-s="" style={stagger(i)} className="lp-node">
                  <span className={cn('lp-node-tile', i === 2 && 'lp-node-tile-on')}>
                    {NODE_ART[i]}
                  </span>
                  <div className="lp-node-text">
                    <span className={MONO}>{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="font-medium font-serif text-2xl leading-tight">{title}</h3>
                    <p className={MONO}>{sub}</p>
                    {i === 4 && (
                      <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-primary/50 border-dashed bg-primary/5 px-3 py-1.5 font-mono text-[11px] text-foreground">
                        <span aria-hidden="true" className="text-primary">
                          ✓
                        </span>
                        {m.landing_pipe_verifier()}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <FigCaption label={m.landing_fig_1()} className="mx-auto text-center">
            {m.landing_fig_1_caption()}
          </FigCaption>
        </figure>
        <div data-reveal="" data-fx="stagger" className="grid gap-4 lg:grid-cols-12 lg:gap-5">
          <div
            data-s=""
            style={stagger(0)}
            className="lp-term dark rounded-[1.375rem] border border-border bg-card p-7 text-foreground sm:p-9 lg:col-span-7"
          >
            <Kicker>{m.landing_formulas_title()}</Kicker>
            <dl className="mt-6 grid gap-5 font-mono">
              {formulas.map(([label, f]) => (
                <div key={label} className="flex flex-col gap-1 border-border border-t pt-4">
                  <dt className="text-[12px] text-muted-foreground">{label}</dt>
                  <dd className="text-lg sm:text-xl">
                    <span aria-hidden="true" className="mr-3 text-primary">
                      ›
                    </span>
                    {f}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div
            data-s=""
            style={stagger(1)}
            className={cn(CARD, 'flex flex-col justify-between gap-6 p-7 sm:p-9 lg:col-span-5')}
          >
            <p className={BODY}>
              {m.landing_method_calibration()}
              <Cite n={4} />
            </p>
            <p className="border-border border-t pt-5 font-mono text-foreground text-lg tabular-nums sm:text-xl">
              {formatTonnes(FACTS.rsuT, 0)} × {formatPercent(FACTS.textileShareOfRsuPct)} ≈{' '}
              {formatTonnes(FACTS.residualT)}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
