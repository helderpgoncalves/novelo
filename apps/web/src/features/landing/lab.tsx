import { type CSSProperties, useId, useRef, useState } from 'react';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { formatDate } from '@/lib/i18n';
import { useInViewOnce } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { FACTS } from './facts';
import {
  CONTAINER,
  Estimate,
  FigCaption,
  Heading,
  MONO,
  Section,
  type Status,
  StatusBadge,
} from './layout';
import { sectionNumber } from './sections';

const MIN_T = FACTS.collectedT;
// Até ao têxtil gerado (estimativa ≈ 2 626 t), arredondado para cima.
const MAX_T = 2700;
const THUMB = 28;
const pct = (t: number) => ((t - MIN_T) / (MAX_T - MIN_T)) * 100;
/** Posição exata sob o centro da alça (o trilho nativo deixa meia alça em cada ponta). */
const underThumb = (p: number) => `calc(${p}% + ${(0.5 - p / 100) * THUMB}px)`;

type Zone = 'now' | 'above' | 'cap';
function zoneOf(t: number): Zone {
  if (t < MIN_T + 8) return 'now';
  if (t <= FACTS.potentialT) return 'above';
  return 'cap';
}
const zoneText = (z: Zone) =>
  ({
    now: m.landing_sim_zone_now(),
    above: m.landing_sim_zone_above(),
    cap: m.landing_sim_zone_cap(),
  })[z];

/** Fig. 3: o intervalo P10-P90 do cenário de 60 000 €/ano (500 amostras, semente 7), em SVG que se desenha ao entrar. */
function FanChart() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInViewOnce(ref);
  const s = FACTS.scenario60k;
  const lo = 80;
  const hi = 180;
  const x = (v: number) => 24 + ((v - lo) / (hi - lo)) * 312;
  const eur = (v: number) => `${formatNumber(v, 1)} €/t`;
  return (
    <div ref={ref} data-in={seen} className="lp-draw">
      <svg
        viewBox="0 0 360 130"
        role="img"
        aria-label={`${m.landing_fan_title()}: P10 ${eur(s.p10)}, P50 ${eur(s.p50)}, P90 ${eur(s.p90)}; ${m.landing_fan_central()} ${eur(s.eurPerT)}`}
        className="h-auto w-full"
      >
        <line x1="24" x2="336" y1="68" y2="68" className="stroke-border" strokeWidth="1" />
        {[80, 100, 120, 140, 160, 180].map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1="68" y2="74" className="stroke-border" />
            <text
              x={x(v)}
              y="90"
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[11px]"
            >
              {v}
            </text>
          </g>
        ))}
        <g data-fade="">
          <rect
            x={x(s.p10)}
            y="52"
            width={x(s.p90) - x(s.p10)}
            height="32"
            rx="4"
            className="fill-primary/20"
          />
        </g>
        <line
          data-draw=""
          pathLength={1}
          x1={x(s.p10)}
          x2={x(s.p90)}
          y1="68"
          y2="68"
          className="stroke-primary"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {[s.p10, s.p50, s.p90].map((v, i) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1="48" y2="86" className="stroke-primary" strokeWidth="2" />
            <text
              x={x(v)}
              y="40"
              textAnchor="middle"
              className="fill-foreground font-mono text-[12px]"
            >
              {['P10', 'P50', 'P90'][i]}
            </text>
            <text
              x={x(v)}
              y="24"
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[11px]"
            >
              {formatNumber(v, 1)}
            </text>
          </g>
        ))}
        <g data-fade="">
          <path
            d={`M${x(s.eurPerT)} 59l7 9-7 9-7-9Z`}
            className="fill-areia stroke-foreground"
            strokeWidth="1"
          />
          <text
            x={x(s.eurPerT)}
            y="114"
            textAnchor="middle"
            className="fill-foreground font-mono text-[12px]"
          >
            {m.landing_fan_central()} {formatNumber(s.eurPerT, 1)}
          </text>
        </g>
      </svg>
    </div>
  );
}

/**
 * Prova: um painel estilo instrumento (tinta, controlos à esquerda, leitura em mono à direita). Arrasta a meta anual e vê o que
 * exige contra os marcos reais. São contas diretas sobre dados reais (sem otimizador, sem IA, sem pedidos): a barra cheia é
 * medido, o ponteado é estimativa. Em baixo, o intervalo de incerteza do €/t (Fig. 3).
 */
function Instrument() {
  const [target, setTarget] = useState<number>(FACTS.franceT);
  const id = useId();
  const zone = zoneOf(target);
  const bars: { id: string; label: string; value: number; status: Status }[] = [
    { id: 'now', label: m.landing_sim_mark_now(), value: FACTS.collectedT, status: 'measured' },
    { id: 'fr', label: m.landing_sim_mark_fr(), value: FACTS.franceT, status: 'unverified' },
    {
      id: 'pot',
      label: m.landing_sim_mark_potential(),
      value: FACTS.potentialT,
      status: 'estimate',
    },
  ];
  const readouts = [
    {
      id: 'capture',
      value: formatPercent((target / FACTS.potentialT) * 100, 0),
      label: m.landing_sim_capture(),
      estimate: true,
    },
    {
      id: 'kg',
      value: formatNumber((target * 1000) / FACTS.inhabitants, 1),
      label: `kg ${m.landing_sim_per_capita()}`,
      estimate: false,
    },
    {
      id: 'vs',
      value: formatPercent((target / FACTS.collectedT) * 100, 0),
      label: m.landing_sim_vs_today(),
      estimate: false,
    },
  ];
  return (
    <figure
      data-reveal=""
      data-fx="scale"
      className="dark overflow-hidden rounded-[1.75rem] border border-border bg-card text-foreground max-sm:-mx-4 max-sm:rounded-[1.75rem] max-sm:border-x-0"
    >
      <div className="flex items-center justify-between gap-4 border-border border-b px-6 py-3.5 sm:px-8">
        <p className="flex items-center gap-2.5 font-mono text-[12px] text-muted-foreground uppercase tracking-[0.12em]">
          <span aria-hidden="true" className="lp-led" />
          {m.landing_sim_title()}
        </p>
        <StatusBadge status="validating" />
      </div>
      <div className="grid lg:grid-cols-12">
        <div className="flex flex-col gap-6 p-6 sm:p-8 lg:col-span-5 lg:border-border lg:border-r">
          <label htmlFor={id} className="lp-kicker">
            {m.landing_sim_label()}
          </label>
          <p className="font-medium font-serif text-6xl tabular-nums leading-none tracking-tight sm:text-7xl">
            <output htmlFor={id}>{formatTonnes(target)}</output>
          </p>
          <div className="relative pt-4">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-4">
              {bars.map((b) => (
                <span
                  key={b.id}
                  className="absolute bottom-0 h-2 w-px bg-foreground/40"
                  style={{ left: underThumb(pct(b.value)) }}
                />
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
              aria-valuetext={formatTonnes(target)}
              className="lp-range h-11 w-full cursor-pointer"
              style={{ '--fill': `${pct(target)}%` } as CSSProperties}
            />
          </div>
          <p
            role="status"
            className={cn(
              'text-pretty rounded-xl border px-4 py-3 text-sm leading-relaxed',
              zone === 'above' || zone === 'cap'
                ? 'border-foreground/40 border-dashed'
                : 'border-primary/40 bg-primary/10',
            )}
          >
            {zoneText(zone)}
          </p>
        </div>
        <div className="flex flex-col gap-7 p-6 sm:p-8 lg:col-span-7">
          <div className="grid grid-cols-[minmax(6.5rem,9.5rem)_1fr] gap-x-4">
            <ul>
              {bars.map((b) => (
                <li key={b.id} className="flex h-[3.5rem] flex-col justify-center gap-0.5">
                  <span className="text-[13px] leading-tight">{b.label}</span>
                  <span className={cn(MONO, 'tabular-nums')}>{formatTonnes(b.value)}</span>
                </li>
              ))}
            </ul>
            <div className="relative" aria-hidden="true">
              {bars.map((b) => (
                <div key={b.id} className="flex h-[3.5rem] items-center">
                  <div className="h-2.5 w-full rounded-full bg-foreground/10">
                    <div
                      className={cn(
                        'lp-grow h-full rounded-full',
                        b.status === 'measured' ? 'bg-primary' : 'lp-dotfill',
                        b.status === 'unverified' && 'opacity-60',
                      )}
                      style={{ width: `${(b.value / MAX_T) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              <span className="lp-cursor" style={{ left: `${(target / MAX_T) * 100}%` }} />
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3 border-border border-t pt-6">
            {readouts.map((r) => (
              <div key={r.id} className="flex flex-col gap-1.5">
                <dd className="font-medium font-serif text-3xl tabular-nums leading-none sm:text-4xl">
                  {r.value}
                </dd>
                <dt className={cn(MONO, 'flex flex-wrap items-center gap-x-1.5 gap-y-1')}>
                  {r.label}
                  {r.estimate && <Estimate className="ml-0" />}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="grid gap-6 border-border border-t p-6 sm:p-8 lg:grid-cols-12 lg:items-center lg:gap-10">
        <div className="flex flex-col gap-3 lg:col-span-5">
          <p className="lp-kicker">
            {m.landing_fan_title()}
            <Estimate className="ml-2" />
          </p>
          <p className={cn(MONO, 'text-pretty')}>
            {m.landing_fan_caption({ date: formatDate(FACTS.scenario60k.computedOn, 'long') })}
          </p>
        </div>
        <div className="lg:col-span-7">
          <FanChart />
        </div>
      </div>
      <div className="flex flex-col gap-1 border-border border-t px-6 py-4 sm:px-8">
        <FigCaption label={m.landing_fig_2()} className="max-w-none">
          {m.landing_fig_2_caption()}
        </FigCaption>
        <p className={MONO}>{m.landing_sim_note()}</p>
      </div>
    </figure>
  );
}

/** Prova: o painel-instrumento e, por cima, título à esquerda e subtítulo à direita (cabeçalho dividido). */
export function Evidence() {
  return (
    <Section id="prova">
      <div className={`${CONTAINER} flex flex-col gap-12 lg:gap-16`}>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
          <Heading
            id="prova"
            n={sectionNumber('prova')}
            size="md"
            eyebrow={m.landing_proof_eyebrow()}
            title={m.landing_proof_title()}
            className="max-w-none lg:col-span-7"
          />
          <p className="lp-lead text-muted-foreground lg:col-span-5">{m.landing_proof_lead()}</p>
        </div>
        <Instrument />
      </div>
    </Section>
  );
}
