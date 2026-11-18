import type { Provenance } from '@/client';
import { Badge } from '@/components/ui/badge';
import { formatPercent } from '@/lib/format';
import { provenanceLabel } from '@/lib/taxonomy';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

/** Selo por atributo: «IA» com a confiança da proposta, ou «Confirmado» quando o operador definiu o valor. */
export function AttributeSeal({
  origin,
  confidence,
  className,
}: {
  origin: Provenance;
  confidence?: number;
  className?: string;
}) {
  const isAi = origin === 'ai';
  return (
    <Badge
      variant="outline"
      title={
        isAi && confidence !== undefined
          ? m.triage_confidence({ pct: Math.round(confidence * 100) })
          : provenanceLabel.confirmed()
      }
      className={cn(
        'gap-1 px-1.5 py-0 font-medium',
        isAi ? 'text-muted-foreground' : 'border-primary/50 text-primary',
        className,
      )}
    >
      {provenanceLabel[origin]()}
      {isAi && confidence !== undefined && (
        <span className="tabular-nums">{formatPercent(confidence * 100, 0)}</span>
      )}
    </Badge>
  );
}
