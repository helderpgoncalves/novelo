import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ChatPage } from '@/features/copilot/chat-page';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/chat')({
  staticData: { fullBleed: true },
  validateSearch: z.object({
    thread: z.string().optional().catch(undefined),
    tab: z.enum(['history', 'artifacts', 'actions', 'settings']).optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: m.title_chat() }] }),
  pendingComponent: ChatPending,
  component: Chat,
});

// Sem esqueletos no copiloto: uma frase simples enquanto o código da página chega.
function ChatPending() {
  return (
    <p role="status" className="p-8 text-center text-muted-foreground text-sm">
      {m.chat_route_loading()}
    </p>
  );
}

function Chat() {
  const { user } = Route.useRouteContext();
  const { thread, tab } = Route.useSearch();
  return <ChatPage thread={thread ?? null} tab={tab ?? 'chat'} isAdmin={user.role === 'admin'} />;
}
