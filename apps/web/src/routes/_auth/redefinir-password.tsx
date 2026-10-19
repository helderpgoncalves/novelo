import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';
import { EmptyState } from '@/components/states';
import { ResetForm } from '@/features/auth/reset-form';

export const Route = createFileRoute('/_auth/redefinir-password')({
  validateSearch: z.object({ token: z.string().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: 'Redefinir password · Novelo' }] }),
  component: ResetPage,
});

function ResetPage() {
  const { token } = Route.useSearch();
  if (!token) {
    return (
      <EmptyState
        title="Link inválido"
        description="O link de recuperação está incompleto. Pede um novo."
        action={
          <Link
            to="/recuperar-password"
            className="font-medium text-primary text-sm hover:underline"
          >
            Pedir um novo link
          </Link>
        }
      />
    );
  }
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl">Nova password</h1>
        <p className="text-muted-foreground text-sm">
          Escolhe uma password que não uses noutros sítios.
        </p>
      </div>
      <ResetForm token={token} />
    </div>
  );
}
