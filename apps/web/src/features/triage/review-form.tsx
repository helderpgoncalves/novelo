import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import type {
  Colour,
  CompositionPart,
  Fibre,
  FineState,
  GarmentType,
  Gender,
  LotItemIn,
  Provenance,
  Season,
  SizeBand,
  TextileDestination,
  TriageResult,
} from '@/client';
import { NumberField } from '@/components/number-field';
import { StickyActions } from '@/components/sticky-actions';
import { Badge } from '@/components/ui/badge';
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
import { PhotoConsent } from '@/features/lots/photo-consent';
import { formatPercent } from '@/lib/format';
import { NO_PHOTO_CHOICE, type PhotoChoice, photoChoiceReady } from '@/lib/lot-photos';
import { AVERAGE_WEIGHT_G, FIBRES, fibreLabel, GARMENTS, garmentLabel } from '@/lib/lots';
import {
  COLOURS,
  colourLabel,
  destinationFor,
  FINE_STATES,
  fineStateLabel,
  GENDERS,
  genderLabel,
  SEASONS,
  SIZE_BANDS,
  seasonLabel,
  sizeBandLabel,
} from '@/lib/taxonomy';
import { cn } from '@/lib/utils';
import { destinationLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import { AttributeSeal } from './attribute-seal';

// Eixos que o operador vê com selo; a tipologia (garment_type) tem o seu próprio campo.
type AxisKey = 'fine_state' | 'season' | 'colour' | 'gender' | 'size_band';
type Origins = Record<AxisKey, Provenance>;

const initialOrigins = (): Origins => ({
  fine_state: 'ai',
  season: 'ai',
  colour: 'ai',
  gender: 'ai',
  size_band: 'ai',
});

// Cada linha da composição tem um id estável (as fibras podem repetir-se, por exemplo duas "outras").
type Row = CompositionPart & { id: string };
const withId = (part: CompositionPart): Row => ({ ...part, id: crypto.randomUUID() });

interface ReviewFormProps {
  result: TriageResult;
  pending: boolean;
  onConfirm: (item: LotItemIn, photo: PhotoChoice) => void;
  onDiscard: () => void;
}

/** O operador confirma ou corrige o que o modelo sugeriu antes de a peça entrar no lote.

Cada eixo da taxonomia leva um selo «IA»/«Confirmado»: mudar o valor passa o selo a «Confirmado»
(a palavra final é humana) — as correções viram rótulos dourados no servidor. */
export function ReviewForm({ result, pending, onConfirm, onDiscard }: ReviewFormProps) {
  const a = result.analysis;
  const [garment, setGarment] = useState(a.garment_type);
  const [fine, setFine] = useState<FineState>(a.fine_state);
  const [season, setSeason] = useState<Season>(a.season);
  const [colour, setColour] = useState<Colour>(a.colour);
  const [gender, setGender] = useState<Gender>(a.gender);
  const [size, setSize] = useState<SizeBand>(a.size_band ?? 'unknown');
  const [origins, setOrigins] = useState<Origins>(initialOrigins);
  const [composition, setComposition] = useState<Row[]>(() =>
    (a.composition.length ? a.composition : [{ fibre: 'unknown' as Fibre, pct: 100 }]).map(withId),
  );
  const [brand, setBrand] = useState(a.brand ?? '');
  const [weight, setWeight] = useState(result.estimated_weight_g);
  // Guardar a fotografia no lote é opcional e começa desligado.
  const [photo, setPhoto] = useState<PhotoChoice>(NO_PHOTO_CHOICE);
  const total = composition.reduce((s, p) => s + (Number.isFinite(p.pct) ? p.pct : 0), 0);
  const valid =
    Math.abs(total - 100) <= 1 && weight > 0 && composition.every((p) => Number.isFinite(p.pct));
  const lowConfidence = a.confidence < 0.6;
  const destination: TextileDestination = destinationFor(fine);

  const update = (id: string, patch: Partial<CompositionPart>) =>
    setComposition((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  /** Uma correção do operador passa o selo do eixo a «Confirmado». */
  const correct = <K extends AxisKey>(key: K) =>
    setOrigins((prev) => (prev[key] === 'confirmed' ? prev : { ...prev, [key]: 'confirmed' }));

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || !photoChoiceReady(photo)) return;
        onConfirm(
          {
            garment_type: garment,
            fine_state: fine,
            season,
            colour,
            gender,
            size_band: size,
            composition: composition.map(({ fibre, pct }) => ({ fibre, pct })),
            brand: brand.trim() || null,
            estimated_weight_g: Math.round(weight),
            confidence: a.confidence,
            prompt_version: result.prompt_version,
            ai_proposal: {
              model: result.model,
              prompt_version: result.prompt_version,
              confidence: a.confidence,
              values: {
                garment_type: a.garment_type,
                fine_state: a.fine_state,
                season: a.season,
                colour: a.colour,
                gender: a.gender,
                size_band: a.size_band,
              },
            },
          },
          photo,
        );
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
        {/* Resumo do que o modelo leu: no telemóvel a composição e a marca ficam abaixo da dobra. */}
        <ul className="mt-2 flex flex-wrap gap-1.5" data-testid="triage-suggestion">
          {[
            ...new Set([
              garmentLabel[a.garment_type](),
              fineStateLabel[a.fine_state](),
              destinationLabel[result.destination](),
              ...a.composition.map((p) => `${fibreLabel[p.fibre]()} ${formatPercent(p.pct, 0)}`),
              ...(a.brand ? [a.brand] : []),
            ]),
          ].map((text) => (
            <li key={text}>
              <Badge variant="outline" className="bg-background/70 font-medium">
                {text}
              </Badge>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-muted-foreground text-xs">
          {m.triage_confidence({ pct: Math.round(a.confidence * 100) })} · {a.notes}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="garment">{m.triage_garment()}</Label>
          <Select
            value={garment}
            onValueChange={(v) => {
              setGarment(v as GarmentType);
              setWeight(AVERAGE_WEIGHT_G[v as GarmentType]);
            }}
          >
            <SelectTrigger id="garment" className="h-11 w-full">
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
        <legend className="mb-1 flex items-center gap-2 font-medium text-sm">
          {m.triage_axis_fine_state()}
          <AttributeSeal
            origin={origins.fine_state}
            confidence={origins.fine_state === 'ai' ? a.confidence : undefined}
          />
        </legend>
        <RadioGroup
          value={fine}
          onValueChange={(v) => {
            setFine(v as FineState);
            correct('fine_state');
          }}
          className="grid gap-2 sm:grid-cols-3"
        >
          {FINE_STATES.map((f) => (
            <Label
              key={f}
              htmlFor={`fine-${f}`}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg border p-3 font-normal text-sm',
                fine === f && 'border-primary bg-primary/5',
              )}
            >
              <RadioGroupItem id={`fine-${f}`} value={f} />
              {fineStateLabel[f]()}
            </Label>
          ))}
        </RadioGroup>
        <p className="text-muted-foreground text-xs" role="status">
          {m.triage_destination()}:{' '}
          <span className="font-medium text-foreground">{destinationLabel[destination]()}</span>
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="season">{m.triage_axis_season()}</Label>
          <div className="flex items-center gap-2">
            <Select
              value={season}
              onValueChange={(v) => {
                setSeason(v as Season);
                correct('season');
              }}
            >
              <SelectTrigger id="season" className="h-11 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEASONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {seasonLabel[s]()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AttributeSeal
              origin={origins.season}
              confidence={origins.season === 'ai' ? a.confidence : undefined}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="colour">{m.triage_axis_colour()}</Label>
          <div className="flex items-center gap-2">
            <Select
              value={colour}
              onValueChange={(v) => {
                setColour(v as Colour);
                correct('colour');
              }}
            >
              <SelectTrigger id="colour" className="h-11 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOURS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {colourLabel[c]()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AttributeSeal
              origin={origins.colour}
              confidence={origins.colour === 'ai' ? a.confidence : undefined}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gender">{m.triage_axis_gender()}</Label>
          <div className="flex items-center gap-2">
            <Select
              value={gender}
              onValueChange={(v) => {
                setGender(v as Gender);
                correct('gender');
              }}
            >
              <SelectTrigger id="gender" className="h-11 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {genderLabel[g]()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AttributeSeal
              origin={origins.gender}
              confidence={origins.gender === 'ai' ? a.confidence : undefined}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="size">{m.triage_axis_size()}</Label>
          <div className="flex items-center gap-2">
            <Select
              value={size}
              onValueChange={(v) => {
                setSize(v as SizeBand);
                correct('size_band');
              }}
            >
              <SelectTrigger id="size" className="h-11 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZE_BANDS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {sizeBandLabel[s]()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AttributeSeal
              origin={origins.size_band}
              confidence={origins.size_band === 'ai' ? a.confidence : undefined}
            />
          </div>
          <p className="text-muted-foreground text-xs">{m.triage_size_hint()}</p>
        </div>
      </div>

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

      <PhotoConsent choice={photo} onChange={setPhoto} />

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
        <Button
          type="submit"
          className="h-11 font-semibold"
          disabled={!valid || !photoChoiceReady(photo) || pending}
          loading={pending}
        >
          {m.triage_add_to_lot()}
        </Button>
      </StickyActions>
    </form>
  );
}
