/** Peças do ecrã da paragem: tira do dispositivo, total sempre visível, fila de sincronização e pesagem. */

import {
  AlertTriangle,
  Bluetooth,
  Loader2,
  Printer,
  Scale,
  ScanLine,
  Trash2,
  Undo2,
  WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatKg } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import type { VehicleDevice } from './device/port';
import {
  isOverload,
  suggestPlateParts,
  totalUnitsWeightG,
  UNIT_MAX_G,
  unitWeightFromPlates,
} from './plates';
import type { StopUnit } from './session';

/** Tira do dispositivo: o que está ligado (falso em dev/testes; Bluetooth no Android da viatura). */
export function DeviceStrip({
  device,
  bluetoothSupported,
  connecting,
  onConnect,
}: {
  device: VehicleDevice | null;
  bluetoothSupported: boolean;
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
      <Scale className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">
        {device?.fingerprint ?? m.viatura_device_fake()}
      </span>
      {bluetoothSupported && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={onConnect}
          disabled={connecting}
        >
          {connecting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Bluetooth className="size-4" aria-hidden="true" />
          )}
          {m.viatura_device_connect()}
        </Button>
      )}
      <span className="basis-full text-xs text-muted-foreground">
        {m.viatura_device_needs_android()}
      </span>
    </div>
  );
}

/** O total do lote, sempre à vista: kg medidos, sacos e o que falta pesar. */
export function TotalBar({
  units,
  pending,
  syncing,
}: {
  units: StopUnit[];
  pending: number;
  syncing: boolean;
}) {
  const totalG = totalUnitsWeightG(units);
  const toWeigh = units.filter((u) => u.weightG === null).length;
  return (
    <div
      className={cn(
        'sticky top-14 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-border bg-background/95 px-4 py-3 backdrop-blur',
      )}
    >
      <span className="text-sm text-muted-foreground">{m.viatura_total()}</span>
      <span className="text-xl font-bold tabular-nums">{formatKg(totalG / 1000)}</span>
      <span className="text-sm">{m.viatura_bags({ n: units.length })}</span>
      {toWeigh > 0 && (
        <span className="text-sm text-amber-600 dark:text-amber-400">
          {m.viatura_pending_weight({ n: toWeigh })}
        </span>
      )}
      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
        {syncing && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
        {pending > 0 ? m.viatura_pending_some({ n: pending }) : m.viatura_synced_all()}
      </span>
    </div>
  );
}

/** Zona de scan: câmara primeiro («o scan manda»); a leitura manual fica sempre ao lado. */
export function ScanZone({
  onScan,
  disabled,
}: {
  onScan: (code: string) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraState, setCameraState] = useState<'idle' | 'on' | 'unsupported' | 'error'>('idle');
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (disabled) return;
    if (!('BarcodeDetector' in window)) {
      setCameraState('unsupported');
      return;
    }
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const run = async () => {
      try {
        const { startCamera } = await import('./scan');
        const video = videoRef.current;
        if (!video) return;
        stream = await startCamera(video);
        setCameraState('on');
        const DetectorCtor = (
          window as unknown as {
            BarcodeDetector?: new (options?: {
              formats?: string[];
            }) => { detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>> };
          }
        ).BarcodeDetector;
        if (!DetectorCtor) {
          setCameraState('unsupported');
          return;
        }
        const detector = new DetectorCtor({ formats: ['qr_code'] });
        timer = setInterval(async () => {
          const video = videoRef.current;
          if (!video || cancelled) return;
          try {
            const codes = await detector.detect(video);
            const code = codes[0]?.rawValue.trim();
            if (code) {
              onScan(code);
              setManual('');
            }
          } catch {
            // frame sem código legível: segue para o próximo
          }
        }, 500);
      } catch {
        if (!cancelled) setCameraState('error');
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
    };
  }, [disabled, onScan]);

  const submitManual = () => {
    const code = manual.trim();
    if (code) onScan(code);
    setManual('');
  };

  return (
    <div className="space-y-2">
      <div className="relative flex aspect-[4/3] max-h-64 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-primary/40 bg-primary/5">
        <video
          ref={videoRef}
          className={cn('size-full object-cover', cameraState !== 'on' && 'hidden')}
          muted
          playsInline
        />
        {cameraState !== 'on' && (
          <div className="flex flex-col items-center gap-2 p-4 text-center text-sm text-muted-foreground">
            <ScanLine className="size-10 text-primary" aria-hidden="true" />
            <span>
              {cameraState === 'unsupported'
                ? m.viatura_camera_unsupported()
                : cameraState === 'error'
                  ? m.viatura_camera_error()
                  : m.viatura_scan_hint()}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <label htmlFor="viatura-scan-manual" className="min-w-0 flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">{m.viatura_scan_manual_label()}</span>
          <Input
            id="viatura-scan-manual"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitManual();
            }}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            className="h-12 text-base"
            disabled={disabled}
          />
        </label>
        <Button
          type="button"
          className="h-12 min-w-24"
          onClick={submitManual}
          disabled={disabled || !manual.trim()}
        >
          {m.viatura_scan_manual_action()}
        </Button>
      </div>
    </div>
  );
}

export type WeighDraft = { parts: number[]; suggestion: number[] | null; note: string | null };

/** O pad de pesagem: leitura da balança (porta) ou manual; pratos ≤ 15 kg sugeridos e somados pela app. */
export function WeighPad({
  unit,
  device,
  onConfirm,
  onCancel,
}: {
  unit: StopUnit;
  device: VehicleDevice | null;
  onConfirm: (weightG: number) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<WeighDraft>({ parts: [], suggestion: null, note: null });
  const [manual, setManual] = useState('');
  const [reading, setReading] = useState(false);
  const total = unitWeightFromPlates(draft.parts);

  const addReading = (grams: number) => {
    if (isOverload(grams)) {
      // Sobrecarga: a app diz como carregar o prato (partes ≤ 15 kg) e soma-as no fim.
      setDraft((d) => ({
        ...d,
        suggestion: suggestPlateParts(grams),
        note: m.viatura_weigh_overload(),
      }));
      return;
    }
    setDraft((d) => ({ parts: [...d.parts, grams], suggestion: null, note: null }));
  };

  const readScale = async () => {
    if (!device) return;
    setReading(true);
    try {
      const grams = await device.weigh();
      if (grams === null) setDraft((d) => ({ ...d, note: m.viatura_weigh_no_reading() }));
      else addReading(grams);
    } finally {
      setReading(false);
    }
  };

  const submitManual = () => {
    const kg = Number.parseFloat(manual.replace(',', '.'));
    if (Number.isFinite(kg) && kg > 0) {
      addReading(Math.round(kg * 1000));
      setManual('');
    }
  };

  const canConfirm = total > 0 && total <= UNIT_MAX_G;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Scale className="size-4" aria-hidden="true" /> {m.viatura_weigh_title()}
        </h3>
        {unit.weightG !== null && (
          <span className="text-xs text-muted-foreground">
            <Undo2 className="mr-1 inline size-3" aria-hidden="true" />
            {formatKg(unit.weightG / 1000)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          className="min-h-12 flex-1"
          onClick={() => void readScale()}
          disabled={!device || reading}
        >
          {reading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Scale className="size-4" aria-hidden="true" />
          )}
          {m.viatura_weigh_read()}
        </Button>
        <label htmlFor="viatura-weigh-manual" className="min-w-0 flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">{m.viatura_weigh_manual_label()}</span>
          <Input
            id="viatura-weigh-manual"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitManual();
            }}
            inputMode="decimal"
            className="h-12 text-base"
            placeholder="0,000"
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          className="h-12"
          onClick={submitManual}
          disabled={!manual.trim()}
        >
          {m.viatura_weigh_add_part()}
        </Button>
      </div>

      {draft.parts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-areia/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{m.viatura_weigh_parts()}</span>
          {draft.parts
            .map((part, index) => ({ plate: index + 1, grams: part }))
            .map(({ plate, grams }) => (
              <span
                key={`prato-${plate}`}
                className="rounded-full bg-background px-2 py-0.5 font-mono text-xs"
              >
                {m.viatura_weigh_next_part({ n: plate })}: {formatKg(grams / 1000)}
              </span>
            ))}
          <span className="ml-auto font-bold tabular-nums">{formatKg(total / 1000)}</span>
        </div>
      )}

      {draft.suggestion && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm">
          <span className="text-muted-foreground">{m.viatura_weigh_suggest()}</span>
          {draft.suggestion
            .map((part, index) => ({ plate: index + 1, grams: part }))
            .map(({ plate, grams }) => (
              <span
                key={`sugere-${plate}`}
                className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs"
              >
                {formatKg(grams / 1000)}
              </span>
            ))}
        </div>
      )}

      {draft.note && (
        <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" /> {draft.note}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          className="min-h-12 flex-1"
          onClick={() => onConfirm(total)}
          disabled={!canConfirm}
        >
          {m.viatura_weigh_confirm()}
        </Button>
        <Button type="button" variant="ghost" className="min-h-12" onClick={onCancel}>
          {m.viatura_weigh_cancel()}
        </Button>
      </div>
    </div>
  );
}

/** Uma unidade no lote: QR do saco ou etiqueta impressa, peso (ou «por pesar») e correção direta. */
export function UnitRow({
  unit,
  onWeigh,
  onRemove,
  onReprint,
  removing,
}: {
  unit: StopUnit;
  onWeigh: () => void;
  onRemove: () => void;
  onReprint: () => void;
  removing: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const isLabel = unit.source === 'label';
  return (
    <li className="flex min-h-12 flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
      <span className="min-w-0 flex-1 truncate font-mono text-sm">
        {unit.ref.length > 20 ? `${unit.ref.slice(0, 8)}…${unit.ref.slice(-6)}` : unit.ref}
      </span>
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-medium',
          isLabel ? 'bg-areia/40' : 'bg-muted',
        )}
      >
        {isLabel ? <Printer className="mr-1 inline size-3" aria-hidden="true" /> : null}
        {isLabel
          ? unit.labelPrinted
            ? m.viatura_label_printed()
            : m.viatura_label_pending()
          : m.lot_unit_source_bag()}
      </span>
      {unit.weightG !== null ? (
        <span className="font-bold tabular-nums">{formatKg(unit.weightG / 1000)}</span>
      ) : (
        <span className="text-xs text-amber-600 dark:text-amber-400">
          {m.viatura_unit_pending()}
        </span>
      )}
      <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onWeigh}>
        <Scale className="size-4" aria-hidden="true" /> {m.viatura_unit_weigh()}
      </Button>
      {isLabel && !unit.labelPrinted && (
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onReprint}>
          <Printer className="size-4" aria-hidden="true" /> {m.viatura_unit_reprint()}
        </Button>
      )}
      {confirming ? (
        <span className="flex items-center gap-1">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="min-h-11"
            onClick={() => {
              onRemove();
              setConfirming(false);
            }}
            disabled={removing}
          >
            <Trash2 className="size-4" aria-hidden="true" /> {m.viatura_unit_remove()}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            onClick={() => setConfirming(false)}
          >
            <Undo2 className="size-4" aria-hidden="true" />
          </Button>
        </span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-11 w-11 text-muted-foreground"
          onClick={() => setConfirming(true)}
          aria-label={m.viatura_unit_remove()}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

/** A fila «à espera de sincronização»: pendências, falhadas e o gatilho manual. */
export function SyncStrip({
  pending,
  failed,
  syncing,
  lotPendingCode,
  onRetry,
}: {
  pending: number;
  failed: number;
  syncing: boolean;
  lotPendingCode: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-1 rounded-lg bg-muted/60 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        {pending > 0 ? (
          <WifiOff
            className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
        ) : (
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          {pending > 0 ? m.viatura_pending_some({ n: pending }) : m.viatura_synced_all()}
          {lotPendingCode && (
            <span className="text-muted-foreground"> · {m.viatura_lot_pending_code()}</span>
          )}
        </span>
        {syncing && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        )}
        {pending > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            onClick={onRetry}
            disabled={syncing}
          >
            {m.viatura_retry()}
          </Button>
        )}
      </div>
      {failed > 0 && (
        <p className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />{' '}
          {m.viatura_failed_some({ n: failed })}
        </p>
      )}
      {pending > 0 && <p className="text-xs text-muted-foreground">{m.viatura_pending_hint()}</p>}
    </div>
  );
}
