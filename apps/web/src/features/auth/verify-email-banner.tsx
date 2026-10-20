import { useMutation } from '@tanstack/react-query';
import { MailWarning } from 'lucide-react';
import { toast } from 'sonner';
import type { UserOut } from '@/client';
import { resendVerificationMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { useImpersonation } from '@/features/impersonation/use-impersonation';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';

/** Lembra o utilizador de confirmar o email e permite reenviar o link. */
export function VerifyEmailBanner({ user }: { user: UserOut }) {
  const imp = useImpersonation();
  const resend = useMutation({
    ...resendVerificationMutation(),
    onSuccess: () => toast.success(m.verify_resend_toast({ email: user.email })),
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  // Convidados entram por QR com o email que escreveram: pedir-lhes confirmação só seria ruído.
  // Durante uma impersonação o reenvio é bloqueado pela API: o aviso não é para quem está só a ver.
  if (user.email_verified || user.role === 'guest' || imp.active) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-areia/40 border-b bg-areia/15 px-4 py-2.5 text-sm sm:px-6 lg:px-8"
    >
      <MailWarning className="size-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">{m.verify_banner_text({ email: user.email })}</p>
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={() => resend.mutate({})}
        disabled={resend.isPending}
        loading={resend.isPending}
      >
        {m.verify_banner_resend()}
      </Button>
    </div>
  );
}
