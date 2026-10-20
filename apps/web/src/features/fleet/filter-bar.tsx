import { ChevronDown, X } from 'lucide-react';
import type { Shift, Typology } from '@/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { weekdayLong } from '@/lib/i18n';
import { shiftLabel, typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import { DAYS, type Filters, hasFilters, SHIFTS, TYPOLOGIES } from './schedule';
import { TypologyMark } from './typology-style';

const ALL = '__all__';

interface FilterBarProps {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  plates: string[];
  circuits: string[];
  localities: string[];
  /** Tipologias com dados (as restantes não aparecem). */
  typologies?: Typology[];
  /** Mostra os filtros de dia e turno (o calendário já os tem na própria grelha). */
  withTime?: boolean;
  /** Controlos extra à direita (exportar, densidade). */
  trailing?: React.ReactNode;
}

function Pick({
  label,
  value,
  onChange,
  options,
  width = 'w-40',
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: { value: string; label: string }[];
  width?: string;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger
        size="sm"
        aria-label={label}
        data-active={value ? 'true' : undefined}
        className={`h-9 ${width} max-w-full data-[active=true]:border-primary data-[active=true]:bg-primary/5`}
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-72">
        <SelectItem value={ALL}>{label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Filtros partilhados do calendário e do mapa: tipologia (várias), viatura, circuito, localidade, dia e turno. */
export function FilterBar({
  filters,
  onChange,
  onClear,
  plates,
  circuits,
  localities,
  typologies = [...TYPOLOGIES],
  withTime = false,
  trailing,
}: FilterBarProps) {
  const active = hasFilters(filters, withTime ? [] : ['day', 'shift']);
  const toggle = (t: Typology, on: boolean) =>
    onChange({
      typologies: on ? [...filters.typologies, t] : filters.typologies.filter((x) => x !== t),
    });

  return (
    <fieldset className="flex min-w-0 flex-wrap items-center gap-2 print:hidden">
      <legend className="sr-only">{m.fl_filters()}</legend>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 data-[active=true]:border-primary data-[active=true]:bg-primary/5"
            data-active={filters.typologies.length > 0 ? 'true' : undefined}
          >
            {m.fl_filter_typology()}
            {filters.typologies.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 font-semibold text-[10px] text-primary-foreground tabular-nums">
                {filters.typologies.length}
              </span>
            )}
            <ChevronDown className="opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-1 p-2">
          <p className="px-2 pt-1 pb-1.5 font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
            {m.fl_filter_typology()}
          </p>
          {typologies.map((t) => (
            <div
              key={t}
              className="flex min-h-10 items-center gap-2.5 rounded-md px-2 hover:bg-muted"
            >
              <Checkbox
                id={`fl-ty-${t}`}
                checked={filters.typologies.includes(t)}
                onCheckedChange={(v) => toggle(t, v === true)}
              />
              <TypologyMark typology={t} />
              <Label
                htmlFor={`fl-ty-${t}`}
                className="min-h-10 flex-1 cursor-pointer font-normal text-sm"
              >
                {typologyLabel[t]()}
              </Label>
            </div>
          ))}
        </PopoverContent>
      </Popover>
      <Pick
        label={m.fl_filter_vehicle()}
        value={filters.plate}
        onChange={(plate) => onChange({ plate })}
        options={plates.map((p) => ({ value: p, label: p }))}
        width="w-36"
      />
      <Pick
        label={m.fl_filter_circuit()}
        value={filters.circuit}
        onChange={(circuit) => onChange({ circuit })}
        options={circuits.map((c) => ({ value: c, label: c }))}
        width="w-36"
      />
      <Pick
        label={m.fl_filter_locality()}
        value={filters.locality}
        onChange={(locality) => onChange({ locality })}
        options={localities.map((l) => ({ value: l, label: l }))}
        width="w-44"
      />
      {withTime && (
        <>
          <Pick
            label={m.fl_filter_day()}
            value={filters.day ? String(filters.day) : undefined}
            onChange={(day) => onChange({ day: day ? Number(day) : undefined })}
            options={DAYS.map((d) => ({ value: String(d), label: weekdayLong(d) }))}
            width="w-36"
          />
          <Pick
            label={m.fl_filter_shift()}
            value={filters.shift}
            onChange={(shift) => onChange({ shift: shift as Shift | undefined })}
            options={SHIFTS.map((s) => ({ value: s, label: shiftLabel[s]() }))}
            width="w-32"
          />
        </>
      )}
      {active && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-muted-foreground"
          onClick={onClear}
        >
          <X aria-hidden="true" />
          {m.fl_filters_clear()}
        </Button>
      )}
      {trailing && <div className="ml-auto flex flex-wrap items-center gap-2">{trailing}</div>}
    </fieldset>
  );
}
