import type { EntityBaseline } from '@/client';
import { formatPercent, formatTonnes } from '@/lib/format';

export function EntityTable({ entities }: { entities: EntityBaseline[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-linha bg-white/60">
      <table className="w-full text-left text-sm">
        <thead className="border-linha border-b text-pedra">
          <tr>
            <th className="p-3 font-medium">Entidade</th>
            <th className="p-3 text-right font-medium">Recolhido</th>
            <th className="p-3 text-right font-medium">Reutilização</th>
            <th className="p-3 text-right font-medium">Reciclagem</th>
            <th className="p-3 text-right font-medium">Rejeito</th>
            <th className="p-3 font-medium">Peso</th>
          </tr>
        </thead>
        <tbody>
          {entities.map((e) => (
            <tr key={e.entity} className="border-linha border-b last:border-0">
              <td className="p-3 font-medium">{e.entity}</td>
              <td className="p-3 text-right tabular-nums">{formatTonnes(e.total_t)}</td>
              <td className="p-3 text-right tabular-nums">{formatPercent(e.reuse_pct)}</td>
              <td className="p-3 text-right tabular-nums">{formatPercent(e.recycle_pct)}</td>
              <td className="p-3 text-right tabular-nums">{formatPercent(e.reject_pct)}</td>
              <td className="p-3 text-pedra">
                {e.exact_weights ? 'kg exatos' : 'estimativa (% do relatório)'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
