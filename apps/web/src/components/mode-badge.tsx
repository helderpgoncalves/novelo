import type { CollectionMode } from '@/client';
import { MODE_COLORS } from '@/lib/map';
import { modeLabel } from '@/lib/scenario';
import { m } from '@/paraglide/messages';

export function ModeDot({ mode }: { mode: CollectionMode | null }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ background: mode ? MODE_COLORS[mode] : '#b8b2a4' }}
      aria-hidden="true"
    />
  );
}

export function ModeBadge({ mode }: { mode: CollectionMode | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <ModeDot mode={mode} />
      {mode ? modeLabel[mode]() : <span className="text-muted-foreground">{m.mode_none()}</span>}
    </span>
  );
}

/** Os modos de uma freguesia (pode combinar mais do que um), o principal primeiro. */
export function ModeBadges({ modes }: { modes: CollectionMode[] }) {
  if (modes.length === 0) return <ModeBadge mode={null} />;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {modes.map((mode) => (
        <ModeBadge key={mode} mode={mode} />
      ))}
    </span>
  );
}
