import { Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';
import type {
  CompositionPart,
  Fibre,
  GarmentType,
  LotItemIn,
  TextileDestination,
  TriageResult,
} from '@/client';
import { NumberField } from '@/components/number-field';
import { StickyActions } from '@/components/sticky-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AVERAGE_WEIGHT_G, FIBRES, fibreLabel, GARMENTS, garmentLabel } from '@/lib/lots';
import { cn } from '@/lib/utils';
import { destinationLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

const CONDITIONS: TextileDestination[] = ['reuse', 'recycle', 'reject'];

// Cada linha da composição tem um id estável (as fibras podem repetir-se, por exemplo duas "outras").
type Row = CompositionPart & { id: string };
const withId = (part: CompositionPart): Row => ({ ...part, id: crypto.randomUUID() });

interface ReviewFormProps {
  result: TriageResult;
  pending: boolean;
  onConfirm: (item: LotItemIn) => void;
  onDiscard: () => void;
}

/** O operador confirma ou corrige o que o modelo sugeriu antes de a peça entrar no lote. */
export function ReviewForm({ result, pending, onConfirm, onDiscard }: ReviewFormProps) {
  const a = result.analysis;
  const [garment, setGarment] = useState<GarmentType>(a.garment_type);
  const [condition, setCondition] = useState<TextileDestination>(a.condition);
  const [composition, setComposition] = useState<Row[]>(() =>
    (a.composition.length ? a.composition : [{ fibre: 'unknown' as Fibre, pct: 100 }]).map(withId),
  );
  const [brand, setBrand] = useState(a.brand ?? '');
  const [weight, setWeight] = useState(result.estimated_weight_g);
  const total = composition.reduce((s, p) => s + (Number.isFinite(p.pct) ? p.pct : 0), 0);
  const valid =
    Math.abs(total - 100) <= 1 && weight > 0 && composition.every((p) => Number.isFinite(p.pct));
  const lowConfidence = a.confidence < 0.6;

  const update = (id: string, patch: Partial<CompositionPart>) =>
    setComposition((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onConfirm({
          garment_type: garment,
          condition,
          composition: composition.map(({ fibre, pct }) => ({ fibre, pct })),
          brand: brand.trim() || null,
          estimated_weight_g: Math.round(weight),
          confidence: a.confidence,
          prompt_version: result.prompt_version,
        });
      }}
    >
      <div
        className={cn(
          'rounded-lg border p-3 text-sm',
          lowConfidence ? 'border-areia/60 bg-areia/10' : 'bg-muted/40',
        )}
        role="status"
      >
        <p className="font-medium">
          {lowConfidence ? m.triage_low_confidence() : m.triage_suggestion()}
        </p>
        <p className="mt-0.5 text-muted-foreground text-xs">
          {m.triage_confidence({ pct: Math.round(a.confidence * 100) })} · {a.notes}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{m.triage_garment()}</Label>
          <Select
            value={garment}
            onValueChange={(v) => {
              setGarment(v as GarmentType);
              setWeight(AVERAGE_WEIGHT_G[v as GarmentType]);
            }}
          >
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GARMENTS.map((g) => (
                <SelectItem key={g} value={g}>
                  {garmentLabel[g]()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <NumberField
          label={m.triage_weight()}
          value={weight}
          onChange={setWeight}
          unit="g"
          step={10}
          min={1}
          hint={m.triage_weight_hint()}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 font-medium text-sm">{m.triage_condition()}</legend>
        <RadioGroup
          value={condition}
          onValueChange={(v) => setCondition(v as TextileDestination)}
          className="grid gap-2 sm:grid-cols-3"
        >
          {CONDITIONS.map((c) => (
            <Label
              key={c}
              htmlFor={`cond-${c}`}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg border p-3 font-normal text-sm',
                condition === c && 'border-primary bg-primary/5',
              )}
            >
              <RadioGroupItem id={`cond-${c}`} value={c} />
              {destinationLabel[c]()}
            </Label>
          ))}
        </RadioGroup>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 font-medium text-sm">{m.triage_composition()}</legend>
        {composition.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <Select value={p.fibre} onValueChange={(v) => update(p.id, { fibre: v as Fibre })}>
              <SelectTrigger className="h-10 flex-1" aria-label={m.triage_fibre()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIBRES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {fibreLabel[f]()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-28">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={Number.isFinite(p.pct) ? p.pct : ''}
                onChange={(e) =>
                  update(p.id, { pct: e.target.value === '' ? Number.NaN : Number(e.target.value) })
                }
                className="h-10 pr-7 tabular-nums"
                aria-label={m.triage_pct()}
              />
              <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2.5 text-muted-foreground text-xs">
                %
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              disabled={composition.length === 1}
              onClick={() => setComposition((prev) => prev.filter((x) => x.id !== p.id))}
              aria-label={m.triage_remove_fibre()}
            >
              <X />
            </Button>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={composition.length >= 6}
            onClick={() =>
              setComposition((prev) => [
                ...prev,
                withId({ fibre: 'other', pct: Math.max(0, 100 - total) }),
              ])
            }
          >
            <Plus className="size-3.5" /> {m.triage_add_fibre()}
          </Button>
          <p
            className={cn(
              'text-xs tabular-nums',
              Math.abs(total - 100) > 1 ? 'text-destructive' : 'text-muted-foreground',
            )}
            role="status"
          >
            {m.triage_total({ total: Math.round(total * 10) / 10 })}
          </p>
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="brand">{m.triage_brand()}</Label>
        <Input
          id="brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          maxLength={80}
          placeholder={m.triage_brand_placeholder()}
          className="h-11"
        />
      </div>

      <StickyActions className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={onDiscard}
          disabled={pending}
        >
          {m.triage_discard()}
        </Button>
        <Button type="submit" className="h-11 font-semibold" disabled={!valid || pending}>
          {pending && <Loader2 className="animate-spin" />}
          {m.triage_add_to_lot()}
        </Button>
      </StickyActions>
    </form>
  );
}
