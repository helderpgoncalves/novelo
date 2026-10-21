import { Droplets, Link2, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatList, weekdayLong } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { collectionLabel, shiftLabel, typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import type { Focus } from './fleet-search';
import { type Block, type Issue, issuesOf } from './schedule';
import { blockStyle, TypologyMark } from './typology-style';

export type Density = 'compact' | 'comfortable';

/** Texto acessível de um bloco: o que é, quando, com quem e que avisos tem. */
export function blockLabel(b: Block): string {
  const flags = [
    b.overlap && m.fl_flag_overlap(),
    b.grouped && m.fl_flag_grouped(),
    b.wash && m.fl_flag_wash(),
    b.daysAssumed && m.fl_flag_days_assumed(),
  ].filter(Boolean);
  return [
    b.circuit,
    typologyLabel[b.typology](),
    `${weekdayLong(b.day)}, ${shiftLabel[b.shift]()}`,
    m.fl_block_vehicles({ plates: b.plates.join(', ') }),
    b.crew ? m.fl_crew_people({ count: b.crew }) : '',
    b.collections.length ? b.collections.map((c) => collectionLabel[c]()).join(', ') : '',
    ...flags,
  ]
    .filter(Boolean)
    .join('. ');
}

export function FlagIcons({ block, className }: { block: Block; className?: string }) {
  if (!block.overlap && !block.grouped && !block.wash && !block.daysAssumed) return null;
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {block.overlap && (
        <TriangleAlert
          className="size-3 text-[var(--fleet-warn)]"
          aria-hidden="true"
          strokeWidth={2.5}
        />
      )}
      {block.grouped && (
        <Link2 className="size-3 text-muted-foreground" aria-hidden="true" strokeWidth={2.5} />
      )}
      {block.wash && <Droplets className="size-3 text-[var(--ty-recyclable)]" aria-hidden="true" />}
      {block.daysAssumed && (
        <span className="font-semibold text-[10px] leading-none" aria-hidden="true">
          *
        </span>
      )}
    </span>
  );
}

interface ChipProps {
  block: Block;
  density: Density;
  onOpen: (circuit: string) => void;
  dim?: boolean;
  selected?: boolean;
  /** Mostra só o código (grelha por viatura). */
  tiny?: boolean;
  /** O que mostrar além do código: viaturas (padrão) ou nada. */
  hidePlates?: boolean;
}

/** Bloco de um circuito num turno: cor e forma da tipologia, código, e as viaturas em modo confortável. */
export function BlockChip({ block, density, onOpen, dim, selected, tiny, hidePlates }: ChipProps) {
  const comfortable = density === 'comfortable' && !tiny;
  const chip = (
    <button
      type="button"
      onClick={() => onOpen(block.circuit)}
      aria-label={blockLabel(block)}
      aria-haspopup="dialog"
      style={blockStyle(block.typology)}
      className={cn(
        'group/chip relative min-w-0 rounded-[5px] border-l-[3px] text-left text-foreground ring-1 ring-foreground/10 transition-[box-shadow,opacity] hover:ring-foreground/35 focus-visible:z-10',
        tiny ? 'flex w-full items-center gap-1 px-1 py-0.5 text-[11px]' : 'text-xs',
        !tiny &&
          (comfortable
            ? 'flex w-full flex-col px-2 py-1'
            : 'inline-flex items-center gap-1 px-1.5 py-0.5'),
        block.overlap && 'ring-[var(--fleet-warn)] ring-2',
        selected && 'ring-2 ring-primary',
        dim && 'opacity-35',
      )}
    >
      <span className="flex min-w-0 items-center gap-1">
        {!tiny && <TypologyMark typology={block.typology} className="size-2.5" />}
        <span className={cn('truncate font-semibold tabular-nums', tiny && 'max-w-full')}>
          {block.circuit}
        </span>
        {!tiny && <FlagIcons block={block} />}
      </span>
      {tiny && block.wash && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-[var(--ty-recyclable)]"
        />
      )}
      {comfortable && !hidePlates && (
        <span className="truncate text-[11px] text-muted-foreground tabular-nums">
          {block.plates.join(' · ')}
          {block.crew ? ` · ${m.fl_crew_short({ count: block.crew })}` : ''}
        </span>
      )}
    </button>
  );
  if (comfortable) return chip;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent className="max-w-64 space-y-0.5 text-left">
        <p className="font-semibold">
          {block.circuit} · {typologyLabel[block.typology]()}
        </p>
        <p className="tabular-nums">{block.plates.join(', ')}</p>
        {block.crew > 0 && <p>{m.fl_crew_people({ count: block.crew })}</p>}
        {block.collections.length > 0 && (
          <p>{block.collections.map((c) => collectionLabel[c]()).join(', ')}</p>
        )}
        {block.overlap && <p>{m.fl_flag_overlap()}</p>}
        {block.grouped && <p>{m.fl_flag_grouped()}</p>}
        {block.wash && <p>{m.fl_flag_wash()}</p>}
        {block.daysAssumed && <p>{m.fl_flag_days_assumed()}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

/* ----------------------------------------------------------------- avisos */

const daysText = (issue: Issue) =>
  formatList((issue.days ?? [issue.day ?? 1]).map((d) => weekdayLong(d)));

export function issueText(issue: Issue): string {
  switch (issue.kind) {
    case 'plate_overlap':
      return m.fl_issue_overlap({
        plate: issue.plate ?? '',
        circuits: formatList(issue.detail),
        day: daysText(issue),
        shift: shiftLabel[issue.shift ?? 'morning'](),
      });
    case 'plate_grouped':
      return m.fl_issue_grouped({
        plate: issue.plate ?? '',
        circuits: formatList(issue.detail),
        day: daysText(issue),
        shift: shiftLabel[issue.shift ?? 'morning'](),
      });
    case 'wash_between_flows':
      return m.fl_issue_wash({
        plate: issue.plate ?? '',
        day: daysText(issue),
        flows: formatList(
          issue.detail.map((t) => typologyLabel[t as keyof typeof typologyLabel]()),
        ),
      });
    case 'vehicle_idle':
      return m.fl_issue_idle({ plate: issue.plate ?? '' });
    case 'circuit_without_vehicle':
      return m.fl_issue_nocar({ circuit: issue.circuit ?? '' });
    case 'days_assumed':
      return m.fl_issue_days_assumed({ circuit: issue.circuit ?? '' });
  }
}

interface SummaryItem {
  focus: Focus;
  count: number;
  label: string;
  hint: string;
  icon: ReactNode;
}

export function IssueSummary({
  issues,
  focus,
  onFocus,
}: {
  issues: Issue[];
  focus: Focus | undefined;
  onFocus: (focus: Focus | undefined) => void;
}) {
  const distinct = (list: Issue[], key: 'plate' | 'circuit') =>
    new Set(list.map((i) => i[key])).size;
  const all: SummaryItem[] = [
    {
      focus: 'overlap' as const,
      count: distinct(issuesOf(issues, 'plate_overlap'), 'plate'),
      label: m.fl_summary_overlap(),
      hint: m.fl_summary_overlap_hint(),
      icon: <TriangleAlert className="size-3.5 text-[var(--fleet-warn)]" aria-hidden="true" />,
    },
    {
      focus: 'wash' as const,
      count: distinct(issuesOf(issues, 'wash_between_flows'), 'plate'),
      label: m.fl_summary_wash(),
      hint: m.fl_summary_wash_hint(),
      icon: <Droplets className="size-3.5 text-[var(--ty-recyclable)]" aria-hidden="true" />,
    },
    {
      focus: 'idle' as const,
      count: issuesOf(issues, 'vehicle_idle').length,
      label: m.fl_summary_idle(),
      hint: m.fl_summary_idle_hint(),
      icon: <TypologyMark typology="unassigned" />,
    },
    {
      focus: 'nocar' as const,
      count: issuesOf(issues, 'circuit_without_vehicle').length,
      label: m.fl_summary_nocar(),
      hint: m.fl_summary_nocar_hint(),
      icon: <TypologyMark typology="unassigned" />,
    },
  ];
  const items = all.filter((i) => i.count > 0);
  if (!items.length) return null;

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={m.fl_summary_label()}>
      {items.map((i) => (
        <li key={i.focus}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-pressed={focus === i.focus}
                onClick={() => onFocus(focus === i.focus ? undefined : i.focus)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 pointer-coarse:h-10 text-xs transition-colors',
                  focus === i.focus
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'bg-card text-foreground hover:bg-muted',
                )}
              >
                {i.icon}
                {i.label}
                <span className="font-semibold tabular-nums">{i.count}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{i.hint}</TooltipContent>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}

export function Legend({ className }: { className?: string }) {
  return (
    <ul
      className={cn('flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground', className)}
      aria-label={m.fl_legend()}
    >
      <li className="flex items-center gap-1">
        <TriangleAlert className="size-3 text-[var(--fleet-warn)]" aria-hidden="true" />
        {m.fl_flag_overlap()}
      </li>
      <li className="flex items-center gap-1">
        <Link2 className="size-3" aria-hidden="true" />
        {m.fl_flag_grouped()}
      </li>
      <li className="flex items-center gap-1">
        <Droplets className="size-3 text-[var(--ty-recyclable)]" aria-hidden="true" />
        {m.fl_flag_wash()}
      </li>
      <li className="flex items-center gap-1">
        <span className="font-semibold" aria-hidden="true">
          *
        </span>
        {m.fl_flag_days_assumed_short()}
      </li>
      <li className="flex items-center gap-1">
        <span className="inline-block h-3 w-4 rounded-sm bg-primary/10 ring-1 ring-primary/40" />
        {m.fl_today()}
      </li>
    </ul>
  );
}
