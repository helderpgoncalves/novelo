import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AcceptInvitePage } from '@/features/invitations/accept-invite-page';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/accept-invite')({
  // O token só vive no URL até ser lido: a página tira-o de lá (ver `AcceptInvitePage`).
  validateSearch: z.object({ token: z.string().optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: m.title_accept_invite() },
      { name: 'referrer', content: 'no-referrer' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AcceptInviteRoute,
});

function AcceptInviteRoute() {
  const { token } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AcceptInvitePage
      urlToken={token}
      clearToken={() => void navigate({ search: {}, replace: true })}
    />
  );
}
