// PROTOTIPO (#50) — VARIANTE C «O scan manda»: camara sempre ativa, automacao maxima.
// Aposta: o condutor aponta e escaneia; etiquetas disparam sozinhas quando nao ha QR;
// a balança diz como carregar o prato (grupos automaticos <= 15 kg); o unico gesto
// deliberado e partir. Corrigir e excecao («desfazer»). DESCARTAVEL.
import { ArrowRight, Printer, Scale, ScanLine, Undo2, X } from 'lucide-react';
import { useEffect, useReducer } from 'react';
import { cn } from '@/lib/utils';
import {
  autoPlates,
  formatKg,
  labelBags,
  reducer,
  type SimState,
  totalG,
  uncoveredBags,
} from './model';
import {
  BagIcon,
  BigButton,
  EventLine,
  PhoneFrame,
  Pill,
  StopHeader,
  SyncPanel,
  SyncPill,
  WorldPanel,
} from './pieces';

export function VariantC({ initial }: { initial: SimState }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const rec = state.record;

  // A aposta da variante: a etiqueta dispara SOZINHA logo apos o scan de um saco sem QR.
  useEffect(() => {
    if (!rec) return;
    const pending = labelBags(rec).filter((b) => !b.labelPrintedAt);
    if (pending.length === 0) return;
    const t = setTimeout(() => {
      for (const b of pending) dispatch({ type: 'print-label', bagId: b.id });
    }, 700);
    return () => clearTimeout(t);
  }, [rec]);

  const stop = state.route[state.cursor];
  const labels = rec ? labelBags(rec) : [];
  const uncovered = rec ? uncoveredBags(rec) : [];
  const remaining = rec && stop ? stop.encounters.length - rec.consumed : 0;
  const plates = rec ? autoPlates(rec) : [];
  const uncoveredPlates = plates.filter(
    (ids) => !rec?.weighings.some((w) => sameSet(w.bagIds, ids)),
  );

  return (
    <PhoneFrame>
      <div className="space-y-4 px-4 pt-5">
        <StopHeader state={state} compact />

        <EventLine state={state} />

        {/* CÂMARA: o ecrã abre aqui */}
        {rec && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'scan' })}
            disabled={remaining <= 0}
            className={cn(
              'relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2',
              remaining > 0
                ? 'border-primary/60 bg-primary/5 active:scale-[0.99]'
                : 'border-border bg-muted/40',
            )}
          >
            <ScanLine
              className={cn('size-12', remaining > 0 ? 'text-primary' : 'text-muted-foreground')}
              aria-hidden="true"
            />
            {remaining > 0 ? (
              <>
                <span className="text-lg font-semibold">Escanear — {remaining} à vista</span>
                <span className="text-sm text-muted-foreground">
                  toca no ecrã quando apontares ao saco
                </span>
              </>
            ) : (
              <span className="font-medium text-muted-foreground">
                Tudo à vista — {rec.bags.length} saco{rec.bags.length > 1 ? 's' : ''} no lote
              </span>
            )}
            {/* cantos da mira */}
            <span
              className="absolute top-3 left-3 size-6 border-t-4 border-l-4 rounded-tl-lg border-primary/70"
              aria-hidden="true"
            />
            <span
              className="absolute top-3 right-3 size-6 border-t-4 border-r-4 rounded-tr-lg border-primary/70"
              aria-hidden="true"
            />
            <span
              className="absolute bottom-3 left-3 size-6 border-b-4 border-l-4 rounded-bl-lg border-primary/70"
              aria-hidden="true"
            />
            <span
              className="absolute right-3 bottom-3 size-6 border-r-4 border-b-4 rounded-br-lg border-primary/70"
              aria-hidden="true"
            />
          </button>
        )}

        {/* BANDEJA: sacos + etiquetas automaticas */}
        {rec && rec.bags.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                No lote
              </h3>
              <span className="text-sm">
                {formatKg(totalG(rec))}{' '}
                {rec.weighings.length > 0 && <Pill tone="brand">medido</Pill>}
              </span>
            </div>
            <ul className="space-y-1.5">
              {rec.bags.map((b) => (
                <li
                  key={b.id}
                  className="flex min-h-12 items-center gap-2 rounded-lg border border-border px-3"
                >
                  <BagIcon kind={b.kind} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.title}</span>
                  {b.kind === 'qr' ? (
                    <Pill>QR</Pill>
                  ) : b.labelPrintedAt ? (
                    <Pill tone="good">
                      <Printer className="size-3" aria-hidden="true" /> {b.id.toUpperCase()}
                    </Pill>
                  ) : (
                    <Pill tone="warn">a imprimir…</Pill>
                  )}
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'drop-bag', bagId: b.id })}
                    className="flex min-h-11 w-11 items-center justify-center text-muted-foreground"
                    aria-label={`Remover ${b.title}`}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {/* etiqueta dispara sozinha apos o scan (ver useEffect acima) */}
            <button
              type="button"
              onClick={() => {
                const last = rec.bags[rec.bags.length - 1];
                if (!last) return;
                const lastWeighing = rec.weighings.find((w) => w.bagIds.includes(last.id));
                if (lastWeighing) dispatch({ type: 'unweigh', weighingId: lastWeighing.id });
                dispatch({ type: 'drop-bag', bagId: last.id });
              }}
              className="flex min-h-11 w-full items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <Undo2 className="size-4" aria-hidden="true" /> desfazer o último scan
            </button>
          </section>
        )}

        {/* BALANÇA COM PRATOS AUTOMÁTICOS: só quando o scan acabou */}
        {rec && remaining === 0 && rec.bags.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Balança
              </h3>
              <Pill>
                {uncovered.length} saco{uncovered.length === 1 ? '' : 's'} por pesar
              </Pill>
            </div>
            {uncoveredPlates.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-areia/30 px-3 py-3">
                <Scale className="size-5" aria-hidden="true" />
                <span className="text-sm">Pesagem completa</span>
                <span className="ml-auto text-lg font-bold">{formatKg(totalG(rec))}</span>
                <Pill tone="brand">medido</Pill>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  A app diz como carregar o prato — {uncoveredPlates.length} leitura
                  {uncoveredPlates.length > 1 ? 's' : ''} em falta:
                </p>
                <ul className="space-y-1.5">
                  {uncoveredPlates.map((ids, i) => (
                    <li
                      key={ids.join('+')}
                      className="flex min-h-12 items-center gap-2 rounded-lg border border-dashed border-border px-3 text-sm"
                    >
                      <span className="text-muted-foreground">
                        Prato {rec.weighings.length + i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {ids
                          .map((id) => rec.bags.find((b) => b.id === id)?.title ?? id)
                          .join(' + ')}
                      </span>
                    </li>
                  ))}
                </ul>
                <BigButton
                  tone="secondary"
                  onClick={() => dispatch({ type: 'weigh', bagIds: uncoveredPlates[0] ?? [] })}
                >
                  <Scale className="size-5" /> Pesar prato {rec.weighings.length + 1} (
                  {uncoveredPlates[0]?.length ?? 0} saco
                  {(uncoveredPlates[0]?.length ?? 0) > 1 ? 's' : ''})
                </BigButton>
                {rec.weighings.length > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-areia/30 px-3 py-2.5">
                    <span className="text-sm">Soma até agora</span>
                    <span className="ml-auto text-lg font-bold">{formatKg(totalG(rec))}</span>
                    <Pill tone="brand">medido</Pill>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {!rec && stop && (
          <section className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {stop.site} — {stop.detail}
            </p>
            <BigButton onClick={() => dispatch({ type: 'open-stop' })}>
              Cheguei — abrir paragem {state.cursor + 1}/{state.route.length}
            </BigButton>
          </section>
        )}

        {!stop && (
          <section className="space-y-2">
            <h3 className="text-lg font-semibold">Rota concluída</h3>
            <p className="text-sm text-muted-foreground">De volta ao depósito.</p>
          </section>
        )}

        <SyncPanel state={state} />
        <WorldPanel
          state={state}
          onReset={(s) => dispatch({ type: 'reset', scenario: s })}
          onToggleOnline={(online) => dispatch({ type: 'set-online', online })}
        />
      </div>

      {/* O unico gesto deliberado: partir */}
      {rec && remaining === 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mt-4 sm:rounded-xl sm:border">
          <div className="mx-auto flex max-w-md flex-col gap-1">
            <BigButton onClick={() => dispatch({ type: 'close-stop' })}>
              Partir — {formatKg(totalG(rec))} · {rec.bags.length} saco
              {rec.bags.length > 1 ? 's' : ''}
              {labels.length > 0
                ? ` · ${labels.length} etiqueta${labels.length > 1 ? 's' : ''}`
                : ''}
              <ArrowRight className="size-5" />
            </BigButton>
            <p className="text-center text-xs text-muted-foreground">
              {uncovered.length > 0 ? `${uncovered.length} saco(s) ficam sem pesar — ` : ''}
              registo <SyncPill sync={state.online ? 'synced' : 'pending'} />
            </p>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}
