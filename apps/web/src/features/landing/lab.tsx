import { type CSSProperties, useId, useRef, useState } from 'react';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { useInViewOnce } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { FACTS } from './facts';
import {
  CARD,
  CARD_TITLE,
  Cite,
  Estimate,
  FigCaption,
  GRID_GAP,
  LandingSection,
  MONO,
  STAT,
  type Status,
  StatusBadge,
} from './layout';

const MIN_T = FACTS.collectedT;
const MAX_T = 1500;
const pct = (t: number) => ((t - MIN_T) / (MAX_T - MIN_T)) * 100;

type Zone = 'now' | 'model' | 'above' | 'cap';
function zoneOf(t: number): Zone {
  if (t < MIN_T + 8) return 'now';
  if (t <= FACTS.ceilingT) return 'model';
  if (t <= FACTS.potentialT) return 'above';
  return 'cap';
}
const zoneText = (z: Zone) =>
  ({
    now: m.landing_sim_zone_now(),
    model: m.landing_sim_zone_model(),
    above: m.landing_sim_zone_above(),
    cap: m.landing_sim_zone_cap(),
  })[z];

/**
 * Mini simulador (Fig. 2): arrasta a meta anual e vê o que exige, contra os marcos reais. São contas diretas sobre
 * dados reais (sem solver, sem IA, sem pedidos): captação do potencial (estimativa), kg por habitante e face a 2025.
 */
function MiniSimulator() {
  const [target, setTarget] = useState<number>(FACTS.franceT);
  const id = useId();
  const zone = zoneOf(target);
  const marks = [
    { n: 1, value: FACTS.collectedT, label: m.landing_sim_mark_now() },
    { n: 2, value: FACTS.ceilingT, label: m.landing_sim_mark_model() },
    { n: 3, value: FACTS.franceT, label: m.landing_sim_mark_fr() },
    { n: 4, value: FACTS.potentialT, label: m.landing_sim_mark_potential() },
  ];
  return (
    <figure className={`${CARD} flex flex-col gap-6`}>
      <h3 className={CARD_TITLE}>{m.landing_sim_title()}</h3>
      <div className="flex flex-col gap-3">
        <label htmlFor={id} className="font-medium">
          {m.landing_sim_label()}
        </label>
        <p className={`${STAT} flex flex-wrap items-baseline gap-x-3`}>
          <output htmlFor={id}>{formatTonnes(target)}</output>
        </p>
        <div className="relative pt-5">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-5">
            {marks.map((k) => (
              <span
                key={k.n}
                className="absolute -translate-x-1/2 font-mono text-[11px] text-muted-foreground"
                style={{ left: `${pct(k.value)}%` }}
              >
                {k.n}
              </span>
            ))}
          </div>
          <input
            id={id}
            type="range"
            min={MIN_T}
            max={MAX_T}
            step={1}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            aria-valuetext={`${formatTonnes(target)}`}
            className="lp-range h-11 w-full cursor-pointer"
            style={{ '--fill': `${pct(target)}%` } as CSSProperties}
          />
        </div>
        <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {marks.map((k) => (
            <li key={k.n} className={`${MONO} flex gap-2`}>
              <span className="w-3 text-foreground">{k.n}</span>
              <span>
                {k.label}: {formatTonnes(k.value)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <dl className="grid grid-cols-3 gap-3 border-border border-t pt-5">
        <div>
          <dd className="font-medium font-serif text-2xl tabular-nums lg:text-3xl">
            {formatPercent((target / FACTS.potentialT) * 100, 0)}
          </dd>
          <dt className={MONO}>
            {m.landing_sim_capture()} <Estimate />
          </dt>
        </div>
        <div>
          <dd className="font-medium font-serif text-2xl tabular-nums lg:text-3xl">
            {formatNumber((target * 1000) / FACTS.inhabitants, 1)}
          </dd>
          <dt className={MONO}>{`kg ${m.landing_sim_per_capita()}`}</dt>
        </div>
        <div>
          <dd className="font-medium font-serif text-2xl tabular-nums lg:text-3xl">
            {formatPercent((target / FACTS.collectedT) * 100, 0)}
          </dd>
          <dt className={MONO}>{m.landing_sim_vs_today()}</dt>
        </div>
      </dl>
      <p
        role="status"
        className={cn(
          'rounded-lg border px-4 py-3 text-pretty text-sm leading-relaxed',
          zone === 'above' || zone === 'cap'
            ? 'border-dashed border-foreground/40'
            : 'border-primary/40 bg-primary/5',
        )}
      >
        {zoneText(zone)}
      </p>
      <FigCaption label={m.landing_fig_2()}>{m.landing_fig_2_caption()}</FigCaption>
      <p className={MONO}>
        {m.landing_sim_note()} <StatusBadge status="validating" />
      </p>
    </figure>
  );
}

/** Fig. 3: o intervalo P10-P90 do cenário de 60 000 €/ano (500 amostras, semente 7), em SVG que se desenha ao entrar. */
function FanChart() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInViewOnce(ref);
  const s = FACTS.scenario60k;
  const lo = 80;
  const hi = 180;
  const x = (v: number) => 20 + ((v - lo) / (hi - lo)) * 320;
  const eur = (v: number) => `${formatNumber(v, 1)} €/t`;
  return (
    <figure className={`${CARD} flex flex-col gap-4`}>
      <h3 className={CARD_TITLE}>
        {m.landing_fan_title()} <Estimate />
      </h3>
      <div ref={ref} data-in={seen} className="lp-draw">
        <svg
          viewBox="0 0 360 120"
          role="img"
          aria-label={`${m.landing_fan_title()}: P10 ${eur(s.p10)}, P50 ${eur(s.p50)}, P90 ${eur(s.p90)}; ${m.landing_fan_central()} ${eur(s.eurPerT)}`}
          className="h-auto w-full"
        >
          <line x1="20" x2="340" y1="64" y2="64" className="stroke-border" strokeWidth="1" />
          {[80, 100, 120, 140, 160, 180].map((v) => (
            <g key={v}>
              <line x1={x(v)} x2={x(v)} y1="64" y2="69" className="stroke-border" />
              <text
                x={x(v)}
                y="84"
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[9px]"
              >
                {v}
              </text>
            </g>
          ))}
          <g data-fade="">
            <rect
              x={x(s.p10)}
              y="50"
              width={x(s.p90) - x(s.p10)}
              height="28"
              rx="3"
              className="fill-primary/15"
            />
          </g>
          <line
            data-draw=""
            pathLength={1}
            x1={x(s.p10)}
            x2={x(s.p90)}
            y1="64"
            y2="64"
            className="stroke-primary"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {[s.p10, s.p50, s.p90].map((v, i) => (
            <g key={v}>
              <line
                x1={x(v)}
                x2={x(v)}
                y1="46"
                y2="82"
                className="stroke-primary"
                strokeWidth="2"
              />
              <text
                x={x(v)}
                y="38"
                textAnchor="middle"
                className="fill-foreground font-mono text-[10px]"
              >
                {['P10', 'P50', 'P90'][i]}
              </text>
              <text
                x={x(v)}
                y="26"
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[9px]"
              >
                {formatNumber(v, 1)}
              </text>
            </g>
          ))}
          <g data-fade="">
            <path
              d={`M${x(s.eurPerT)} 56l6 8-6 8-6-8Z`}
              className="fill-areia stroke-foreground"
              strokeWidth="1"
            />
            <text
              x={x(s.eurPerT)}
              y="106"
              textAnchor="middle"
              className="fill-foreground font-mono text-[10px]"
            >
              {m.landing_fan_central()} {formatNumber(s.eurPerT, 1)}
            </text>
          </g>
        </svg>
      </div>
      <figcaption className={`${MONO} max-w-prose text-pretty`}>
        {m.landing_fan_caption()}
      </figcaption>
    </figure>
  );
}

type Row = {
  key: string;
  param: string;
  value: string;
  source: React.ReactNode;
  status: Status;
};

/** Tabela 1: pressupostos com valor, fonte e estado (medido, estimativa, pressuposto, calibrado, por verificar, em validação). */
function AssumptionsTable() {
  const rows: Row[] = [
    {
      key: 'collected',
      param: m.landing_row_collected(),
      value: formatTonnes(FACTS.collectedT),
      source: (
        <>
          {m.landing_row_collected_src()}
          <Cite n={4} />
        </>
      ),
      status: 'measured',
    },
    {
      key: 'people',
      param: m.landing_row_people(),
      value: formatNumber(FACTS.inhabitants),
      source: (
        <>
          {m.landing_row_people_src()}
          <Cite n={3} />
        </>
      ),
      status: 'measured',
    },
    {
      key: 'q',
      param: m.landing_row_q(),
      value: m.landing_row_q_val(),
      source: (
        <>
          {m.landing_row_q_src()}
          <Cite n={1} />
        </>
      ),
      status: 'estimate',
    },
    {
      key: 'potential',
      param: m.landing_row_potential(),
      value: `≈ ${formatTonnes(FACTS.potentialT)}`,
      source: m.landing_row_potential_src(),
      status: 'estimate',
    },
    {
      key: 'capture',
      param: m.landing_row_capture(),
      value: formatPercent(FACTS.capturePct),
      source: m.landing_row_capture_src(),
      status: 'estimate',
    },
    {
      key: 'street',
      param: m.landing_row_street(),
      value: formatPercent(FACTS.streetCapturePct),
      source: m.landing_row_street_src(),
      status: 'calibrated',
    },
    {
      key: 'detour',
      param: m.landing_row_detour(),
      value: m.landing_row_detour_val(),
      source: m.landing_row_detour_src(),
      status: 'assumption',
    },
    {
      key: 'costs',
      param: m.landing_row_costs(),
      value: '—',
      source: m.landing_row_costs_src(),
      status: 'validating',
    },
    {
      key: 'locations',
      param: m.landing_row_locations(),
      value: '—',
      source: m.landing_row_locations_src(),
      status: 'validating',
    },
    {
      key: 'france',
      param: m.landing_row_france(),
      value: m.landing_row_france_val(),
      source: (
        <>
          {m.landing_row_france_src()}
          <Cite n={6} />
        </>
      ),
      status: 'unverified',
    },
    {
      key: 'ceiling',
      param: m.landing_row_ceiling(),
      value: m.landing_row_ceiling_val(),
      source: m.landing_row_ceiling_src(),
      status: 'estimate',
    },
  ];
  const cell =
    'block px-4 py-1 before:mb-0.5 before:block before:font-mono before:text-[11px] before:text-muted-foreground before:content-[attr(data-label)] md:table-cell md:px-4 md:py-3 md:before:hidden';
  return (
    <figure className="flex flex-col gap-3">
      <FigCaption label={m.landing_table_1()}>{m.landing_table_1_title()}</FigCaption>
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <table className="block w-full text-left text-sm md:table">
          <thead className="sr-only md:not-sr-only md:table-header-group">
            <tr className="border-border border-b bg-secondary/50 md:table-row">
              {[
                m.landing_table_param(),
                m.landing_table_value(),
                m.landing_table_source(),
                m.landing_table_status(),
              ].map((h) => (
                <th key={h} scope="col" className={`${MONO} px-4 py-2.5 font-semibold`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="block divide-y divide-border md:table-row-group">
            {rows.map((r) => (
              <tr key={r.key} className="block py-3 md:table-row md:py-0">
                <th
                  scope="row"
                  data-label={m.landing_table_param()}
                  className={`${cell} font-medium`}
                >
                  {r.param}
                </th>
                <td
                  data-label={m.landing_table_value()}
                  className={`${cell} font-mono tabular-nums`}
                >
                  {r.value}
                </td>
                <td
                  data-label={m.landing_table_source()}
                  className={`${cell} text-muted-foreground`}
                >
                  {r.source}
                </td>
                <td data-label={m.landing_table_status()} className={cell}>
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Prova: mini simulador interativo, intervalo de incerteza e a tabela de pressupostos. */
export function Evidence() {
  return (
    <LandingSection
      id="prova"
      eyebrow={m.landing_proof_eyebrow()}
      title={m.landing_proof_title()}
      lead={m.landing_proof_lead()}
    >
      <div className={`grid items-start lg:grid-cols-2 ${GRID_GAP}`}>
        <MiniSimulator />
        <FanChart />
      </div>
      <AssumptionsTable />
    </LandingSection>
  );
}
