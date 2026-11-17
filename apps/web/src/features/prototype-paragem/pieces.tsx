// PROTOTIPO (#50) — pecas visuais partilhadas pelas variantes. DESCARTAVEL.
import {
  ChevronDown,
  ChevronRight,
  Printer,
  QrCode,
  ScanLine,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type * as React from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  type Bag,
  formatKg,
  formatTime,
  labelBags,
  SCENARIOS,
  type ScenarioId,
  type SimState,
  type StopKind,
  type SyncState,
  totalG,
  uncoveredBags,
} from './model';

/** Alvo grande para usar ao lado do volante (>= 56 px, texto 16 px+). */
export function BigButton({
  children,
  onClick,
  disabled,
  tone = 'primary',
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
}) {
  const tones = {
    primary: 'bg-primary text-primary-foreground shadow-lg',
    secondary: 'bg-secondary text-secondary-foreground',
    ghost: 'bg-transparent text-foreground border border-border',
    danger: 'bg-destructive text-white',
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold',
        'active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45',
        tones[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Pill({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'good' | 'warn' | 'brand';
}) {
  const tones = {
    muted: 'bg-muted text-muted-foreground',
    good: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    brand: 'bg-areia/40 text-foreground',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export const KIND_LABEL: Record<StopKind, string> = {
  escola: 'escola',
  local: 'local público',
  pedido: 'a pedido',
};

export function BagIcon({ kind }: { kind: Bag['kind'] }) {
  if (kind === 'account') return <UserRound className="size-5 shrink-0" aria-hidden="true" />;
  return <QrCode className="size-5 shrink-0" aria-hidden="true" />;
}

/** Etiqueta 72 mm (Zebra ZQ511): QR com UUID + código. Prévia, não impressão real. */
/** Grelha decorativa que imita um QR, determinística a partir do código. */
function qrCells(code: string): Array<{ id: string; on: boolean }> {
  return Array.from({ length: 81 }, (_, i) => {
    let h = 0;
    for (const ch of code) h = (h * 31 + ch.charCodeAt(0) + i * 7) % 97;
    return { id: `${code}-${h}-${i}`, on: h % 2 === 0 };
  });
}

export function LabelPreview({ code, caption }: { code: string; caption: string }) {
  const cells = qrCells(code);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-card p-3">
      <div className="grid size-16 shrink-0 grid-cols-9 gap-px rounded-sm bg-background p-1">
        {cells.map((c) => (
          <span
            key={c.id}
            className={cn('size-1 rounded-[1px]', c.on ? 'bg-foreground' : 'bg-transparent')}
          />
        ))}
      </div>
      <div className="min-w-0">
        <p className="truncate font-mono text-sm font-semibold tracking-wider">
          {code.toUpperCase()}
        </p>
        <p className="text-xs text-muted-foreground">{caption}</p>
      </div>
      <Printer className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}

/** Estado do lote em construcao — sempre a vista (regra do prototipo: mostrar o estado). */
export function StateStrip({ state }: { state: SimState }) {
  const rec = state.record;
  if (!rec) return null;
  const labels = labelBags(rec).length;
  const printed = labelBags(rec).filter((b) => b.labelPrintedAt).length;
  const uncovered = uncoveredBags(rec).length;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-sm">
      <span className="font-semibold">{rec.code}</span>
      <span>{rec.bags.length} sacos</span>
      <span className="text-muted-foreground">·</span>
      <span>
        {rec.weighings.length === 0 ? (
          'por pesar'
        ) : (
          <>
            {formatKg(totalG(rec))} <Pill tone="brand">medido</Pill>
          </>
        )}
      </span>
      {labels > 0 && (
        <>
          <span className="text-muted-foreground">·</span>
          <span>
            etiquetas {printed}/{labels}
          </span>
        </>
      )}
      {uncovered > 0 && rec.weighings.length > 0 && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-amber-600 dark:text-amber-400">{uncovered} sem pesar</span>
        </>
      )}
    </div>
  );
}

export function SyncPill({ sync }: { sync: SyncState }) {
  if (sync === 'synced') return <Pill tone="good">sincronizado</Pill>;
  if (sync === 'pending') return <Pill tone="warn">à espera de sincronização</Pill>;
  return <Pill>aberta</Pill>;
}

/** Historico de registos (append-only): o que ja foi para o servidor e o que espera. */
export function SyncPanel({ state }: { state: SimState }) {
  const pending = state.history.filter((h) => h.sync === 'pending').length;
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Registos de hoje</h3>
        {state.online ? (
          <Pill tone="good">
            <Wifi className="size-3" aria-hidden="true" /> com rede
          </Pill>
        ) : (
          <Pill tone="warn">
            <WifiOff className="size-3" aria-hidden="true" /> sem rede
          </Pill>
        )}
      </div>
      {pending > 0 && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {pending} registo{pending > 1 ? 's' : ''} no dispositivo (IndexedDB). O QR do passaporte
          nunca dá 404: mostra «à espera de sincronização» até a rede voltar.
        </p>
      )}
      {state.history.length === 0 && (
        <p className="text-sm text-muted-foreground">Ainda sem paragens fechadas.</p>
      )}
      <ul className="space-y-1.5">
        {state.history.map((h) => (
          <li
            key={h.code}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <span className="font-medium">{h.site}</span>
            <span className="text-muted-foreground">{formatKg(totalG(h))}</span>
            <span className="ml-auto">
              <SyncPill sync={h.sync} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Encontros que faltam scanear (o mundo, não o ecrã). */
export function RemainingHint({ state }: { state: SimState }) {
  const rec = state.record;
  const stop = state.route[state.cursor];
  if (!rec || !stop) return null;
  const left = stop.encounters.length - rec.consumed;
  if (left === 0)
    return <p className="text-sm text-muted-foreground">Nada mais à vista — scan completo.</p>;
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <ScanLine className="size-4" aria-hidden="true" />
      {left} saco{left > 1 ? 's' : ''} à vista
    </p>
  );
}

/** Cabecalho comum minimo: sessao de equipa + paragem + rota. Cada variante usa como quer. */
export function StopHeader({ state, compact = false }: { state: SimState; compact?: boolean }) {
  const stop = state.route[state.cursor];
  const total = state.route.length;
  return (
    <div className={cn('space-y-1', compact && 'text-sm')}>
      <p className="eyebrow">{state.routeName}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          {state.cursor + 1 <= total && stop ? stop.site : 'Rota concluída'}
        </h2>
        {stop && (
          <>
            <Pill>
              {state.cursor + 1} / {total}
            </Pill>
            <Pill tone="brand">{KIND_LABEL[stop.kind]}</Pill>
          </>
        )}
      </div>
      {!compact && stop && <p className="text-sm text-muted-foreground">{stop.detail}</p>}
      {!compact && <p className="text-xs text-muted-foreground">{state.team}</p>}
    </div>
  );
}

/**
 * Painel «mundo simulado»: rede, cenários e repositório. NÃO faz parte do ecrã da viatura —
 * e a bancada de teste (o que existe fisicamente na paragem).
 */
export function WorldPanel({
  state,
  onReset,
  onToggleOnline,
}: {
  state: SimState;
  onReset: (s: ScenarioId) => void;
  onToggleOnline: (online: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = SCENARIOS.find((s) => s.id === state.scenario);
  return (
    <section className="mt-6 rounded-xl border border-dashed border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        Mundo simulado — bancada de teste
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {current?.label} · {state.online ? 'com rede' : 'sem rede'}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-dashed border-border px-3 py-3">
          <p className="text-sm text-muted-foreground">
            Protótipo: balança, impressora e câmara são simulados. Os «sacos à vista» acabam quando
            o mundo da paragem acaba.
            {current ? ` Neste cenário: ${current.watch}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onReset(s.id)}
                className={cn(
                  'min-h-11 rounded-full border px-3 text-sm',
                  s.id === state.scenario
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-border bg-background',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={state.online}
              onChange={(e) => onToggleOnline(e.target.checked)}
              className="size-5"
            />
            Com rede (desligar para ver o offline: pesagem e impressão continuam, a sincronização
            espera)
          </label>
        </div>
      )}
    </section>
  );
}

/** Moldura de telemóvel: o ecrã do condutor é um Android na carrinha. */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md border-x border-border/60 pb-24 sm:my-6 sm:rounded-2xl sm:border sm:shadow-lg">
      {children}
    </div>
  );
}

export function EventLine({ state }: { state: SimState }) {
  if (!state.lastEvent) return null;
  return (
    <p className="rounded-lg bg-areia/25 px-3 py-2 text-sm text-foreground" role="status">
      {state.lastEvent}
    </p>
  );
}

export function timeLabel(t: number) {
  return formatTime(t);
}
