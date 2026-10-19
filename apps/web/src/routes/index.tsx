import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  getObservedFlowsOptions,
  getTextileBaselineOptions,
} from '@/client/@tanstack/react-query.gen';
import { EntityTable } from '@/features/baseline/entity-table';
import { FlowsSankey } from '@/features/baseline/flows-sankey';
import { KpiCard } from '@/features/baseline/kpi-card';
import { formatKg, formatPercent, formatTonnes } from '@/lib/format';

export const Route = createFileRoute('/')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(getTextileBaselineOptions()),
      queryClient.ensureQueryData(getObservedFlowsOptions()),
    ]),
  component: Baseline,
});

function Baseline() {
  const { data: b } = useSuspenseQuery(getTextileBaselineOptions());
  const { data: flows } = useSuspenseQuery(getObservedFlowsOptions());

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-4xl">O ponto de partida de Guimarães</h1>
        <p className="mt-2 max-w-2xl text-pedra">
          Dados reais de {b.year}, recebidos da Vitrus: o que já se recolhe, para onde vai e quanto
          falta captar.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Recolhido em 2025" value={formatTonnes(b.total_t)} hint="4 entidades" />
        <KpiCard
          label="Face ao potencial"
          value={formatPercent(b.capture_of_demand_pct)}
          hint={`de ${formatTonnes(b.estimated_demand_t, 0)} estimadas (estimativa)`}
          tone="accent"
        />
        <KpiCard
          label="Por habitante"
          value={formatKg(b.kg_per_inhab_month)}
          hint="por mês, contra 0,70 kg estimados"
        />
        <KpiCard
          label="Por captar"
          value={formatTonnes(b.gap_t, 0)}
          hint="a diferença que a rede nova tem de ir buscar"
          tone="accent"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Para onde vai o que já se recolhe</h2>
        <p className="text-pedra text-sm">
          {formatPercent((b.reuse_t / b.total_t) * 100)} segue para reutilização,{' '}
          {formatPercent((b.recycle_t / b.total_t) * 100)} para reciclagem e{' '}
          {formatPercent((b.reject_t / b.total_t) * 100)} é rejeito.
        </p>
        <div className="rounded-lg border border-linha bg-white/60 p-4">
          <FlowsSankey flows={flows} />
        </div>
        <EntityTable entities={b.entities} />
      </section>
    </div>
  );
}
