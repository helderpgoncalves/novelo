import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { MagicLinkPage } from '@/features/auth/magic-link-page';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/magic-link')({
  // O token só vive no URL até ser lido: a página tira-o de lá (ver `MagicLinkPage`).
  validateSearch: z.object({ token: z.string().optional().catch(undefined) }),
  head: () => ({
    meta: [{ title: m.title_magic_link() }, { name: 'referrer', content: 'no-referrer' }],
  }),
  component: MagicLinkRoute,
});

function MagicLinkRoute() {
  const { token } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <MagicLinkPage
      urlToken={token}
      clearToken={() => void navigate({ search: {}, replace: true })}
    />
  );
}
