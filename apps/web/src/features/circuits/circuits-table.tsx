import { Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import type { Circuit } from '@/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function CircuitsTable({ circuits }: { circuits: Circuit[] }) {
  const [query, setQuery] = useState('');
  const [typology, setTypology] = useState<string | null>(null);
  const deferred = useDeferredValue(query);

  const typologies = useMemo(() => [...new Set(circuits.map((c) => c.typology))], [circuits]);
  const rows = useMemo(() => {
    const q = normalize(deferred.trim());
    return circuits.filter(
      (c) =>
        (!typology || c.typology === typology) &&
        (!q ||
          normalize(`${c.circuit} ${c.localities.join(' ')} ${c.collection_type}`).includes(q)),
    );
  }, [circuits, deferred, typology]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar circuito ou localidade"
            aria-label="Pesquisar circuito ou localidade"
            className="h-10 pl-9"
          />
        </div>
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="sr-only">Filtrar por tipologia</legend>
          {[null, ...typologies].map((t) => (
            <button
              key={t ?? 'todas'}
              type="button"
              onClick={() => setTypology(t)}
              aria-pressed={typology === t}
              className={cn(
                'h-8 rounded-full border px-3 text-xs transition-colors',
                typology === t
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {t ?? 'Todas'}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 px-4">Circuito</TableHead>
              <TableHead className="h-10">Tipologia</TableHead>
              <TableHead className="h-10">Recolha</TableHead>
              <TableHead className="h-10">Localidades</TableHead>
              <TableHead className="h-10 pr-4">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={`${c.typology}-${c.circuit}`} className="align-top">
                <TableCell className="px-4 font-medium">{c.circuit}</TableCell>
                <TableCell>{c.typology}</TableCell>
                <TableCell>
                  {c.collection_type || <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="max-w-md whitespace-normal text-muted-foreground">
                  {c.localities.join(', ') || '-'}
                </TableCell>
                <TableCell className="pr-4">
                  <Badge
                    variant={c.status === 'OK' ? 'secondary' : 'outline'}
                    className="whitespace-nowrap font-semibold text-[10px] uppercase tracking-wider"
                  >
                    {c.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhum circuito corresponde à pesquisa.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
        {rows.length} de {circuits.length} circuitos
      </p>
    </div>
  );
}
