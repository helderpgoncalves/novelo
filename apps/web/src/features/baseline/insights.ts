import type { TextileBaseline } from '@/client';
import { formatPercent, formatTonnes } from '@/lib/format';
import { formatList } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

export interface Insight {
  title: string;
  body: string;
}

/** Leituras que saem diretamente dos números da Vitrus: nada de valores escritos à mão. */
export function buildInsights(b: TextileBaseline): Insight[] {
  const byReject = [...b.entities].sort((x, y) => y.reject_pct - x.reject_pct)[0];
  const biggest = [...b.entities].sort((x, y) => y.total_t - x.total_t)[0];
  const estimated = b.entities.filter((e) => e.method === 'percentage');

  const insights: Insight[] = [
    {
      title: m.insight_reuse_title({ pct: formatPercent((b.reuse_t / b.total_t) * 100) }),
      body: m.insight_reuse_body({ part: formatTonnes(b.reuse_t), total: formatTonnes(b.total_t) }),
    },
  ];
  if (biggest) {
    insights.push({
      title: m.insight_biggest_title({
        entity: biggest.entity,
        pct: formatPercent((biggest.total_t / b.total_t) * 100, 0),
      }),
      body: m.insight_biggest_body({ tonnes: formatTonnes(biggest.total_t), year: b.year }),
    });
  }
  if (byReject && byReject.reject_pct > 20) {
    insights.push({
      title: m.insight_reject_title({
        entity: byReject.entity,
        pct: formatPercent(byReject.reject_pct, 0),
      }),
      body: m.insight_reject_body({ tonnes: formatTonnes(byReject.total_t) }),
    });
  }
  if (estimated.length > 0) {
    insights.push({
      title: m.insight_estimated_title({ count: estimated.length }),
      body: m.insight_estimated_body({ entities: formatList(estimated.map((e) => e.entity)) }),
    });
  }
  return insights;
}
