import { Link } from '@tanstack/react-router';
import { ArrowRight, MessageCircle, Pause, Play } from 'lucide-react';
import type { Overview } from '@/client';
import { Button } from '@/components/ui/button';
import { openCopilot } from '@/features/copilot/store';
import { formatKg, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { benchmarkSubject } from './copy';
import { pickBenchmark } from './derive';
import { CountUp, useInView, useMotion } from './motion';
import { rich, slot } from './rich';
import { EstimateTag } from './story-section';

const kg = (v: number) => formatNumber(v, 2);

/** Gancho: a frase-conclusão com os três números que contam a história. */
export function Hero({ overview }: { overview: Overview }) {
  const { gap, references } = overview;
  const bench = pickBenchmark(references);
  const { paused, setPaused, systemReduced } = useMotion();
  const [ref, seen] = useInView<HTMLElement>(0.1);

  return (
    <section
      ref={ref}
      aria-labelledby="home-hero-title"
      className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10"
    >
      <div className="min-w-0 space-y-6 lg:col-span-8 lg:py-4">
        <p className="eyebrow">{m.home_hero_eyebrow({ year: gap.year })}</p>
        <h1
          id="home-hero-title"
          className="text-balance font-medium text-[2.15rem] leading-[1.08] tracking-tight sm:text-5xl xl:text-[3.6rem]"
        >
          <span className="block">
            {rich(m.home_hero_l1({ value: slot('value') }), {
              value: (
                <CountUp
                  value={gap.kg_per_inhab_year}
                  format={kg}
                  active={seen}
                  className="text-primary"
                />
              ),
            })}
          </span>
          {bench && (
            <span className="mt-1 block text-muted-foreground">
              {rich(m.home_hero_there({ subject: benchmarkSubject(bench), value: slot('value') }), {
                value: (
                  <CountUp
                    value={bench.kg_per_inhab_year}
                    format={kg}
                    active={seen}
                    className="text-foreground"
                  />
                ),
              })}
            </span>
          )}
          <span className="mt-1 block">
            {rich(m.home_hero_l3({ value: slot('value') }), {
              value: (
                <CountUp
                  value={gap.missing_t}
                  format={(v) => formatNumber(Math.round(v))}
                  active={seen}
                  className="text-primary underline decoration-2 decoration-areia underline-offset-[0.18em]"
                />
              ),
            })}
            <EstimateTag className="ml-3 align-middle" />
          </span>
        </h1>
        <p className="max-w-2xl text-base text-foreground/80 leading-relaxed sm:text-lg">
          {m.home_hero_lede()}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg" className="h-12 px-6 text-base">
            <Link to="/simulator">
              {m.home_cta_simulate()}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 px-6 text-base"
            onClick={() => openCopilot()}
          >
            <MessageCircle className="text-primary" aria-hidden="true" />
            {m.home_cta_copilot()}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-muted-foreground text-xs">
          <p>
            {m.home_hero_trust({
              parishes: gap.parishes_count,
              population: formatNumber(gap.population),
            })}
          </p>
          {!systemReduced && (
            <button
              type="button"
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md px-2 font-medium text-foreground/80 underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {paused ? (
                <Play className="size-3.5" aria-hidden="true" />
              ) : (
                <Pause className="size-3.5" aria-hidden="true" />
              )}
              {paused ? m.home_motion_play() : m.home_motion_pause()}
            </button>
          )}
        </div>
      </div>
      <div className="lg:col-span-4">
        <CaptureRing overview={overview} active={seen} />
      </div>
    </section>
  );
}

const R = 78;
const CIRC = 2 * Math.PI * R;

/** Anel: a fração do potencial que já se recolhe, com a marca do nível da referência. */
function CaptureRing({ overview, active }: { overview: Overview; active: boolean }) {
  const { gap, references } = overview;
  const { enabled } = useMotion();
  const bench = pickBenchmark(references);
  const share = Math.min(1, gap.collected_t / gap.potential_t);
  const benchShare = bench
    ? Math.min(1, bench.kg_per_inhab_year / gap.potential_kg_per_inhab_year)
    : null;
  const drawn = active || !enabled;
  const angle = benchShare === null ? 0 : benchShare * 2 * Math.PI - Math.PI / 2;

  return (
    <figure
      className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6"
      aria-label={m.home_ring_aria({
        collected: formatTonnes(gap.collected_t),
        potential: formatTonnes(gap.potential_t, 0),
        pct: formatPercent(gap.capture_pct),
      })}
    >
      <div className="relative mx-auto aspect-square w-full max-w-[17rem]">
        <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="100" cy="100" r={R} fill="none" strokeWidth="16" className="stroke-muted" />
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            strokeWidth="16"
            strokeLinecap="butt"
            className="stroke-primary"
            strokeDasharray={CIRC}
            strokeDashoffset={drawn ? CIRC * (1 - share) : CIRC}
            style={{
              transition: enabled ? 'stroke-dashoffset 1.4s cubic-bezier(.22,.8,.3,1)' : 'none',
            }}
          />
          {benchShare !== null && (
            <circle
              cx="100"
              cy="100"
              r="94"
              fill="none"
              strokeWidth="1.5"
              strokeDasharray="2 4"
              className="stroke-foreground/40"
            />
          )}
        </svg>
        {benchShare !== null && (
          <span
            aria-hidden="true"
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-card"
            style={{
              left: `${50 + 47 * Math.cos(angle)}%`,
              top: `${50 + 47 * Math.sin(angle)}%`,
            }}
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <CountUp
            value={gap.capture_pct}
            format={(v) => formatPercent(v)}
            active={active}
            className="font-medium font-serif text-5xl text-foreground leading-none tracking-tight"
          />
          <span className="mt-1.5 text-muted-foreground text-xs">{m.home_ring_center()}</span>
          <EstimateTag className="mt-2" />
        </div>
      </div>
      <figcaption>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2.5">
            <span className="size-3 shrink-0 rounded-sm bg-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">{m.home_ring_collected({ year: gap.year })}</span>
            <span className="font-semibold tabular-nums">{formatTonnes(gap.collected_t)}</span>
          </li>
          <li className="flex items-center gap-2.5">
            <span
              className="size-3 shrink-0 rounded-sm bg-muted ring-1 ring-border"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">{m.home_ring_potential()}</span>
            <span className="font-semibold tabular-nums">{formatTonnes(gap.potential_t, 0)}</span>
          </li>
          {bench && benchShare !== null && (
            <li className="flex items-center gap-2.5">
              <span className="size-3 shrink-0 rounded-full bg-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                {m.home_ring_bench({ place: bench.label, kg: formatKg(bench.kg_per_inhab_year) })}
              </span>
              <span className="font-semibold tabular-nums">
                {formatPercent(benchShare * 100, 0)}
              </span>
            </li>
          )}
        </ul>
        <p className="mt-3 text-muted-foreground text-xs">{m.home_ring_source()}</p>
      </figcaption>
    </figure>
  );
}
