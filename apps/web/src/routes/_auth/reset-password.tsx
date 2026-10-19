import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';
import { EmptyState } from '@/components/states';
import { ResetForm } from '@/features/auth/reset-form';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: z.object({ token: z.string().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: m.title_reset() }] }),
  component: ResetPage,
});

function ResetPage() {
  const { token } = Route.useSearch();
  if (!token) {
    return (
      <EmptyState
        title={m.reset_invalid_title()}
        description={m.reset_invalid_text()}
        action={
          <Link to="/forgot-password" className="font-medium text-primary text-sm hover:underline">
            {m.reset_request_new()}
          </Link>
        }
      />
    );
  }
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl">{m.reset_title()}</h1>
        <p className="text-muted-foreground text-sm">{m.reset_subtitle()}</p>
      </div>
      <ResetForm token={token} />
    </div>
  );
}
