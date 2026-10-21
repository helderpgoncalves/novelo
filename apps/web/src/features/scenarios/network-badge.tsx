import { MapPinned } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { m } from '@/paraglide/messages';

/** Distingue os cenários por locais reais dos desenhados por freguesia. */
export function NetworkBadge() {
  return (
    <Badge
      variant="outline"
      className="gap-1 border-primary/50 bg-primary/5 font-semibold text-[10px] text-primary uppercase tracking-wider"
    >
      <MapPinned className="size-3" aria-hidden="true" />
      {m.site_badge()}
    </Badge>
  );
}
