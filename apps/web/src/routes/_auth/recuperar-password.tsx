import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { ForgotForm } from '@/features/auth/forgot-form';

export const Route = createFileRoute('/_auth/recuperar-password')({
  head: () => ({ meta: [{ title: 'Recuperar password · Novelo' }] }),
  component: () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl">Recuperar a password</h1>
        <p className="text-muted-foreground text-sm">
          Indica o email da tua conta e enviamos-te um link para criares uma nova password.
        </p>
      </div>
      <ForgotForm />
      <Link
        to="/entrar"
        className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Voltar à entrada
      </Link>
    </div>
  ),
});
