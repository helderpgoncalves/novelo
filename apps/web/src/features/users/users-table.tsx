import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { UserAdminOut } from '@/client';
import { listUsersQueryKey, updateUserMutation } from '@/client/@tanstack/react-query.gen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getErrorMessage } from '@/lib/api-error';

const dateFormat = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' });

export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserAdminOut[];
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const update = useMutation({
    ...updateUserMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listUsersQueryKey() });
      toast.success('Conta atualizada');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 px-4">Utilizador</TableHead>
            <TableHead className="h-10">Perfil</TableHead>
            <TableHead className="h-10">Estado</TableHead>
            <TableHead className="h-10">Último acesso</TableHead>
            <TableHead className="h-10 pr-4 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            const self = u.id === currentUserId;
            return (
              <TableRow key={u.id}>
                <TableCell className="px-4">
                  <p className="font-medium">{u.name ?? u.email}</p>
                  <p className="text-muted-foreground text-xs">
                    {u.name && `${u.email} · `}
                    {u.email_verified ? 'email confirmado' : 'email por confirmar'}
                    {u.google_linked && ' · Google'}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                    {u.role === 'admin' ? 'Administrador' : 'Operador'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? 'outline' : 'destructive'}>
                    {u.is_active ? 'Ativa' : 'Desativada'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {u.last_login_at ? dateFormat.format(new Date(u.last_login_at)) : 'Nunca'}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={self || update.isPending}
                      onClick={() =>
                        update.mutate({
                          path: { user_id: u.id },
                          body: { role: u.role === 'admin' ? 'operator' : 'admin' },
                        })
                      }
                    >
                      {u.role === 'admin' ? 'Tornar operador' : 'Tornar administrador'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={self || update.isPending}
                      onClick={() =>
                        update.mutate({
                          path: { user_id: u.id },
                          body: { is_active: !u.is_active },
                        })
                      }
                    >
                      {u.is_active ? 'Desativar' : 'Reativar'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
