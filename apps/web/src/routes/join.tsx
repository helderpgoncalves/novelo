import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getMeOptions, getQuickJoinInfoOptions } from '@/client/@tanstack/react-query.gen';
import { JoinPage } from '@/features/join/join-page';
import { m } from '@/paraglide/messages';

// Página pública que o QR do evento abre: `/join?c=<código>`.
export const Route = createFileRoute('/join')({
  validateSearch: z.object({ c: z.string().max(128).optional().catch(undefined) }),
  loader: async ({ context: { queryClient } }) => {
    const [info, me] = await Promise.all([
      queryClient.ensureQueryData(getQuickJoinInfoOptions()).catch(() => null),
      queryClient
        .fetchQuery({ ...getMeOptions(), staleTime: 30_000, retry: false })
        .catch(() => null),
    ]);
    return { enabled: info?.enabled ?? false, user: me };
  },
  head: () => ({
    meta: [{ title: m.title_join() }, { name: 'referrer', content: 'no-referrer' }],
  }),
  component: JoinRoute,
});

function JoinRoute() {
  const { c } = Route.useSearch();
  const { enabled, user } = Route.useLoaderData();
  return <JoinPage code={c} enabled={enabled} user={user} />;
}
