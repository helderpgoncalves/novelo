import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { listCircuitsOptions } from '@/client/@tanstack/react-query.gen';
import { KpiCard } from '@/features/baseline/kpi-card';

export const Route = createFileRoute('/circuitos')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listCircuitsOptions()),
  component: Circuits,
});

function Circuits() {
  const { data } = useSuspenseQuery(listCircuitsOptions());

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-4xl">Circuitos e viaturas atuais</h1>
        <p className="mt-2 max-w-2xl text-pedra">
          Rotas que já passam em cada localidade: a base para a recolha de têxteis a pedido sem
          quilómetros novos.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Circuitos" value={String(data.total)} />
        <KpiCard
          label="Viaturas"
          value={String(data.vehicles)}
          hint={`${data.vehicles_never_assigned.length} sem circuito`}
        />
        <KpiCard label="Localidades servidas" value={String(data.localities.length)} />
      </section>

      <div className="overflow-x-auto rounded-lg border border-linha bg-white/60">
        <table className="w-full text-left text-sm">
          <thead className="border-linha border-b text-pedra">
            <tr>
              <th className="p-3 font-medium">Circuito</th>
              <th className="p-3 font-medium">Tipologia</th>
              <th className="p-3 font-medium">Recolha</th>
              <th className="p-3 font-medium">Localidades</th>
              <th className="p-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.circuits.map((c) => (
              <tr
                key={`${c.typology}-${c.circuit}`}
                className="border-linha border-b align-top last:border-0"
              >
                <td className="p-3 font-medium">{c.circuit}</td>
                <td className="p-3">{c.typology}</td>
                <td className="p-3">{c.collection_type || '-'}</td>
                <td className="p-3 text-pedra">{c.localities.join(', ') || '-'}</td>
                <td className="p-3">{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
