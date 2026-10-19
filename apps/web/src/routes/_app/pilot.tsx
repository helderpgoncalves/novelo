import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Printer } from 'lucide-react';
import { z } from 'zod';
import { type CollectionMode, recommendPilot } from '@/client';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { CardSkeleton, StatStripSkeleton } from '@/components/skeletons';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { K_RANGE, MONTHS_RANGE, PilotForm, type PilotParams } from '@/features/pilot/pilot-form';
import { PilotResult } from '@/features/pilot/pilot-result';
import { m } from '@/paraglide/messages';

const DEFAULT_MODES: CollectionMode[] = ['street', 'on_demand'];

const searchSchema = z.object({
  k: z.number().int().min(K_RANGE.min).max(K_RANGE.max).optional().catch(undefined),
  months: z.number().int().min(MONTHS_RANGE.min).max(MONTHS_RANGE.max).optional().catch(undefined),
  modes: z
    .array(z.enum(['street', 'existing', 'on_demand']))
    .min(1)
    .optional()
    .catch(undefined),
  floor: z.number().min(0).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/pilot')({
  validateSearch: searchSchema,
  staticData: { skeleton: 'form' },
  head: () => ({ meta: [{ title: m.title_pilot() }] }),
  component: PilotPage,
});

function PilotPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const params: PilotParams = {
    k: search.k ?? 2,
    months: search.months ?? 3,
    modes: search.modes ?? DEFAULT_MODES,
    floor: search.floor,
  };

  // O cálculo é um POST sem efeitos (semente fixa): lê-se como consulta para ter cache e estados.
  const query = useQuery({
    queryKey: ['pilot', params],
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const { data } = await recommendPilot({
        body: {
          k: params.k,
          months: params.months,
          modes: params.modes,
          min_tonnes_pilot: params.floor ?? null,
        },
        throwOnError: true,
      });
      return data;
    },
  });

  return (
    <Page>
      <PageHeader
        eyebrow={m.pilot_eyebrow()}
        title={m.pilot_title()}
        description={m.pilot_description()}
        actions={
          <Button
            variant="outline"
            className="h-10 gap-2 print:hidden"
            disabled={!query.data}
            onClick={() => window.print()}
          >
            <Printer /> {m.pilot_print()}
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <aside className="lg:sticky lg:top-4 lg:col-span-4 lg:self-start xl:col-span-3 print:hidden">
          <PilotForm
            key={JSON.stringify(params)}
            value={params}
            pending={query.isFetching}
            onSubmit={(next) => navigate({ search: next, replace: true })}
          />
        </aside>
        <div
          className="min-w-0 lg:col-span-8 xl:col-span-9"
          aria-live="polite"
          aria-busy={query.isPending}
        >
          {query.isPending ? (
            <div className="space-y-8">
              <span className="sr-only">{m.common_loading()}</span>
              <StatStripSkeleton cells={4} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            </div>
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : query.data.zones.length === 0 ? (
            <EmptyState title={m.pilot_empty_title()} description={m.pilot_empty_text()} />
          ) : (
            <PilotResult data={query.data} />
          )}
        </div>
      </div>
    </Page>
  );
}
