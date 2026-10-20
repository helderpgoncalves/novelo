import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import type { AllPages } from './use-all-pages';

/** Linha de estado das listas que se trazem por páginas: progresso, ou erro a meio com "tentar de novo". */
export function LoadProgress({ pages }: { pages: AllPages<unknown> }) {
  if (pages.error && pages.rows.length > 0) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-destructive">
          {m.mun_load_partial({
            shown: formatNumber(pages.rows.length),
            total: formatNumber(pages.total),
          })}{' '}
          {getErrorMessage(pages.error)}
        </span>
        <Button variant="outline" className="h-10" onClick={pages.retry}>
          {m.common_retry()}
        </Button>
      </div>
    );
  }
  if (pages.loadingMore) {
    return (
      <p role="status" className="text-muted-foreground text-xs tabular-nums">
        {m.mun_load_progress({
          shown: formatNumber(pages.rows.length),
          total: formatNumber(pages.total),
        })}
      </p>
    );
  }
  return null;
}
