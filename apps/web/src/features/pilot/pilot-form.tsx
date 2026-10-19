import { Calculator } from 'lucide-react';
import { useState } from 'react';
import type { CollectionMode } from '@/client';
import { NumberField } from '@/components/number-field';
import { Panel } from '@/components/panel';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { MODES, modeHint, modeLabel } from '@/lib/scenario';
import { m } from '@/paraglide/messages';

export interface PilotParams {
  k: number;
  months: number;
  modes: CollectionMode[];
  floor?: number;
}

export const K_RANGE = { min: 2, max: 4 } as const;
export const MONTHS_RANGE = { min: 1, max: 12 } as const;

/** Parâmetros do piloto: o estado vive na URL, por isso o formulário só os edita e submete. */
export function PilotForm({
  value,
  pending,
  onSubmit,
}: {
  value: PilotParams;
  pending: boolean;
  onSubmit: (next: PilotParams) => void;
}) {
  const [k, setK] = useState(value.k);
  const [months, setMonths] = useState(value.months);
  const [modes, setModes] = useState<CollectionMode[]>(value.modes);
  const [floor, setFloor] = useState<number>(value.floor ?? Number.NaN);
  const [submitted, setSubmitted] = useState(false);

  const kError =
    Number.isInteger(k) && k >= K_RANGE.min && k <= K_RANGE.max
      ? undefined
      : m.pilot_error_range({ min: K_RANGE.min, max: K_RANGE.max });
  const monthsError =
    Number.isInteger(months) && months >= MONTHS_RANGE.min && months <= MONTHS_RANGE.max
      ? undefined
      : m.pilot_error_range({ min: MONTHS_RANGE.min, max: MONTHS_RANGE.max });
  const modesError = modes.length === 0 ? m.pilot_error_modes() : undefined;
  const floorError = Number.isNaN(floor) || floor >= 0 ? undefined : m.validation_number_positive();
  const invalid = Boolean(kError || monthsError || modesError || floorError);

  return (
    <Panel title={m.pilot_form_title()} description={m.pilot_form_description()}>
      <form
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (invalid) return;
          onSubmit({
            k,
            months,
            modes: MODES.filter((x) => modes.includes(x)),
            floor: Number.isNaN(floor) ? undefined : floor,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label={m.pilot_k()}
            value={k}
            onChange={setK}
            min={K_RANGE.min}
            max={K_RANGE.max}
            error={submitted ? kError : undefined}
            hint={m.pilot_k_hint()}
          />
          <NumberField
            label={m.pilot_months()}
            value={months}
            onChange={setMonths}
            unit={m.pilot_months_unit()}
            min={MONTHS_RANGE.min}
            max={MONTHS_RANGE.max}
            error={submitted ? monthsError : undefined}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 font-medium text-sm">{m.pilot_modes()}</legend>
          {MODES.map((mode) => (
            <Label
              key={mode}
              className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <Checkbox
                className="mt-0.5"
                checked={modes.includes(mode)}
                onCheckedChange={(checked) =>
                  setModes((prev) => (checked ? [...prev, mode] : prev.filter((x) => x !== mode)))
                }
              />
              <span className="space-y-0.5">
                <span className="block font-medium text-sm">{modeLabel[mode]()}</span>
                <span className="block text-muted-foreground text-xs leading-relaxed">
                  {modeHint[mode]()}
                </span>
              </span>
            </Label>
          ))}
          {submitted && modesError && <p className="text-destructive text-xs">{modesError}</p>}
        </fieldset>

        <NumberField
          label={m.pilot_floor()}
          value={floor}
          onChange={setFloor}
          unit="t"
          step={0.1}
          min={0}
          error={submitted ? floorError : undefined}
          hint={m.pilot_floor_hint()}
        />

        <Button type="submit" className="h-11 w-full font-semibold" disabled={pending}>
          <Calculator />
          {pending ? m.pilot_running() : m.pilot_run()}
        </Button>
      </form>
    </Panel>
  );
}
