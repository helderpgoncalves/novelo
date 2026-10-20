import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';
import { EmptyState } from '@/components/states';
import { AuthHeading, authLinkClass } from '@/features/auth/auth-ui';
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
          <Link to="/forgot-password" className={authLinkClass}>
            {m.reset_request_new()}
          </Link>
        }
      />
    );
  }
  return (
    <div className="space-y-6">
      <AuthHeading title={m.reset_title()} subtitle={m.reset_subtitle()} />
      <ResetForm token={token} />
    </div>
  );
}
