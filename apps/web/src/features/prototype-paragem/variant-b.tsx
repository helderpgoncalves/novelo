// PROTOTIPO (#50) — VARIANTE B «Tudo a vista»: a paragem inteira num so scroll.
// Aposta: nada escondido em passos; correcoes diretas (remover saco, remover pesagem,
// imprimir etiqueta no proprio saco); fechar fica numa barra fixa. DESCARTAVEL.
import { ArrowRight, Printer, Scale, ScanLine, X } from 'lucide-react';
import { useReducer, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatKg, labelBags, reducer, type SimState, totalG, uncoveredBags } from './model';
import {
  BagIcon,
  BigButton,
  EventLine,
  KIND_LABEL,
  LabelPreview,
  PhoneFrame,
  Pill,
  RemainingHint,
  StateStrip,
  StopHeader,
  SyncPanel,
  SyncPill,
  WorldPanel,
} from './pieces';

export function VariantB({ initial }: { initial: SimState }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [plate, setPlate] = useState<string[]>([]);

  const rec = state.record;
  const stop = state.route[state.cursor];
  const labels = rec ? labelBags(rec) : [];
  const uncovered = rec ? uncoveredBags(rec) : [];
  const remaining = rec && stop ? stop.encounters.length - rec.consumed : 0;

  return (
    <PhoneFrame>
      <div className="space-y-5 px-4 pt-5">
        <StopHeader state={state} />
        <EventLine state={state} />

        {!rec && stop && (
          <section className="space-y-3 rounded-xl border border-border p-4">
            <p className="text-sm text-muted-foreground">
              {stop.site} — {stop.detail}
            </p>
            <BigButton onClick={() => dispatch({ type: 'open-stop' })}>
              Cheguei — abrir paragem {state.cursor + 1}/{state.route.length}
            </BigButton>
          </section>
        )}

        {rec && (
          <>
            <StateStrip state={state} />

            {/* SACOS: scan + lista com correcao e etiqueta inline */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Sacos
                </h3>
                <RemainingHint state={state} />
              </div>
              <BigButton
                tone="secondary"
                onClick={() => dispatch({ type: 'scan' })}
                disabled={remaining <= 0}
              >
                <ScanLine className="size-5" /> Escanear próximo
              </BigButton>
              <ul className="space-y-1.5">
                {rec.bags.map((b) => (
                  <li
                    key={b.id}
                    className="flex min-h-14 items-center gap-2 rounded-lg border border-border px-3"
                  >
                    <BagIcon kind={b.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.kind === 'qr'
                          ? 'QR de saco — sem etiqueta'
                          : b.kind === 'account'
                            ? 'QR de conta — crédito nesta pesagem'
                            : 'sem QR — etiqueta obrigatória'}
                        {b.bagWeightG ? ` · ${formatKg(b.bagWeightG)} no saco` : ''}
                      </p>
                    </div>
                    {b.kind !== 'qr' &&
                      (b.labelPrintedAt ? (
                        <Pill tone="good">etiqueta</Pill>
                      ) : (
                        <button
                          type="button"
                          onClick={() => dispatch({ type: 'print-label', bagId: b.id })}
                          className="flex min-h-11 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium"
                        >
                          <Printer className="size-4" aria-hidden="true" /> etiqueta
                        </button>
                      ))}
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
                {rec.bags.length === 0 && (
                  <li className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                    Ainda sem sacos.
                  </li>
                )}
              </ul>
            </section>

            {/* BALANCA: prato, leituras, soma */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Balança
                </h3>
                <Pill>{uncovered.length} sem pesar</Pill>
              </div>
              {rec.bags.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {uncovered.map((b) => {
                      const on = plate.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() =>
                            setPlate(on ? plate.filter((x) => x !== b.id) : [...plate, b.id])
                          }
                          className={cn(
                            'min-h-11 rounded-full border px-3 text-sm font-medium',
                            on
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border',
                          )}
                        >
                          {b.title}
                        </button>
                      );
                    })}
                    {uncovered.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Todos os sacos já entraram numa pesagem.
                      </p>
                    )}
                  </div>
                  <BigButton
                    tone="secondary"
                    onClick={() => dispatch({ type: 'weigh', bagIds: plate })}
                    disabled={plate.length === 0}
                  >
                    <Scale className="size-5" /> Ler peso ({plate.length} no prato)
                  </BigButton>
                  {state.lastWeigh && !state.lastWeigh.ok && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      Sobrecarga: {formatKg(state.lastWeigh.readingG)} &gt; 15 kg — pese em partes.
                    </p>
                  )}
                  <ul className="space-y-1.5">
                    {rec.weighings.map((w, i) => (
                      <li
                        key={w.id}
                        className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm"
                      >
                        <span className="text-muted-foreground">Pesagem {i + 1}</span>
                        <span>
                          {w.bagIds.length} saco{w.bagIds.length > 1 ? 's' : ''}
                        </span>
                        <span className="ml-auto font-semibold">{formatKg(w.readingG)}</span>
                        <button
                          type="button"
                          onClick={() => dispatch({ type: 'unweigh', weighingId: w.id })}
                          className="flex min-h-11 w-11 items-center justify-center text-muted-foreground"
                          aria-label={`Remover pesagem ${i + 1}`}
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 rounded-lg bg-areia/30 px-3 py-2.5">
                    <span className="text-sm">Total do lote</span>
                    <span className="ml-auto text-lg font-bold">{formatKg(totalG(rec))}</span>
                    <Pill tone="brand">medido</Pill>
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {/* ETIQUETAS IMPRESSAS (previa) */}
        {rec && labels.some((b) => b.labelPrintedAt) && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Etiquetas impressas
            </h3>
            {labels
              .filter((b) => b.labelPrintedAt)
              .map((b) => (
                <LabelPreview key={b.id} code={b.id} caption={b.title} />
              ))}
          </section>
        )}

        {!stop && (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold">Rota concluída</h3>
            <p className="text-sm text-muted-foreground">
              Todas as paragens fechadas. De volta ao depósito.
            </p>
          </section>
        )}

        <SyncPanel state={state} />
        <WorldPanel
          state={state}
          onReset={(s) => {
            dispatch({ type: 'reset', scenario: s });
            setPlate([]);
          }}
          onToggleOnline={(online) => dispatch({ type: 'set-online', online })}
        />
      </div>

      {/* barra fixa: fechar e partir */}
      {rec && (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mt-4 sm:rounded-xl sm:border">
          <div className="mx-auto flex max-w-md flex-col gap-1">
            <BigButton
              onClick={() => dispatch({ type: 'close-stop' })}
              tone={uncovered.length > 0 ? 'secondary' : 'primary'}
            >
              {uncovered.length > 0
                ? `Fechar com ${uncovered.length} saco(s) sem pesar`
                : `Fechar paragem · ${formatKg(totalG(rec))} · ${rec.bags.length} sacos`}
              <ArrowRight className="size-5" />
            </BigButton>
            <p className="text-center text-xs text-muted-foreground">
              {KIND_LABEL[rec.kind]} · registo{' '}
              {state.online ? 'sincroniza já' : 'fica no dispositivo'}{' '}
              <SyncPill sync={state.online ? 'synced' : 'pending'} />
            </p>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}
