/** O ecrã da paragem da viatura (#58): «o scan manda» — câmara primeiro, etiqueta só sem QR, pratos ≤ 15 kg,
 * correção por saco, total sempre visível, «Cheguei» e «Partir» os únicos gestos deliberados. Sem GPS.
 *
 * Trabalha offline-first: cada gesto enfileira (IndexedDB) e despeja quando a rede volta; o dispositivo
 * (balança/impressora) entra pela porta `device/port.ts` — o falso em dev/testes, Web Bluetooth só no
 * adaptador (Android + Chrome).
 */

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ScanLine } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LocalityOut } from '@/client';
import { listLocalitiesOptions } from '@/client/@tanstack/react-query.gen';
import { Page, Section, SectionTitle } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { formatKg } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { labelZpl, openDevice, type VehicleDevice } from './device/port';
import { useStopController } from './outbox/use-stop';
import { DeviceStrip, ScanZone, SyncStrip, TotalBar, UnitRow, WeighPad } from './pieces';
import { totalUnitsWeightG } from './plates';
import type { StopLocality, UnitRef } from './session';

/** Pesos programados do balança falso para dev/e2e (`localStorage`), ex.: [2600, 2400, 2800]. */
const FAKE_WEIGHTS_KEY = 'novelo-viatura-fake-weights';
const LAST_LOCALITY_KEY = 'novelo-viatura-locality';

function readFakeProgram(): number[] | undefined {
  try {
    const raw = localStorage.getItem(FAKE_WEIGHTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return undefined;
    const weights = parsed.filter(
      (value): value is number => typeof value === 'number' && value > 0,
    );
    return weights.length > 0 ? weights : undefined;
  } catch {
    return undefined;
  }
}

function readLastLocality(): StopLocality | null {
  try {
    const raw = localStorage.getItem(LAST_LOCALITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StopLocality>;
    if (typeof parsed.id === 'string' && typeof parsed.name === 'string') {
      return { id: parsed.id, name: parsed.name, parishCode: parsed.parishCode ?? null };
    }
    return null;
  } catch {
    return null;
  }
}

const toStopLocality = (locality: LocalityOut): StopLocality => ({
  id: locality.id,
  name: locality.name,
  parishCode: locality.parish_code,
});

export function ViaturaPage() {
  const ctl = useStopController();
  const { session } = ctl;

  // A lista de localidades é a âncora do lote; offline usa o cache da query ou o local guardado.
  const localitiesQuery = useQuery({
    ...listLocalitiesOptions(),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  const localities = useMemo(
    () => (localitiesQuery.data ?? []).map(toStopLocality),
    [localitiesQuery.data],
  );

  const [remembered] = useState<StopLocality | null>(() => readLastLocality());
  const [selectedId, setSelectedId] = useState<string>('');
  const options = localities.length > 0 ? localities : remembered ? [remembered] : [];
  const selected = options.find((locality) => locality.id === selectedId) ?? options[0] ?? null;

  // O dispositivo entra pela porta: falso por omissão; Bluetooth só a pedido (adaptador importado aí).
  const [device, setDevice] = useState<VehicleDevice | null>(null);
  const [connecting, setConnecting] = useState(false);
  const bluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  useEffect(() => {
    let cancelled = false;
    void openDevice('fake', readFakeProgram()).then((fake) => {
      if (!cancelled) setDevice(fake);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const connectBluetooth = useCallback(async () => {
    setConnecting(true);
    try {
      const adapter = await openDevice('bluetooth');
      setDevice(adapter);
    } catch {
      // Sem permissão ou sem hardware: o falso continua (o operador pesa à mão).
    } finally {
      setConnecting(false);
    }
  }, []);

  // O local escolhido fica no dispositivo: é o que offline segura a âncora do lote.
  useEffect(() => {
    if (session.locality) {
      try {
        localStorage.setItem(LAST_LOCALITY_KEY, JSON.stringify(session.locality));
      } catch {
        // localStorage indisponível: segue-se sem memória (a lista da rede serve).
      }
    }
  }, [session.locality]);

  // Etiquetas disparam sozinhas: saco registado sem QR → impressora (falsa ou BLE) logo a seguir.
  const printedRef = useRef(new Set<string>());
  useEffect(() => {
    if (!device) return;
    const pending = session.units.filter(
      (unit) => unit.source === 'label' && !unit.labelPrinted && !printedRef.current.has(unit.ref),
    );
    if (pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const unit of pending) {
        printedRef.current.add(unit.ref);
        const caption = session.locality?.name ?? 'NOVELO';
        const ok = await device.printLabel({
          code: unit.ref,
          caption,
          zpl: labelZpl(unit.ref, caption),
        });
        if (cancelled) return;
        if (ok) ctl.markPrintedRef(unit.ref);
        else printedRef.current.delete(unit.ref);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [device, session.units, session.locality, ctl]);

  // O mesmo QR não entra duas vezes (a API recusaria; no ecrã nem se enfileira).
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const handleScan = useCallback(
    (code: string) => {
      const now = Date.now();
      if (
        lastScanRef.current &&
        lastScanRef.current.code === code &&
        now - lastScanRef.current.at < 3_000
      )
        return;
      lastScanRef.current = { code, at: now };
      if (session.units.some((unit) => unit.ref === code)) return;
      ctl.recordUnit(code, 'bag');
    },
    [ctl, session.units],
  );

  const registerBagWithoutQr = useCallback(() => {
    // Saco sem QR: o dispositivo gera o UUID da etiqueta (o QR do papel reconcilia offline pelo código).
    const code =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-label-${Math.random().toString(36).slice(2, 10)}`;
    ctl.recordUnit(code, 'label');
  }, [ctl]);

  const weighed = session.units.every((unit) => unit.weightG !== null);
  const total = totalUnitsWeightG(session.units);
  const canDepart = session.status === 'open' && session.units.length > 0 && weighed;

  const [weighing, setWeighing] = useState<UnitRef | null>(null);
  const weighingUnit = session.units.find((unit) => unit.ref === weighing) ?? null;

  // ---------- «Partir»: fecha a paragem (único gesto deliberado, offline incluído) ----------
  if (session.status === 'departed') {
    return (
      <Page>
        <PageHeader
          eyebrow={m.nav_viatura()}
          title={m.viatura_departed_title()}
          description={m.viatura_departed_hint()}
        />
        <Section title={m.viatura_departed_title()}>
          <div className="space-y-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <p className="text-lg font-semibold">
              {session.lotCode ?? m.viatura_lot_pending_code()} · {formatKg(total / 1000)} ·{' '}
              {m.viatura_bags({ n: session.units.length })}
            </p>
            <SyncStrip
              pending={ctl.pending}
              failed={ctl.failedCount}
              syncing={ctl.syncing}
              lotPendingCode={session.lotCode === null}
              onRetry={() => void ctl.flush()}
            />
            <div className="flex flex-wrap gap-2">
              {session.lotCode && (
                <Button asChild>
                  <a href={`/passport/${session.lotCode}`} target="_blank" rel="noreferrer">
                    {m.viatura_passport_link()}
                  </a>
                </Button>
              )}
              <Button variant="outline" onClick={ctl.newStop}>
                {m.viatura_new_stop()}
              </Button>
            </div>
          </div>
        </Section>
      </Page>
    );
  }

  // ---------- A caminho: escolher o local e «Cheguei» ----------
  if (session.status === 'idle') {
    return (
      <Page>
        <PageHeader
          eyebrow={m.nav_viatura()}
          title={m.viatura_title()}
          description={m.viatura_description()}
        />
        <Section title={m.viatura_locality_label()}>
          <div className="space-y-4">
            <label className="space-y-1">
              <span className="text-sm font-medium">{m.viatura_locality_label()}</span>
              <select
                value={selected?.id ?? ''}
                onChange={(event) => setSelectedId(event.target.value)}
                className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
              >
                {options.length === 0 && <option value="">{m.viatura_locality_empty()}</option>}
                {options.map((locality) => (
                  <option key={locality.id} value={locality.id}>
                    {locality.name}
                  </option>
                ))}
              </select>
            </label>
            {localitiesQuery.isError && (
              <p className="text-sm text-muted-foreground">{m.viatura_locality_empty()}</p>
            )}
            <Button
              type="button"
              size="lg"
              className="min-h-14 w-full text-base font-semibold"
              disabled={!selected}
              onClick={() => {
                if (!selected) return;
                ctl.pickLocality(selected);
                ctl.arrive(selected.parishCode);
              }}
            >
              <ScanLine className="size-5" aria-hidden="true" /> {m.viatura_arrive()}
            </Button>
            <p className="text-sm text-muted-foreground">{m.viatura_arrive_hint()}</p>
            <DeviceStrip
              device={device}
              bluetoothSupported={bluetoothSupported}
              connecting={connecting}
              onConnect={() => void connectBluetooth()}
            />
            <p className="text-xs text-muted-foreground">{m.viatura_help_android()}</p>
            <SyncStrip
              pending={ctl.pending}
              failed={ctl.failedCount}
              syncing={ctl.syncing}
              lotPendingCode={false}
              onRetry={() => void ctl.flush()}
            />
          </div>
        </Section>
      </Page>
    );
  }

  // ---------- Paragem aberta: scan primeiro, lote à vista, pesar, «Partir» ----------
  return (
    <Page>
      <PageHeader
        eyebrow={m.nav_viatura()}
        title={session.locality?.name ?? m.viatura_title()}
        description={
          session.lotCode
            ? `${m.viatura_total()}: ${formatKg(total / 1000)}`
            : m.viatura_lot_pending_code()
        }
      />
      <TotalBar units={session.units} pending={ctl.pending} syncing={ctl.syncing} />
      <Section title={m.viatura_scan_title()}>
        <div className="space-y-4">
          <SectionTitle>{m.viatura_scan_title()}</SectionTitle>
          <ScanZone onScan={handleScan} disabled={false} />
          <div className="space-y-1">
            <Button
              type="button"
              variant="outline"
              className="min-h-12 w-full"
              onClick={registerBagWithoutQr}
            >
              {m.viatura_no_qr_action()}
            </Button>
            <p className="text-xs text-muted-foreground">{m.viatura_no_qr_hint()}</p>
          </div>

          {session.units.length === 0 ? (
            <p className="rounded-lg bg-muted/60 px-3 py-3 text-sm text-muted-foreground">
              {m.viatura_no_lots_yet()}
            </p>
          ) : (
            <section className="space-y-2">
              <SectionTitle>
                {m.viatura_bags({ n: session.units.length })} · {formatKg(total / 1000)}
              </SectionTitle>
              <ul className="space-y-2">
                {session.units.map((unit) => (
                  <UnitRow
                    key={unit.ref}
                    unit={unit}
                    removing={false}
                    onWeigh={() => setWeighing(unit.ref)}
                    onRemove={() => ctl.removeUnitOp(unit.ref)}
                    onReprint={() => ctl.markPrintedRef(unit.ref)}
                  />
                ))}
              </ul>
            </section>
          )}

          {weighingUnit && (
            <WeighPad
              unit={weighingUnit}
              device={device}
              onConfirm={(weightG) => {
                ctl.confirmWeight(weighingUnit.ref, weightG);
                setWeighing(null);
              }}
              onCancel={() => setWeighing(null)}
            />
          )}

          <SyncStrip
            pending={ctl.pending}
            failed={ctl.failedCount}
            syncing={ctl.syncing}
            lotPendingCode={session.lotCode === null}
            onRetry={() => void ctl.flush()}
          />
        </div>
      </Section>

      {/* O segundo gesto deliberado: «Partir». Desativado com sacos por pesar (a API também recusa). */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-1">
          <Button
            type="button"
            size="lg"
            className="min-h-14 w-full text-base font-semibold"
            disabled={!canDepart}
            onClick={ctl.departOp}
          >
            {m.viatura_depart()} — {formatKg(total / 1000)} ·{' '}
            {m.viatura_bags({ n: session.units.length })}
            <ArrowRight className="size-5" aria-hidden="true" />
          </Button>
          {!canDepart && (
            <p className="text-center text-xs text-muted-foreground">
              {m.viatura_depart_blocked()}
            </p>
          )}
        </div>
      </div>
    </Page>
  );
}
