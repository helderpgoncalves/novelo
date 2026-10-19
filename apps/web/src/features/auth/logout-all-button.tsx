import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Loader2, MonitorOff } from 'lucide-react';
import { toast } from 'sonner';
import { logoutAllMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { queryClient } from '@/lib/query-client';
import { m } from '@/paraglide/messages';

export function LogoutAllButton() {
  const navigate = useNavigate();
  const logoutAll = useMutation({
    ...logoutAllMutation(),
    onSuccess: async () => {
      queryClient.clear();
      toast.success(m.account_logout_all_done());
      await navigate({ to: '/login' });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <Button
      variant="outline"
      className="h-10 gap-2"
      onClick={() => logoutAll.mutate({})}
      disabled={logoutAll.isPending}
    >
      {logoutAll.isPending ? <Loader2 className="animate-spin" /> : <MonitorOff />}
      {m.account_logout_all()}
    </Button>
  );
}
