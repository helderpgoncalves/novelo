import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Loader2, MonitorOff } from 'lucide-react';
import { toast } from 'sonner';
import { logoutAllMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api-error';
import { queryClient } from '@/lib/query-client';

export function LogoutAllButton() {
  const navigate = useNavigate();
  const logoutAll = useMutation({
    ...logoutAllMutation(),
    onSuccess: async () => {
      queryClient.clear();
      toast.success('Sessão terminada em todos os dispositivos.');
      await navigate({ to: '/entrar' });
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
      Terminar sessão em todos os dispositivos
    </Button>
  );
}
