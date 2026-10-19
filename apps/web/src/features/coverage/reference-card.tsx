import { BadgeCheck, FlaskConical } from 'lucide-react';
import type { ReferenceStandard } from '@/client';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

/** A referência francesa, sempre com o selo "por verificar" enquanto a fonte não for confirmada. */
export function ReferenceCard({ reference }: { reference: ReferenceStandard }) {
  const Icon = reference.verified ? BadgeCheck : FlaskConical;
  return (
    <aside className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="min-w-0 space-y-1.5">
        <p className="eyebrow">{reference.name}</p>
        <p className="text-sm leading-relaxed">
          {m.cov_reference_rule({
            people: formatNumber(reference.people_per_point),
            points: formatNumber(reference.points),
          })}
        </p>
        {!reference.verified && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {m.cov_reference_unverified_note()}
          </p>
        )}
      </div>
      <Badge
        variant={reference.verified ? 'secondary' : 'outline'}
        className="w-fit shrink-0 gap-1.5 whitespace-nowrap font-semibold text-[10px] uppercase tracking-wider"
      >
        <Icon className="size-3" aria-hidden="true" />
        {reference.verified ? m.cov_reference_verified() : m.cov_reference_unverified()}
      </Badge>
    </aside>
  );
}
