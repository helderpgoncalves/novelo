import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { CollectionMode, ZoneOut } from '@/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MODES, modeLabel } from '@/lib/scenario';
import { m } from '@/paraglide/messages';

export type Constraints = Record<string, CollectionMode[]>;

interface ConstraintsEditorProps {
  zones: ZoneOut[];
  value: Constraints;
  onChange: (value: Constraints) => void;
}

/** Restringe os modos permitidos numa freguesia (ex.: "só recolha a pedido em Serzedelo"). */
export function ConstraintsEditor({ zones, value, onChange }: ConstraintsEditorProps) {
  const [code, setCode] = useState<string>('');
  const [modes, setModes] = useState<CollectionMode[]>(['on_demand']);
  const free = zones.filter((z) => !(z.code in value));

  const add = () => {
    if (!code || modes.length === 0) return;
    onChange({ ...value, [code]: modes });
    setCode('');
  };
  const nameOf = (c: string) => zones.find((z) => z.code === c)?.name ?? c;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{m.sim_constraints_help()}</p>
      {Object.keys(value).length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {Object.entries(value).map(([c, allowed]) => (
            <li
              key={c}
              className="flex items-center gap-2 rounded-full bg-muted py-1 pr-1 pl-3 text-sm"
            >
              <span className="font-medium">{nameOf(c)}</span>
              <span className="text-muted-foreground text-xs">
                {allowed.map((x) => modeLabel[x]()).join(', ')}
              </span>
              <button
                type="button"
                className="grid size-6 place-items-center rounded-full hover:bg-background"
                aria-label={m.sim_constraint_remove({ name: nameOf(c) })}
                onClick={() => {
                  const { [c]: _removed, ...rest } = value;
                  onChange(rest);
                }}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-dashed p-4">
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label>{m.sim_constraint_parish()}</Label>
          <Select value={code} onValueChange={setCode}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder={m.sim_constraint_parish_placeholder()} />
            </SelectTrigger>
            <SelectContent>
              {free.map((z) => (
                <SelectItem key={z.code} value={z.code}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <fieldset className="space-y-1.5">
          <legend className="font-medium text-sm">{m.sim_constraint_allowed()}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {MODES.map((mode) => (
              <Label key={mode} className="flex items-center gap-2 font-normal text-sm">
                <Checkbox
                  checked={modes.includes(mode)}
                  onCheckedChange={(checked) =>
                    setModes((prev) => (checked ? [...prev, mode] : prev.filter((x) => x !== mode)))
                  }
                />
                {modeLabel[mode]()}
              </Label>
            ))}
          </div>
        </fieldset>
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={add}
          disabled={!code || modes.length === 0}
        >
          <Plus /> {m.sim_constraint_add()}
        </Button>
      </div>
    </div>
  );
}
