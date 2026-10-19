import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { listCircuitsOptions } from '@/client/@tanstack/react-query.gen';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { EmptyState } from '@/components/states';
import { CircuitsTable } from '@/features/circuits/circuits-table';
import { formatNumber } from '@/lib/format';

export const Route = createFileRoute('/_app/circuitos')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listCircuitsOptions()),
  head: () => ({ meta: [{ title: 'Circuitos atuais · Novelo' }] }),
  component: Circuits,
});

function Circuits() {
  const { data } = useSuspenseQuery(listCircuitsOptions());

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dados da Vitrus · planeamento de recolha"
        title="Circuitos e viaturas atuais"
        description="As rotas que já passam por cada localidade são a base da recolha de têxteis a pedido: onde já há camião, o quilómetro extra é perto de zero."
      />
      <StatStrip className="lg:grid-cols-4">
        <StatCell
          label="Circuitos"
          value={formatNumber(data.total)}
          hint={`${formatNumber(data.without_vehicle)} sem viatura atribuída`}
        />
        <StatCell
          label="Viaturas"
          value={formatNumber(data.vehicles)}
          hint={`${data.vehicles_never_assigned.length} nunca têm circuito (reserva ou oficina)`}
        />
        <StatCell
          label="Localidades"
          value={formatNumber(data.localities.length)}
          hint="com pelo menos um circuito"
        />
        <StatCell
          label="Por confirmar"
          value={formatNumber(data.circuits.filter((c) => c.note).length)}
          hint="circuitos com observação nos dados"
        />
      </StatStrip>
      {data.circuits.length === 0 ? (
        <EmptyState title="Sem circuitos" description="Corre o ETL para gerar data/processed." />
      ) : (
        <CircuitsTable circuits={data.circuits} />
      )}
    </div>
  );
}
