import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { getSharedCopilotThreadOptions } from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { AssistantMessage, UserMessage } from '@/features/copilot/message';
import { fromServer } from '@/features/copilot/reducer';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/chat_/shared/$token')({
  head: () => ({ meta: [{ title: m.title_chat() }] }),
  component: SharedChat,
});

function SharedChat() {
  const { token } = Route.useParams();
  const { data, isPending, error, refetch } = useQuery(
    getSharedCopilotThreadOptions({ path: { token } }),
  );
  if (isPending) {
    return (
      <p role="status" className="py-16 text-center text-muted-foreground text-sm">
        {m.chat_opening()}
      </p>
    );
  }
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const messages = data.messages.map(fromServer);
  return (
    <Page>
      <PageHeader
        eyebrow={m.chat_shared_eyebrow()}
        title={data.title || m.chat_untitled()}
        description={m.chat_shared_description()}
        actions={
          <Button asChild variant="outline" className="h-10">
            <Link to="/chat">{m.chat_page_title()}</Link>
          </Button>
        }
      />
      <ol className="mx-auto max-w-3xl space-y-7" aria-label={data.title}>
        {messages.map((msg, i) =>
          msg.role === 'user' ? (
            <UserMessage key={msg.id} message={msg} />
          ) : (
            <AssistantMessage
              key={msg.id}
              message={msg}
              chat={null}
              last={i === messages.length - 1}
              status={null}
              onAsk={() => undefined}
            />
          ),
        )}
      </ol>
    </Page>
  );
}
