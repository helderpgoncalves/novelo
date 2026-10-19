import type { PlanningParams } from '@/client';
import { getParam, PARAM_GROUPS } from '@/features/assumptions/param-fields';
import { formatNumber } from '@/lib/format';

/** Os pressupostos exatos com que um cenário foi calculado (só leitura): o cenário é reproduzível. */
export function ParameterSummary({ params }: { params: PlanningParams }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border md:grid-cols-2">
      {PARAM_GROUPS.map((group) => (
        <div key={group.id} className="space-y-2 bg-card p-5">
          <p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
            {group.title()}
          </p>
          <dl className="space-y-1 text-sm">
            {group.fields.map((f) => {
              const value = getParam(params, f.path);
              return (
                <div key={f.path} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{f.label()}</dt>
                  <dd className="tabular-nums">
                    {f.kind === 'percent'
                      ? `${formatNumber(value * 100, 1)}%`
                      : `${formatNumber(value, 2)}${f.unit ? ` ${f.unit}` : ''}`}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}
