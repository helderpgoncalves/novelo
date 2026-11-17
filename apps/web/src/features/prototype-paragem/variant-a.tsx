// PROTOTIPO (#50) — VARIANTE A «Passo a passo»: um gesto de cada vez, botao gigante por passo.
// Aposta: o condutor so decide uma coisa de cada vez; passos condicionais (etiquetas so
// quando ha sacos sem QR; pesagem saltada quando nao ha sacos). DESCARTAVEL.
import { ArrowRight, Printer, Scale, ScanLine } from 'lucide-react';
import type * as React from 'react';
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

type Step = 'chegada' | 'sacos' | 'pesagem' | 'etiquetas' | 'fechar';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'chegada', label: 'Chegada' },
  { id: 'sacos', label: 'Sacos' },
  { id: 'pesagem', label: 'Pesagem' },
  { id: 'etiquetas', label: 'Etiquetas' },
  { id: 'fechar', label: 'Partir' },
];

export function VariantA({ initial }: { initial: SimState }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [step, setStep] = useState<Step>('chegada');
  const [plate, setPlate] = useState<string[]>([]);

  const rec = state.record;
  const stop = state.route[state.cursor];
  const labels = rec ? labelBags(rec) : [];
  const uncovered = rec ? uncoveredBags(rec) : [];

  function go(next: Step) {
    setStep(next);
    setPlate([]);
  }

  /** Passa à frente os passos que não se aplicam (sem sacos -> sem pesagem; sem etiquetas). */
  function advance(): void {
    if (!rec) {
      go('sacos');
      return;
    }
    if (step === 'chegada') go('sacos');
    else if (step === 'sacos') go(rec.bags.length === 0 ? 'fechar' : 'pesagem');
    else if (step === 'pesagem') go(labels.length > 0 ? 'etiquetas' : 'fechar');
    else go('fechar');
  }

  const visibleSteps = STEPS.filter((s) => s.id !== 'etiquetas' || labels.length > 0);
  const currentIdx = STEPS.findIndex((x) => x.id === step);

  return (
    <PhoneFrame>
      <div className="space-y-4 px-4 pt-5">
        <StopHeader state={state} compact />
        {rec && <StateStrip state={state} />}

        {rec && (
          <ol className="flex gap-1">
            {visibleSteps.map((s) => {
              const idx = STEPS.findIndex((x) => x.id === s.id);
              const reachable = idx <= currentIdx;
              return (
                <li key={s.id} className="flex-1">
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => reachable && go(s.id)}
                    className={cn(
                      'w-full rounded-md py-2 text-xs font-medium',
                      s.id === step
                        ? 'bg-primary text-primary-foreground'
                        : reachable
                          ? 'bg-muted text-foreground'
                          : 'bg-muted/40 text-muted-foreground',
                    )}
                  >
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        <EventLine state={state} />

        {step === 'chegada' &&
          (rec ? (
            <Section
              title="Paragem aberta"
              lead={`${rec.site} · ${KIND_LABEL[rec.kind]}. Scan primeiro, pesar depois.`}
            >
              <BigButton onClick={() => go('sacos')}>
                <ScanLine className="size-5" /> Escanear sacos
              </BigButton>
            </Section>
          ) : stop ? (
            <Section
              title={`Paragem ${state.cursor + 1} de ${state.route.length}`}
              lead={`${stop.site} — ${stop.detail}. Abrir o lote ao chegar.`}
            >
              <BigButton
                onClick={() => {
                  dispatch({ type: 'open-stop' });
                  go('sacos');
                }}
              >
                Cheguei — abrir paragem
              </BigButton>
              <p className="text-center text-xs text-muted-foreground">
                (a navegação até ao local fica fora do protótipo)
              </p>
            </Section>
          ) : (
            <Section
              title="Rota concluída"
              lead="Todas as paragens fechadas. De volta ao depósito (Rua das Lameiras, Polvoreira)."
            >
              <SyncPanel state={state} />
            </Section>
          ))}

        {step === 'sacos' && rec && (
          <Section
            title="O que está à vista?"
            lead="Cada scan liga o saco ao lote. Saco com QR não leva etiqueta."
          >
            <div className="space-y-2">
              {rec.bags.map((b) => (
                <div
                  key={b.id}
                  className="flex min-h-12 items-center gap-2 rounded-lg border border-border px-3"
                >
                  <BagIcon kind={b.kind} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.title}</span>
                  {b.labelPrintedAt && <Pill tone="good">etiqueta</Pill>}
                  {b.kind === 'account' && <Pill tone="brand">crédito</Pill>}
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'drop-bag', bagId: b.id })}
                    className="min-h-11 px-2 text-sm text-muted-foreground"
                    aria-label={`Remover ${b.title}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <RemainingHint state={state} />
            <BigButton
              onClick={() => dispatch({ type: 'scan' })}
              disabled={rec.consumed >= (stop?.encounters.length ?? 0)}
            >
              <ScanLine className="size-5" /> Escanear próximo
            </BigButton>
            <BigButton tone="secondary" className="mt-2" onClick={advance}>
              {rec.bags.length === 0 ? 'Sem sacos hoje' : 'Pesagem'}
              <ArrowRight className="size-5" />
            </BigButton>
          </Section>
        )}

        {step === 'pesagem' && rec && (
          <Section
            title="Pesagem"
            lead={
              rec.kind === 'pedido'
                ? 'A pedido 1:1: o lote é este saco — o peso fica no saco.'
                : 'Cabe tudo na balança? Uma leitura. Não cabe? Pesa em partes, o lote fica com a soma.'
            }
          >
            <div className="flex flex-wrap gap-2">
              {rec.bags.map((b) => {
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
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    {b.title}
                  </button>
                );
              })}
            </div>
            <BigButton
              onClick={() => dispatch({ type: 'weigh', bagIds: plate })}
              disabled={plate.length === 0}
            >
              <Scale className="size-5" /> Ler peso ({plate.length} no prato)
            </BigButton>
            {state.lastWeigh && !state.lastWeigh.ok && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Sobrecarga: {formatKg(state.lastWeigh.readingG)} &gt; 15 kg. Tira sacos do prato e
                repete.
              </p>
            )}
            <div className="space-y-1.5">
              {rec.weighings.map((w, i) => (
                <div
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
                    className="min-h-11 px-1 text-muted-foreground"
                    aria-label={`Remover pesagem ${i + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {rec.weighings.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-areia/30 px-3 py-2.5">
                  <span className="text-sm">Total do lote</span>
                  <span className="ml-auto text-lg font-bold">{formatKg(totalG(rec))}</span>
                  <Pill tone="brand">medido</Pill>
                </div>
              )}
            </div>
            <BigButton className="mt-2" onClick={advance}>
              {labels.length > 0 ? 'Etiquetas' : 'Fechar e partir'}
              <ArrowRight className="size-5" />
            </BigButton>
          </Section>
        )}

        {step === 'etiquetas' && rec && labels.length > 0 && (
          <Section
            title="Etiquetas"
            lead="Só os sacos sem QR da plataforma levam etiqueta impressa (UUID próprio)."
          >
            <div className="space-y-2">
              {labels.map((b) =>
                b.labelPrintedAt ? (
                  <LabelPreview key={b.id} code={b.id} caption={`${b.title} — impressa`} />
                ) : (
                  <div
                    key={b.id}
                    className="flex min-h-12 items-center gap-2 rounded-lg border border-dashed border-border px-3 text-sm"
                  >
                    <BagIcon kind={b.kind} />
                    <span className="flex-1 font-medium">{b.title}</span>
                    <Pill tone="warn">sem etiqueta</Pill>
                  </div>
                ),
              )}
            </div>
            {labels.some((b) => !b.labelPrintedAt) && (
              <BigButton
                onClick={() => {
                  for (const b of labels) {
                    if (!b.labelPrintedAt) dispatch({ type: 'print-label', bagId: b.id });
                  }
                }}
              >
                <Printer className="size-5" /> Imprimir todas as etiquetas
              </BigButton>
            )}
            <BigButton tone="ghost" className="mt-2" onClick={() => go('fechar')}>
              Fechar e partir <ArrowRight className="size-5" />
            </BigButton>
          </Section>
        )}

        {step === 'fechar' && rec && (
          <Section
            title="Fechar a paragem"
            lead={
              uncovered.length > 0
                ? `${uncovered.length} saco(s) sem pesar — confirma mesmo assim?`
                : 'Resumo do lote antes de partir.'
            }
          >
            <div className="space-y-2 rounded-xl border border-border p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Lote</span>
                <span className="font-mono font-semibold">{rec.code}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sacos</span>
                <span className="font-semibold">
                  {rec.bags.length} ({labels.length} com etiqueta)
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Peso</span>
                <span className="flex items-center gap-2 font-bold">
                  {formatKg(totalG(rec))} <Pill tone="brand">medido</Pill>
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Registo</span>
                <SyncPill sync={state.online ? 'synced' : 'pending'} />
              </div>
            </div>
            <BigButton
              onClick={() => {
                dispatch({ type: 'close-stop' });
                setStep('chegada');
              }}
            >
              Fechar paragem e partir <ArrowRight className="size-5" />
            </BigButton>
          </Section>
        )}

        {!rec && step !== 'chegada' && (
          <Section title="Paragem fechada" lead="O registo saiu — continua a rota.">
            <SyncPanel state={state} />
          </Section>
        )}

        <WorldPanel
          state={state}
          onReset={(s) => {
            dispatch({ type: 'reset', scenario: s });
            setStep('chegada');
            setPlate([]);
          }}
          onToggleOnline={(online) => dispatch({ type: 'set-online', online })}
        />
      </div>
    </PhoneFrame>
  );
}

function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        {lead && <p className="text-sm text-muted-foreground">{lead}</p>}
      </div>
      {children}
    </section>
  );
}
