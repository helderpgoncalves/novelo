import type { TextileBaseline } from '@/client';
import { formatPercent, formatTonnes } from '@/lib/format';

export interface Insight {
  title: string;
  body: string;
}

/** Leituras que saem diretamente dos números da Vitrus: nada de texto fixo com valores à mão. */
export function buildInsights(b: TextileBaseline): Insight[] {
  const worstReject = [...b.entities].sort((x, y) => y.reject_pct - x.reject_pct)[0];
  const biggest = [...b.entities].sort((x, y) => y.total_t - x.total_t)[0];
  const estimated = b.entities.filter((e) => !e.exact_weights);
  const insights: Insight[] = [
    {
      title: `${formatPercent((b.reuse_t / b.total_t) * 100)} segue para reutilização`,
      body: `${formatTonnes(b.reuse_t)} de ${formatTonnes(b.total_t)}. Receita e impacto sobem quando mais têxtil chega limpo e reutilizável.`,
    },
  ];
  if (biggest) {
    insights.push({
      title: `${biggest.entity} recolhe ${formatPercent((biggest.total_t / b.total_t) * 100, 0)} do total`,
      body: `${formatTonnes(biggest.total_t)} em 2025. Uma rede nova tem de decidir se complementa ou substitui estes circuitos.`,
    });
  }
  if (worstReject && worstReject.reject_pct > 20) {
    insights.push({
      title: `${worstReject.entity}: ${formatPercent(worstReject.reject_pct, 0)} de rejeito`,
      body: `Só ${formatTonnes(worstReject.total_t)} recolhidas, por isso a amostra é pequena. Convém confirmar antes de tirar conclusões.`,
    });
  }
  if (estimated.length > 0) {
    insights.push({
      title: `${estimated.length} entidades sem pesagem por destino`,
      body: `${estimated.map((e) => e.entity).join(' e ')} usam percentagens de relatórios aplicadas ao total. Estão marcadas como estimativa.`,
    });
  }
  return insights;
}
