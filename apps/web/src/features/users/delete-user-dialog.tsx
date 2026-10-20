import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import type { UserAdminOut } from '@/client';
import { deleteUserMutation } from '@/client/@tanstack/react-query.gen';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';
import { AccountChip } from './account-chip';
import { blockerText } from './blocker-text';
import { invalidateAdminQueries } from './cache';
import { type Blocker, deleteBlocker, displayName, emailMatches } from './logic';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserAdminOut | null;
  users: UserAdminOut[];
  selfId: string;
}

/**
 * Eliminar é permanente: o diálogo diz o que se apaga e o que fica anonimizado, e só liberta o botão quando se
 * escreve o email da conta (a API volta a conferir). Para si próprio ou o último administrador explica porquê.
 */
export function DeleteUserDialog({ open, onOpenChange, user, users, selfId }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {user && (
          <DeleteBody
            user={user}
            blocker={deleteBlocker(user, users, selfId)}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteBody({
  user,
  blocker,
  onDone,
}: {
  user: UserAdminOut;
  blocker: Blocker | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const remove = useMutation({
    ...deleteUserMutation(),
    onSuccess: async () => {
      await invalidateAdminQueries(queryClient);
      toast.success(m.users_deleted());
      onDone();
    },
  });
  const matches = emailMatches(typed, user.email);
  const name = displayName(user);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="break-words font-serif text-xl">
          {m.users_delete_title({ name })}
        </DialogTitle>
        <DialogDescription>{m.users_delete_intro()}</DialogDescription>
      </DialogHeader>
      <AccountChip user={user} size="md" />
      {blocker ? (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>{m.users_delete_blocked_title()}</AlertTitle>
          <AlertDescription>{blockerText(blocker)}</AlertDescription>
        </Alert>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (matches)
              remove.mutate({ path: { user_id: user.id }, body: { confirm_email: typed } });
          }}
        >
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="font-medium">{m.users_delete_removes_title()}</p>
              <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                <li>{m.users_delete_item_account()}</li>
                <li>{m.users_delete_item_copilot()}</li>
                <li>{m.users_delete_item_invites()}</li>
              </ul>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium">{m.users_delete_anon_title()}</p>
              <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                <li>{m.users_delete_item_records()}</li>
                <li>{m.users_delete_item_audit()}</li>
              </ul>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={inputId} className="block leading-snug">
              {m.users_delete_confirm_label({ email: user.email })}
            </Label>
            <Input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={m.users_delete_confirm_placeholder()}
              className="h-10"
              aria-invalid={typed.length > 0 && !matches ? true : undefined}
            />
          </div>
          <FormAlert message={remove.isError ? getErrorMessage(remove.error) : null} />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10" onClick={onDone}>
              {m.common_cancel()}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="h-10 font-semibold"
              disabled={!matches}
              loading={remove.isPending}
            >
              {m.users_delete_submit()}
            </Button>
          </DialogFooter>
        </form>
      )}
      {blocker && (
        <DialogFooter>
          <Button type="button" variant="outline" className="h-10" onClick={onDone}>
            {m.common_close()}
          </Button>
        </DialogFooter>
      )}
    </>
  );
}
