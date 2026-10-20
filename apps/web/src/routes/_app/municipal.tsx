import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getMunicipalOverviewOptions } from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { ErrorState, PageSkeleton } from '@/components/states';
import { MunicipalPage } from '@/features/municipal/municipal-page';
import { MUNICIPAL_TABS } from '@/features/municipal/tabs';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/municipal')({
  staticData: { skeleton: 'dashboard' },
  validateSearch: z.object({
    tab: z.enum(MUNICIPAL_TABS).optional().catch(undefined),
    /** Código da freguesia em foco (separador Freguesias). */
    parish: z.string().optional().catch(undefined),
    /** Local aberto na folha de detalhe. */
    site: z.string().optional().catch(undefined),
  }),
  // Não falha a navegação se os dados ainda não foram importados: a própria página explica.
  loader: ({ context: { queryClient } }) =>
    queryClient.prefetchQuery(getMunicipalOverviewOptions()),
  head: () => ({ meta: [{ title: m.title_municipal() }] }),
  component: Municipal,
});

function Municipal() {
  const { tab = 'overview', parish, site } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, isPending, error, refetch } = useQuery(getMunicipalOverviewOptions());

  if (isPending) return <PageSkeleton />;
  if (error || !data) {
    return (
      <Page>
        <PageHeader
          eyebrow={m.mun_eyebrow()}
          title={m.mun_title()}
          description={m.mun_description()}
        />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Page>
    );
  }
  return (
    <MunicipalPage
      overview={data}
      tab={tab}
      parish={parish}
      site={site}
      onTabChange={(next) =>
        void navigate({
          search: (prev) => ({
            tab: next === 'overview' ? undefined : next,
            parish: next === 'parishes' ? prev.parish : undefined,
            site: prev.site,
          }),
          replace: true,
        })
      }
      onParishChange={(next) =>
        void navigate({ search: (prev) => ({ ...prev, parish: next }), replace: true })
      }
      onSiteChange={(next) =>
        void navigate({ search: (prev) => ({ ...prev, site: next }), replace: true })
      }
    />
  );
}
