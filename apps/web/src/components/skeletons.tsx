import { useMatches } from '@tanstack/react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

/**
 * Esqueletos com a mesma estrutura dos componentes reais (cabeçalho, indicadores, tabela, secções),
 * para a página não "saltar" quando os dados chegam. Cada rota só declara `staticData: { skeleton }`
 * e o router escolhe o esqueleto certo (ver `RouteSkeleton`).
 */
export type SkeletonVariant = 'dashboard' | 'table' | 'cards' | 'detail' | 'form' | 'map' | 'chart';

export function HeaderSkeleton({ actions = false }: { actions?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="w-full max-w-2xl space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-3/4 sm:h-10" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      {actions && <Skeleton className="h-10 w-40" />}
    </div>
  );
}

export function StatStripSkeleton({ cells = 4 }: { cells?: number }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border lg:grid-cols-4">
      {Array.from({ length: cells }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lista estática de blocos
        <div key={i} className="space-y-3 bg-card p-4 sm:p-5">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-8 w-24 sm:h-9" />
          <Skeleton className="h-3 w-full max-w-[10rem]" />
        </div>
      ))}
    </div>
  );
}

export function SectionTitleSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

export function DataTableSkeleton({
  rows = 8,
  columns = 5,
  controls = true,
}: {
  rows?: number;
  columns?: number;
  controls?: boolean;
}) {
  return (
    <div className="space-y-3">
      {controls && (
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-full sm:max-w-xs sm:flex-1" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28 sm:ml-auto" />
        </div>
      )}
      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lista estática de blocos
          <li key={i} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <div className="flex h-10 items-center gap-6 border-b px-4">
          {Array.from({ length: columns }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lista estática de blocos
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lista estática de blocos
          <div key={r} className="flex h-[2.9rem] items-center gap-6 border-b px-4 last:border-0">
            {Array.from({ length: columns }, (_, c) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lista estática de blocos
              <Skeleton key={c} className={cn('h-4 flex-1', c === 0 && 'max-w-[7rem]')} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-48" />
      </div>
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-72 w-full rounded-xl', className)} />;
}

export function MapSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-[28rem] w-full rounded-xl lg:h-[34rem]', className)} />;
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10', className)}>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-5 rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
      {Array.from({ length: fields }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lista estática de blocos
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-36" />
    </div>
  );
}

const VARIANTS: Record<SkeletonVariant, () => React.ReactNode> = {
  dashboard: () => (
    <>
      <StatStripSkeleton />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <ChartSkeleton className="lg:col-span-8" />
        <CardSkeleton className="lg:col-span-4" />
      </div>
      <div className="space-y-4">
        <SectionTitleSkeleton />
        <DataTableSkeleton rows={5} controls={false} />
      </div>
    </>
  ),
  table: () => (
    <>
      <StatStripSkeleton />
      <DataTableSkeleton />
    </>
  ),
  cards: () => (
    <>
      <StatStripSkeleton cells={3} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </>
  ),
  detail: () => (
    <>
      <StatStripSkeleton />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <DataTableSkeleton rows={6} controls={false} />
      </div>
    </>
  ),
  form: () => (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <FormSkeleton fields={6} />
      </div>
      <div className="lg:col-span-4">
        <CardSkeleton />
      </div>
    </div>
  ),
  map: () => (
    <>
      <StatStripSkeleton cells={3} />
      <MapSkeleton />
    </>
  ),
  chart: () => (
    <>
      <StatStripSkeleton />
      <ChartSkeleton className="h-96" />
    </>
  ),
};

/** Página inteira em carregamento: cabeçalho + o corpo da variante escolhida. */
export function PageSkeleton({
  variant = 'dashboard',
  actions = false,
}: {
  variant?: SkeletonVariant;
  actions?: boolean;
}) {
  return (
    <div className="space-y-8 sm:space-y-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">{m.common_loading()}</span>
      <HeaderSkeleton actions={actions} />
      {VARIANTS[variant]()}
    </div>
  );
}

/** Esqueleto automático das rotas: usa `staticData.skeleton` da rota que está a carregar. */
export function RouteSkeleton() {
  const variant = useMatches({
    select: (matches) =>
      [...matches].reverse().find((x) => x.staticData?.skeleton)?.staticData?.skeleton,
  });
  return <PageSkeleton variant={variant ?? 'dashboard'} actions />;
}
