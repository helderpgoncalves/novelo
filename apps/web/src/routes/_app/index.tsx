import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  getObservedFlowsOptions,
  getOverviewOptions,
  getTextileBaselineOptions,
  getWasteCompositionOptions,
  listZonesOptions,
} from '@/client/@tanstack/react-query.gen';
import { HOME_TABS, HomePage } from '@/features/home/home-page';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/')({
  staticData: { skeleton: 'home' },
  validateSearch: z.object({ tab: z.enum(HOME_TABS).optional().catch(undefined) }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(getOverviewOptions()),
      queryClient.ensureQueryData(getTextileBaselineOptions()),
      queryClient.ensureQueryData(getObservedFlowsOptions()),
      queryClient.ensureQueryData(getWasteCompositionOptions()),
      queryClient.ensureQueryData(listZonesOptions()),
    ]),
  head: () => ({ meta: [{ title: m.home_title() }] }),
  component: Home,
});

function Home() {
  const { tab = 'entities' } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <HomePage
      tab={tab}
      onTabChange={(next) => void navigate({ search: { tab: next }, replace: true })}
    />
  );
}
