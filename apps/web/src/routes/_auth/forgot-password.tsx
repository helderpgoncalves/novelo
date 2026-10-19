import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { ForgotForm } from '@/features/auth/forgot-form';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_auth/forgot-password')({
  head: () => ({ meta: [{ title: m.title_forgot() }] }),
  component: () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl">{m.forgot_title()}</h1>
        <p className="text-muted-foreground text-sm">{m.forgot_subtitle()}</p>
      </div>
      <ForgotForm />
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {m.forgot_back()}
      </Link>
    </div>
  ),
});
