import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { AuthHeading } from '@/features/auth/auth-ui';
import { ForgotForm } from '@/features/auth/forgot-form';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_auth/forgot-password')({
  head: () => ({ meta: [{ title: m.title_forgot() }] }),
  component: () => (
    <div className="space-y-6">
      <AuthHeading title={m.forgot_title()} subtitle={m.forgot_subtitle()} />
      <ForgotForm />
      <Link
        to="/login"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-3.5" /> {m.forgot_back()}
      </Link>
    </div>
  ),
});
