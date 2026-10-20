import { Minus, Plus } from 'lucide-react';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { m } from '@/paraglide/messages';
import { HelpHint } from './help-hint';

interface NumericControlProps {
  label: string;
  help?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  /** Passo do stepper e do slider. */
  step: number;
  /** Limites do slider (o campo aceita qualquer valor positivo acima do mínimo do campo). */
  sliderMin: number;
  sliderMax: number;
  min: number;
  max?: number;
  /** Marca de referência no slider (ex.: o que se captou em 2025). */
  marker?: { value: number; label: string };
  formatBound: (value: number) => string;
  hint?: ReactNode;
  error?: string;
}

const display = (v: number) =>
  Number.isFinite(v) ? new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(v) : '';

const parse = (raw: string): number => {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  return cleaned === '' ? Number.NaN : Number(cleaned);
};

/**
 * Valor numérico de alto nível: campo editável com unidade, stepper de 40 px e slider.
 * O campo mantém o texto enquanto se escreve e só normaliza ao sair.
 */
export function NumericControl({
  label,
  help,
  value,
  onChange,
  unit,
  step,
  sliderMin,
  sliderMax,
  min,
  max,
  marker,
  formatBound,
  hint,
  error,
}: NumericControlProps) {
  const id = useId();
  const [text, setText] = useState(display(value));
  const [focused, setFocused] = useState(false);

  // Segue alterações vindas de fora (slider, stepper) quando o campo não está a ser editado.
  useEffect(() => {
    if (!focused) setText(display(value));
  }, [value, focused]);

  const clamp = (v: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, v));
  const nudge = (dir: 1 | -1) => {
    const base = Number.isFinite(value) ? value : min;
    const next = clamp(Math.round((base + dir * step) / step) * step);
    onChange(next);
    setText(display(next));
  };
  const atMin = Number.isFinite(value) && value <= min;
  const atMax = max != null && Number.isFinite(value) && value >= max;
  const sliderValue = Math.min(sliderMax, Math.max(sliderMin, Number.isFinite(value) ? value : 0));
  const markerPct = marker
    ? Math.min(100, Math.max(0, ((marker.value - sliderMin) / (sliderMax - sliderMin)) * 100))
    : null;

  const stepperButton =
    'grid size-10 shrink-0 place-items-center rounded-lg border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40';

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {help && <HelpHint label={label}>{help}</HelpHint>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={stepperButton}
          aria-label={m.simx_decrease({ label })}
          disabled={atMin}
          onClick={() => nudge(-1)}
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <div className="relative min-w-0 flex-1">
          <Input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            className="h-10 pr-16 text-right font-medium tabular-nums"
            onFocus={(e) => {
              setFocused(true);
              // Ao editar, mostra o número sem separadores de milhares.
              setText(Number.isFinite(value) ? String(value).replace('.', ',') : '');
              e.currentTarget.select();
            }}
            onBlur={() => {
              setFocused(false);
              const parsed = parse(text);
              if (Number.isFinite(parsed)) {
                const next = clamp(parsed);
                onChange(next);
                setText(display(next));
              } else {
                setText(display(value));
              }
            }}
            onChange={(e) => {
              setText(e.target.value);
              const parsed = parse(e.target.value);
              onChange(parsed);
            }}
          />
          <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 text-muted-foreground text-xs">
            {unit}
          </span>
        </div>
        <button
          type="button"
          className={stepperButton}
          aria-label={m.simx_increase({ label })}
          disabled={atMax}
          onClick={() => nudge(1)}
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="px-1">
        <div className="relative">
          <Slider
            value={[sliderValue]}
            min={sliderMin}
            max={sliderMax}
            step={step}
            className="h-9"
            onValueChange={([v]) => {
              onChange(v ?? sliderMin);
              setText(display(v ?? sliderMin));
            }}
            aria-label={label}
          />
          {markerPct != null && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 flex h-9 -translate-x-1/2 flex-col items-center justify-between"
              style={{ left: `${markerPct}%` }}
            >
              <span className="rounded bg-areia/30 px-1 font-semibold text-[10px] text-foreground/80 leading-4">
                {marker?.label}
              </span>
              <span className="h-2 w-px bg-areia" />
            </span>
          )}
        </div>
        <div className="flex justify-between text-muted-foreground text-xs tabular-nums">
          <span>{formatBound(sliderMin)}</span>
          <span>{formatBound(sliderMax)}</span>
        </div>
      </div>

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-muted-foreground text-xs leading-relaxed">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
