import type { EffectiveTask } from '@/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { sourceLabel } from './ai';

const TONE: Record<EffectiveTask['model_source'], string> = {
  database: 'border-primary bg-primary/10 text-primary',
  global_default: 'border-primary/40 text-primary',
  env: 'border-areia/70 text-foreground/80',
  code: 'border-border text-muted-foreground',
};

/** Diz de onde vem o valor em vigor: base de dados, default global, .env ou código. */
export function SourceBadge({ source }: { source: EffectiveTask['model_source'] }) {
  return (
    <Badge
      variant="outline"
      className={cn('h-5 font-semibold text-[9px] uppercase tracking-wider', TONE[source])}
    >
      {sourceLabel[source]()}
    </Badge>
  );
}
