import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Download, RefreshCw, WifiOff } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { BrandSymbol } from '@/components/brand-logo';
import { formatTonnes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { FACTS } from './facts';
import { BODY, CONTAINER, Heading, MONO, Section } from './layout';
import { ParishMap } from './parish-map';
import { sectionNumber } from './sections';

/** Micro-visual SVG de um cartão (decorativo). Os `group-hover:` só atuam com rato (Tailwind envolve-os em `@media (hover: hover)`). */
function Art({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 100"
      aria-hidden="true"
      focusable="false"
      className="h-full max-h-40 w-full"
    >
      {children}
    </svg>
  );
}

/** Origem e eixo do transform dentro de um SVG: o elemento move-se sobre a sua própria caixa. */
const BOX = '[transform-box:fill-box] transition-transform duration-500 ease-out';
const delay = (i: number): CSSProperties => ({ transitionDelay: `${i * 60}ms` });

function SimulatorArt() {
  const rows = [
    {
      label: m.landing_mock_budget(),
      hint: m.landing_mock_you(),
      from: 'w-[44%]',
      to: 'group-hover:w-[68%]',
      at: 'left-[44%] group-hover:left-[68%]',
    },
    {
      label: m.landing_mock_goal(),
      hint: `${formatTonnes(FACTS.collectedT)} → ${formatTonnes(FACTS.potentialT, 0)}`,
      from: 'w-[30%]',
      to: 'group-hover:w-[52%]',
      at: 'left-[30%] group-hover:left-[52%]',
    },
  ];
  return (
    <div
      aria-hidden="true"
      className="w-full space-y-5 rounded-2xl border border-border bg-background/70 p-5"
    >
      {rows.map((r) => (
        <div key={r.label} className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium text-[13px]">{r.label}</span>
            <span className={cn(MONO, 'tabular-nums')}>{r.hint}</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-border">
            <span
              className={cn(
                'absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700 ease-out',
                r.from,
                r.to,
              )}
            />
            <span
              className={cn(
                'absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-card transition-[left] duration-700 ease-out',
                r.at,
              )}
            />
          </div>
        </div>
      ))}
      <span className="inline-flex h-10 items-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground text-sm transition-transform duration-300 group-hover:scale-[1.03]">
        {m.landing_mock_run()}
      </span>
    </div>
  );
}

function ScenariosArt() {
  const a = [38, 62, 50];
  const b = [54, 40, 70];
  return (
    <Art>
      <path d="M12 88h176" className="stroke-border" strokeWidth="1.5" />
      {a.map((h, i) => (
        <rect
          key={h}
          x={22 + i * 20}
          y={88 - h}
          width="14"
          height={h}
          rx="3"
          style={delay(i)}
          className={cn('origin-bottom fill-primary group-hover:scale-y-[0.7]', BOX)}
        />
      ))}
      {b.map((h, i) => (
        <rect
          key={h}
          x={112 + i * 20}
          y={88 - h}
          width="14"
          height={h}
          rx="3"
          style={delay(i)}
          className={cn('origin-bottom fill-areia group-hover:scale-y-[1.2]', BOX)}
        />
      ))}
    </Art>
  );
}

function WhatIfArt() {
  return (
    <Art>
      <g className={cn('group-hover:-translate-y-1', BOX)}>
        <rect x="64" y="6" width="130" height="32" rx="11" className="fill-primary" />
        <rect x="76" y="16" width="86" height="4" rx="2" className="fill-primary-foreground/70" />
        <rect x="76" y="25" width="54" height="4" rx="2" className="fill-primary-foreground/45" />
      </g>
      <g className={cn('group-hover:translate-y-1', BOX)}>
        <rect
          x="8"
          y="50"
          width="146"
          height="42"
          rx="11"
          className="fill-background stroke-border"
        />
        <rect x="20" y="62" width="76" height="4" rx="2" className="fill-border" />
        <rect x="20" y="72" width="48" height="4" rx="2" className="fill-border" />
        <circle cx="128" cy="71" r="10" className="fill-primary/15" />
        <path
          d="m122 71 4 4 8-9"
          fill="none"
          className="stroke-primary"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </Art>
  );
}

function LotsArt() {
  return (
    <Art>
      {Array.from({ length: 49 }, (_, i) => {
        const x = i % 7;
        const y = Math.floor(i / 7);
        const on = (x * 3 + y * 5 + x * y) % 3 !== 0 || (x < 2 && y < 2);
        return on ? (
          <rect
            key={`${x}-${y}`}
            x={14 + x * 10}
            y={10 + y * 11.5}
            width="8"
            height="9"
            rx="1.5"
            className="fill-foreground"
          />
        ) : null;
      })}
      <rect
        x="8"
        y="8"
        width="82"
        height="2.5"
        rx="1.25"
        className={cn('fill-primary group-hover:translate-y-[78px]', BOX)}
        style={{ transitionDuration: '900ms' }}
      />
      <rect x="112" y="16" width="76" height="6" rx="3" className="fill-border" />
      <rect x="112" y="32" width="54" height="6" rx="3" className="fill-border" />
      <rect x="112" y="48" width="68" height="6" rx="3" className="fill-areia" />
      <rect x="112" y="64" width="40" height="6" rx="3" className="fill-border" />
    </Art>
  );
}

function ExchangeArt() {
  const rows = [
    [128, 'fill-primary'],
    [92, 'fill-areia'],
    [58, 'fill-chart-2'],
  ] as const;
  return (
    <Art>
      {rows.map(([w, c], i) => (
        <g key={c}>
          <rect x="10" y={14 + i * 28} width="180" height="14" rx="7" className="fill-border/60" />
          <rect
            x="10"
            y={14 + i * 28}
            width={w}
            height="14"
            rx="7"
            style={delay(i)}
            className={cn(
              'origin-left',
              c,
              i % 2 ? 'group-hover:scale-x-[1.3]' : 'group-hover:scale-x-[0.8]',
              BOX,
            )}
          />
        </g>
      ))}
    </Art>
  );
}

function BrandsArt() {
  const rows = [150, 118, 84, 52];
  return (
    <Art>
      {rows.map((w, i) => (
        <g key={w}>
          <circle cx="18" cy={16 + i * 22} r="8" className="fill-secondary stroke-border" />
          <rect
            x="34"
            y={10 + i * 22}
            width={w}
            height="12"
            rx="6"
            style={delay(i)}
            className={cn(
              'origin-left group-hover:scale-x-[1.12]',
              i === 0 ? 'fill-primary' : 'fill-primary/35',
              BOX,
            )}
          />
        </g>
      ))}
    </Art>
  );
}

function ReportArt() {
  return (
    <Art>
      <g className={cn('origin-bottom group-hover:-translate-y-1.5 group-hover:-rotate-3', BOX)}>
        <rect
          x="62"
          y="4"
          width="76"
          height="92"
          rx="6"
          className="fill-background stroke-border"
          strokeWidth="1.5"
        />
        <rect x="72" y="14" width="34" height="4" rx="2" className="fill-border" />
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={74 + i * 14}
            y={66 - (i + 1) * 11}
            width="9"
            height={(i + 1) * 11}
            rx="2"
            className={i === 3 ? 'fill-primary' : 'fill-primary/35'}
          />
        ))}
        <rect x="72" y="76" width="56" height="3" rx="1.5" className="fill-border" />
        <rect x="72" y="83" width="36" height="3" rx="1.5" className="fill-border" />
      </g>
      <rect x="116" y="70" width="34" height="16" rx="4" className="fill-areia" />
      <text
        x="133"
        y="82"
        textAnchor="middle"
        className="fill-[#14211d] font-mono font-semibold text-[9px]"
      >
        PDF
      </text>
    </Art>
  );
}

function TriageArt() {
  return (
    <Art>
      {['M34 30V14h16', 'M150 14h16v16', 'M166 70v16h-16', 'M50 86H34V70'].map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          className={cn('origin-center stroke-primary group-hover:scale-90', BOX)}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      <rect x="64" y="32" width="72" height="36" rx="6" className="fill-background stroke-border" />
      <rect x="72" y="41" width="38" height="4" rx="2" className="fill-border" />
      <rect x="72" y="51" width="26" height="4" rx="2" className="fill-areia" />
      <rect
        x="44"
        y="26"
        width="112"
        height="2.5"
        rx="1.25"
        className={cn('fill-primary group-hover:translate-y-[44px]', BOX)}
        style={{ transitionDuration: '900ms' }}
      />
    </Art>
  );
}

function PwaArt() {
  const chips = [WifiOff, Download, RefreshCw];
  return (
    <div aria-hidden="true" className="flex items-center justify-center gap-8">
      <div className="relative h-36 w-[4.5rem] rounded-[1.1rem] border-2 border-border bg-background p-1.5 transition-transform duration-500 ease-out group-hover:-translate-y-2">
        <div className="mx-auto mb-2 h-1 w-6 rounded-full bg-foreground/70" />
        <div className="grid h-[calc(100%-1rem)] place-items-center rounded-xl bg-accent">
          <BrandSymbol className="size-8" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {chips.map((Icon, i) => (
          <span
            key={Icon.displayName ?? i}
            style={delay(i)}
            className="grid size-11 place-items-center rounded-full border border-border bg-background text-primary transition-transform duration-500 group-hover:translate-x-1.5"
          >
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
        ))}
      </div>
    </div>
  );
}

type Card = {
  key: string;
  title: string;
  text: string;
  /** Âncora da página (`#id`) ou `/register`. */
  to: string;
  art: ReactNode;
  wide?: boolean;
  className?: string;
};

/**
 * Produto, em bento de 4 colunas por 3 linhas (dois cartões largos): cada cartão tem um micro-visual próprio e uma
 * microinteração ao passar o rato (só com rato; em toque ficam estáticos), e liga à secção ou ao registo.
 */
export function Features() {
  const cards: Card[] = [
    {
      key: 'simulator',
      title: m.landing_feat_simulator_title(),
      text: m.landing_feat_simulator_text(),
      to: '#prova',
      art: <SimulatorArt />,
      wide: true,
    },
    {
      key: 'scenarios',
      title: m.landing_feat_scenarios_title(),
      text: m.landing_feat_scenarios_text(),
      to: '#prova',
      art: <ScenariosArt />,
    },
    {
      key: 'whatif',
      title: m.landing_feat_whatif_title(),
      text: m.landing_feat_whatif_text(),
      to: '#copiloto',
      art: <WhatIfArt />,
    },
    {
      key: 'map',
      title: m.landing_feat_map_title(),
      text: m.landing_feat_map_text(),
      to: '/register',
      art: (
        <ParishMap
          places
          label={m.landing_mock_map_title()}
          className="h-full max-h-40 w-auto transition-transform duration-700 ease-out group-hover:scale-105"
        />
      ),
      className: 'dark border-border bg-card',
    },
    {
      key: 'lots',
      title: m.landing_feat_lots_title(),
      text: m.landing_feat_lots_text(),
      to: '/register',
      art: <LotsArt />,
      className: 'bg-accent/60',
    },
    {
      key: 'exchange',
      title: m.landing_feat_exchange_title(),
      text: m.landing_feat_exchange_text(),
      to: '/register',
      art: <ExchangeArt />,
    },
    {
      key: 'brands',
      title: m.landing_feat_brands_title(),
      text: m.landing_feat_brands_text(),
      to: '/register',
      art: <BrandsArt />,
    },
    {
      key: 'report',
      title: m.landing_feat_report_title(),
      text: m.landing_feat_report_text(),
      to: '/register',
      art: <ReportArt />,
      className: 'bg-secondary/60',
    },
    {
      key: 'triage',
      title: m.landing_feat_triage_title(),
      text: m.landing_feat_triage_text(),
      to: '/register',
      art: <TriageArt />,
    },
    {
      key: 'pwa',
      title: m.landing_feat_pwa_title(),
      text: m.landing_feat_pwa_text(),
      to: '/register',
      art: <PwaArt />,
      wide: true,
      className: 'bg-primary/10',
    },
  ];
  const linkClass =
    'mt-auto inline-flex min-h-11 items-center gap-1 self-start rounded-sm font-medium text-primary text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <Section id="produto">
      <div className={`${CONTAINER} flex flex-col gap-12 lg:gap-16`}>
        <Heading
          id="produto"
          n={sectionNumber('produto')}
          size="xl"
          eyebrow={m.landing_product_eyebrow()}
          title={m.landing_features_title()}
          lead={m.landing_features_lead()}
        />
        <ul
          data-reveal=""
          data-fx="stagger"
          className="grid grid-flow-dense gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(19rem,auto)] lg:gap-5"
        >
          {cards.map((c, i) => {
            const anchor = c.to.startsWith('#');
            const label = anchor ? m.landing_feat_see() : m.landing_feat_try();
            const inner = (
              <>
                {label}
                <span className="sr-only">: {c.title}</span>
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </>
            );
            return (
              <li
                key={c.key}
                data-s=""
                style={{ '--i': i } as CSSProperties}
                className={cn(
                  'lp-card group flex flex-col gap-5 overflow-hidden rounded-[1.375rem] border border-border bg-card p-6',
                  c.wide && 'sm:col-span-2 sm:flex-row sm:items-center sm:gap-10',
                  c.className,
                )}
              >
                <div
                  className={cn(
                    'flex h-40 w-full items-center justify-center',
                    c.wide && 'sm:order-2 sm:h-auto sm:flex-[1.3]',
                  )}
                >
                  {c.art}
                </div>
                <div className={cn('flex flex-1 flex-col gap-2', c.wide && 'sm:order-1')}>
                  <h3 className={cn('text-xl leading-snug', c.wide && 'sm:text-3xl')}>{c.title}</h3>
                  <p className={`${BODY} text-[0.9375rem]`}>{c.text}</p>
                  {anchor ? (
                    <a href={c.to} className={linkClass}>
                      {inner}
                    </a>
                  ) : (
                    <Link to="/register" className={linkClass}>
                      {inner}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
