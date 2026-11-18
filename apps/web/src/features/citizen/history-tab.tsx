import { Link } from '@tanstack/react-router';
import { History } from 'lucide-react';
import type { CollectionHistoryOut } from '@/client';
import { formatKg } from '@/lib/format';

// Strings em pt-PT de propósito: a área do cidadão é só portuguesa no MVP (decisão da spec #54).

export function HistoryTab({ history }: { history: CollectionHistoryOut[] }) {
  if (history.length === 0) {
    return (
      <div className="border-foreground/20 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Ainda sem recolhas. Quando a viatura levar um saco teu, ele aparece aqui ligado ao
        passaporte público.
      </div>
    );
  }
  return (
    <>
      <h2 className="font-serif text-xl">Histórico</h2>
      <ul className="space-y-2">
        {history.map((row) => (
          <li key={row.bag_id} className="ring-foreground/10 rounded-xl bg-card p-4 ring-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-mono text-sm">{row.bag_code}</p>
              {row.lot_code ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary font-medium">
                  recolhido
                </span>
              ) : (
                <span className="text-muted-foreground rounded-full bg-muted px-2.5 py-1 text-[11px]">
                  em casa
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {row.nickname ? `«${row.nickname}» · ` : ''}
              {row.declaration === 'reuse'
                ? 'vestir de novo'
                : row.declaration === 'recycle'
                  ? 'dar a vida'
                  : 'sem declaração'}
              {row.weight_kg != null ? ` · ${formatKg(row.weight_kg)}` : ''}
            </p>
            {row.lot_code && (
              <Link
                to="/passport/$code"
                params={{ code: row.lot_code }}
                className="text-primary mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-medium"
              >
                <History className="size-4" aria-hidden />
                Passaporte do lote {row.lot_code}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
