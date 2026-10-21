import type { ParamSource } from '@/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

const LABEL: Record<ParamSource, () => string> = {
  vitrus_data: () => m.param_source_vitrus_data(),
  assumption: () => m.param_source_assumption(),
};

const TONE: Record<ParamSource, string> = {
  vitrus_data: 'border-primary bg-primary/10 text-primary',
  assumption: 'border-areia/70 text-foreground/80',
};

/** Diz de onde vem cada número: dado real (Vitrus, com a APA) ou pressuposto ainda por validar. */
export function SourceBadge({ source }: { source: ParamSource }) {
  return (
    <Badge
      variant="outline"
      className={cn('h-5 font-semibold text-[9px] uppercase tracking-wider', TONE[source])}
    >
      {LABEL[source]()}
    </Badge>
  );
}
