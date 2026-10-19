import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ParamMeta, ParamSource, PlanningParams } from '@/client';
import { NumberField } from '@/components/number-field';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getParam, PARAM_GROUPS, setParam } from './param-fields';
import { SourceBadge } from './source-badge';

interface ParametersFormProps {
  value: PlanningParams;
  onChange: (value: PlanningParams) => void;
  meta: ParamMeta[];
  errors?: Record<string, string>;
  /** Grupos abertos à partida (os outros ficam recolhidos). */
  defaultOpen?: string[];
  /** Mostra só os campos desta origem (e abre os grupos que os têm). */
  sourceFilter?: ParamSource | null;
  /** Cada grupo num cartão e campos em 3 colunas em ecrãs largos. */
  wide?: boolean;
}

/** Editor de todos os pressupostos do modelo, por grupos, cada campo com a sua origem. */
export function ParametersForm({
  value,
  onChange,
  meta,
  errors = {},
  defaultOpen = ['general'],
  sourceFilter = null,
  wide = false,
}: ParametersFormProps) {
  const [open, setOpen] = useState<Set<string>>(new Set(defaultOpen));
  const source = new Map(meta.map((x) => [x.key, x.source]));

  return (
    <div
      className={
        wide ? 'space-y-4' : 'divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10'
      }
    >
      {PARAM_GROUPS.map((group) => {
        const fields = sourceFilter
          ? group.fields.filter((f) => source.get(f.path) === sourceFilter)
          : group.fields;
        if (fields.length === 0) return null;
        const isOpen = sourceFilter !== null || open.has(group.id);
        const groupErrors = group.fields.filter((f) => errors[f.path]).length;
        return (
          <Collapsible
            key={group.id}
            className={wide ? 'rounded-xl bg-card ring-1 ring-foreground/10' : undefined}
            open={isOpen}
            onOpenChange={(next) =>
              sourceFilter === null &&
              setOpen((prev) => {
                const copy = new Set(prev);
                if (next) copy.add(group.id);
                else copy.delete(group.id);
                return copy;
              })
            }
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 min-h-12 px-5 py-3 text-left font-medium text-sm">
              <span className="flex items-center gap-2">
                {group.title()}
                <span className="font-normal text-muted-foreground text-xs tabular-nums">
                  {fields.length}
                </span>
                {groupErrors > 0 && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive text-xs">
                    {groupErrors}
                  </span>
                )}
              </span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div
                className={`grid gap-4 px-5 pt-1 pb-5 sm:grid-cols-2 ${wide ? 'lg:grid-cols-3' : ''}`}
              >
                {fields.map((f) => {
                  const origin = source.get(f.path);
                  return (
                    <NumberField
                      key={f.path}
                      label={f.label()}
                      value={getParam(value, f.path)}
                      onChange={(v) =>
                        onChange(setParam(value, f.path, f.kind === 'int' ? Math.round(v) : v))
                      }
                      percent={f.kind === 'percent'}
                      unit={f.unit}
                      step={f.step}
                      min={f.min}
                      max={f.max}
                      error={errors[f.path]}
                      badge={origin ? <SourceBadge source={origin} /> : undefined}
                    />
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
