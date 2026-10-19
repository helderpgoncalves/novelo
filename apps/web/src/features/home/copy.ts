import type { OverviewReference } from '@/client';
import { m } from '@/paraglide/messages';

/** Sujeito da frase para uma referência ("A França", "A média da UE"), com o artigo certo. */
export function benchmarkSubject(bench: OverviewReference): string {
  if (bench.key === 'france_2024') return m.home_subject_france();
  if (bench.key === 'eu27_2020') return m.home_subject_eu();
  return bench.label;
}
