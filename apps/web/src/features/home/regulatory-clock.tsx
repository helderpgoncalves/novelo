import { ExternalLink } from 'lucide-react';
import { Fragment } from 'react';
import type { OverviewMilestone } from '@/client';
import { formatDate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { daysUntil } from './derive';
import { useInView, useMotion } from './motion';
import { UnverifiedTag, VerifiedTag } from './story-section';

const MILESTONE_COPY: Record<string, { title: () => string; body: () => string }> = {
  municipal_obligation: {
    title: () => m.home_ms_municipal_obligation_title(),
    body: () => m.home_ms_municipal_obligation_body(),
  },
  transposition_deadline: {
    title: () => m.home_ms_transposition_deadline_title(),
    body: () => m.home_ms_transposition_deadline_body(),
  },
  epr_regimes: {
    title: () => m.home_ms_epr_regimes_title(),
    body: () => m.home_ms_epr_regimes_body(),
  },
};

const DAY_MS = 86_400_000;
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();

function MilestoneCard({ ms, today }: { ms: OverviewMilestone; today: Date }) {
  const copy = MILESTONE_COPY[ms.key];
  const days = daysUntil(ms.date, today);
  const done = days <= 0 && ms.status === 'done';
  return (
    <article
      className={cn(
        'h-full space-y-2 rounded-lg p-4 ring-1',
        ms.who_pays === 'producers' ? 'bg-primary/5 ring-primary/30' : 'bg-card ring-foreground/10',
      )}
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <time dateTime={ms.date} className="font-semibold text-sm tabular-nums">
          {formatDate(ms.date)}
        </time>
        <span className="text-muted-foreground text-xs tabular-nums">
          {done ? m.home_clock_done() : m.home_clock_in_days({ days })}
        </span>
      </p>
      <h3 className="font-sans font-semibold text-base leading-snug">{copy?.title() ?? ms.key}</h3>
      {copy && <p className="text-muted-foreground text-sm leading-relaxed">{copy.body()}</p>}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {ms.verified ? <VerifiedTag /> : <UnverifiedTag />}
        {ms.source_url ? (
          <a
            href={ms.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
          >
            {ms.source_label}
            <ExternalLink className="size-3" aria-hidden="true" />
            <span className="sr-only">{m.common_opens_new_tab()}</span>
          </a>
        ) : (
          ms.source_label
        )}
      </p>
    </article>
  );
}

/** Linha do tempo: de 1 jan 2025 a 17 abr 2028, com "hoje" e quem paga em cada fase. */
export function RegulatoryClock({ timeline }: { timeline: OverviewMilestone[] }) {
  const { enabled } = useMotion();
  const [ref, seen] = useInView<HTMLDivElement>(0.2);
  const today = new Date();
  const items = [...timeline].sort((a, b) => a.date.localeCompare(b.date));
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return null;

  const eprMs = items.find((i) => i.who_pays === 'producers') ?? last;
  const start = utc(first.date);
  const eprAt = utc(eprMs.date);
  // O eixo acaba um pouco depois do último marco, para mostrar a fase "pagam os produtores".
  const end = eprAt + (eprAt - start) * 0.14;
  const todayAt = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const at = (t: number) => Math.max(0, Math.min(100, ((t - start) / (end - start)) * 100));
  const todayPct = at(todayAt);
  const drawn = seen || !enabled;
  const daysToEpr = Math.round((eprAt - todayAt) / DAY_MS);

  return (
    <div ref={ref} className="space-y-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium font-serif text-5xl text-primary tabular-nums leading-none sm:text-6xl">
          {Math.max(0, daysToEpr)}
        </span>
        <span className="text-base leading-snug sm:text-lg">
          {m.home_clock_days_to({ date: formatDate(eprMs.date) })}
        </span>
      </p>

      {/* Desktop: eixo horizontal à escala do tempo. */}
      <div className="hidden md:block" aria-hidden="true">
        <div className="relative h-14">
          <div
            className="absolute top-6 left-0 h-2 origin-left rounded-l-full bg-foreground"
            style={{
              width: `${todayPct}%`,
              transform: drawn ? 'scaleX(1)' : 'scaleX(0)',
              transition: enabled ? 'transform 1.4s cubic-bezier(.22,.8,.3,1)' : 'none',
            }}
          />
          <div
            className="absolute top-6 h-2 bg-foreground/25"
            style={{ left: `${todayPct}%`, width: `${at(eprAt) - todayPct}%` }}
          />
          <div
            className="absolute top-6 h-2 rounded-r-full bg-primary"
            style={{ left: `${at(eprAt)}%`, right: 0 }}
          />
          {items.map((i) => (
            <span
              key={i.key}
              className={cn(
                'absolute top-[22px] size-4 -translate-x-1/2 rounded-full ring-2 ring-card',
                i.who_pays === 'producers' ? 'bg-primary' : 'bg-foreground',
              )}
              style={{ left: `${at(utc(i.date))}%` }}
            />
          ))}
          <span
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${todayPct}%` }}
          >
            <span className="rounded-full bg-areia/25 px-2 py-0.5 font-semibold text-[10px] uppercase tracking-wider ring-1 ring-areia">
              {m.home_clock_today()}
            </span>
            <span className="h-4 w-px bg-areia" />
          </span>
          <span
            className="absolute top-11 left-0 text-[11px] text-muted-foreground"
            style={{ width: `${at(eprAt)}%` }}
          >
            {m.home_clock_phase_municipality()}
          </span>
          <span
            className="absolute top-11 right-0 text-right text-[11px] text-primary"
            style={{ left: `${at(eprAt)}%` }}
          >
            {m.home_clock_phase_producers()}
          </span>
        </div>
      </div>

      <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {items.map((i, idx) => {
          const next = items[idx + 1];
          const showToday =
            daysUntil(i.date, today) <= 0 && (!next || daysUntil(next.date, today) > 0);
          return (
            <Fragment key={i.key}>
              <li>
                <MilestoneCard ms={i} today={today} />
              </li>
              {showToday && (
                <li className="flex items-center gap-2 font-semibold text-xs md:hidden">
                  <span
                    className="size-3 rounded-full bg-areia ring-2 ring-card"
                    aria-hidden="true"
                  />
                  {m.home_clock_today_mobile({ date: formatDate(today) })}
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}
