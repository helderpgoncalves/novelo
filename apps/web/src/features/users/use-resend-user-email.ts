import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { resendUserEmailMutation } from '@/client/@tanstack/react-query.gen';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';
import { invalidateAdminQueries } from './cache';
import { warningText } from './email-logic';

/** «Reenviar email» a uma conta (pedido recebido ou decisão): o resultado diz a verdade, com o motivo se falhar. */
export function useResendUserEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    ...resendUserEmailMutation(),
    onSuccess: async (user) => {
      await invalidateAdminQueries(queryClient);
      if (user.email_warning) toast.warning(warningText(user.email_warning));
      else toast.success(m.email_warning_resent({ email: user.email }));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
