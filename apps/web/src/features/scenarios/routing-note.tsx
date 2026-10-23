import { Badge } from '@/components/ui/badge';
import { m } from '@/paraglide/messages';
import { type Routing, routingText } from './routing';

/** Nota discreta com a proveniência dos km das rotas (OSRM/OpenStreetMap ou estimativa). */
export function RoutingNote({ routing }: { routing: Routing }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
      <span>{routingText(routing)}</span>
      {routing !== 'road' && <Badge variant="outline">{m.common_estimate()}</Badge>}
    </p>
  );
}
