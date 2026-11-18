import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { listAdminCatalogItemsOptions } from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import {
  CampaignsTable,
  CatalogItemsTable,
  PartnersTable,
} from '@/features/catalog/catalog-tables';
import { m } from '@/paraglide/messages';

const CATALOG_TABS = ['itens', 'parceiros', 'campanhas'] as const;
type CatalogTab = (typeof CATALOG_TABS)[number];

export const Route = createFileRoute('/_app/catalogo')({
  staticData: { skeleton: 'table' },
  validateSearch: z.object({ tab: z.enum(CATALOG_TABS).optional().catch(undefined) }),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(listAdminCatalogItemsOptions()),
  head: () => ({ meta: [{ title: m.title_catalog() }] }),
  component: Catalogo,
});

/** O catálogo e o gestor de parcerias (#65): itens, parceiros (freguesias propõem) e campanhas. */
function Catalogo() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const active: CatalogTab = tab ?? 'itens';

  return (
    <Page>
      <PageHeader
        eyebrow={m.catalog_eyebrow()}
        title={m.catalog_title()}
        description={m.catalog_page_description()}
      />
      <PageTabs<CatalogTab>
        label={m.catalog_tabs_label()}
        value={active}
        onValueChange={(next) =>
          void navigate({ search: { tab: next === 'itens' ? undefined : next }, replace: true })
        }
        tabs={[
          {
            id: 'itens',
            label: m.catalog_tab_items(),
            content: <CatalogItemsTable id="catalog-items" />,
          },
          {
            id: 'parceiros',
            label: m.catalog_tab_partners(),
            content: <PartnersTable id="catalog-partners" />,
          },
          {
            id: 'campanhas',
            label: m.catalog_tab_campaigns(),
            content: <CampaignsTable id="catalog-campaigns" />,
          },
        ]}
      />
    </Page>
  );
}
