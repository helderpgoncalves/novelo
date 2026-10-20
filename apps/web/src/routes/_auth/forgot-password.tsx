import { createFileRoute } from '@tanstack/react-router';
import { ForgotFlow } from '@/features/auth/forgot-form';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_auth/forgot-password')({
  head: () => ({ meta: [{ title: m.title_forgot() }] }),
  component: ForgotFlow,
});
