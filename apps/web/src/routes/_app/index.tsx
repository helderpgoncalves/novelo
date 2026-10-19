import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  getObservedFlowsOptions,
  getTextileBaselineOptions,
  getWasteCompositionOptions,
} from '@/client/@tanstack/react-query.gen';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { CaptureBar } from '@/features/baseline/capture-bar';
import { EntityTable } from '@/features/baseline/entity-table';
import { FlowsSankey } from '@/features/baseline/flows-sankey';
import { buildInsights } from '@/features/baseline/insights';
import { WasteCompositionChart } from '@/features/baseline/waste-composition';
import { formatKg, formatNumber, formatPercent, formatTonnes } from '@/lib/format';

export const Route = createFileRoute('/_app/')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(getTextileBaselineOptions()),
      queryClient.ensureQueryData(getObservedFlowsOptions()),
      queryClient.ensureQueryData(getWasteCompositionOptions()),
    ]),
  head: () => ({ meta: [{ title: 'Ponto de partida · Novelo' }] }),
  component: Baseline,
});

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl">{title}</h2>
        {description && (
          <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Baseline() {
  const { data: b } = useSuspenseQuery(getTextileBaselineOptions());
  const { data: flows } = useSuspenseQuery(getObservedFlowsOptions());
  const { data: waste } = useSuspenseQuery(getWasteCompositionOptions());
  const insights = buildInsights(b);

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow={`Dados da Vitrus · ${b.year}`}
        title="O ponto de partida de Guimarães"
        description={`O que já se recolhe, para onde vai e quanto falta captar entre ${formatNumber(b.population)} habitantes.`}
      />

      <StatStrip>
        <StatCell
          label="Recolhido"
          value={formatTonnes(b.total_t)}
          hint={`${b.entities.length} entidades, em ${b.year}`}
        />
        <StatCell
          label="Face ao potencial"
          value={formatPercent(b.capture_of_demand_pct)}
          tag="estimativa"
          tone="primary"
          hint={`de ${formatTonnes(b.estimated_demand_t, 0)} por ano (0,7 kg/hab/mês, Plano municipal)`}
        />
        <StatCell
          label="Por habitante"
          value={formatKg(b.kg_per_inhab_month)}
          hint="por mês, contra 0,70 kg estimados"
        />
        <StatCell
          label="Por captar"
          value={formatTonnes(b.gap_t, 0)}
          tag="estimativa"
          tone="primary"
          hint="a margem que a rede nova pode ir buscar"
        />
      </StatStrip>

      <Section
        title="Quanto falta"
        description="A parte preenchida é o que já se recolhe, repartida por destino. O tracejado é o potencial ainda por captar."
      >
        <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <CaptureBar baseline={b} />
        </div>
      </Section>

      <Section
        title="Para onde vai o que se recolhe"
        description="Fluxo observado em 2025, por entidade e destino final. É o mesmo desenho que o Novelo usa para comparar cenários."
      >
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <FlowsSankey flows={flows} />
        </div>
        <EntityTable entities={b.entities} />
      </Section>

      <Section title="O que os números dizem">
        <ul className="grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-2">
          {insights.map((i) => (
            <li key={i.title} className="space-y-1.5 bg-card p-5">
              <p className="font-medium">{i.title}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">{i.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Onde pesam os têxteis"
        description={`Composição dos resíduos urbanos em Portugal (${formatNumber(waste.kg_per_inhab_year_pt)} kg por habitante e ano). Os têxteis sanitários não entram na recolha de têxteis.`}
      >
        <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <WasteCompositionChart waste={waste} />
        </div>
      </Section>
    </div>
  );
}
