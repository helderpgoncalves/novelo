import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { UserOut } from '@/client';
import { changePasswordMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { getErrorMessage } from '@/lib/api-error';
import { queryClient } from '@/lib/query-client';
import { FormAlert } from './form-alert';
import { PasswordInput } from './password-input';
import { type ChangePasswordValues, changePasswordSchema, PASSWORD_MIN } from './schemas';

export function ChangePasswordForm({ user }: { user: UserOut }) {
  const navigate = useNavigate();
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current: '', password: '', confirm: '' },
  });
  const change = useMutation({
    ...changePasswordMutation(),
    onSuccess: async () => {
      // O servidor termina todas as sessões ao mudar a password.
      toast.success('Password alterada. Entra de novo com a nova password.');
      queryClient.clear();
      await navigate({ to: '/entrar' });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => {
          if (user.has_password && !v.current)
            return form.setError('current', { message: 'Indica a password atual' });
          change.mutate({
            body: { current_password: v.current || null, new_password: v.password },
          });
        })}
        className="max-w-md space-y-4"
        noValidate
      >
        <FormAlert message={change.isError ? getErrorMessage(change.error) : null} />
        {user.has_password && (
          <FormField
            control={form.control}
            name="current"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password atual</FormLabel>
                <FormControl>
                  <PasswordInput {...field} autoComplete="current-password" className="h-10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{user.has_password ? 'Nova password' : 'Definir uma password'}</FormLabel>
              <FormControl>
                <PasswordInput {...field} autoComplete="new-password" className="h-10" />
              </FormControl>
              <FormDescription>Pelo menos {PASSWORD_MIN} caracteres.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Repete a nova password</FormLabel>
              <FormControl>
                <PasswordInput {...field} autoComplete="new-password" className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="h-10 font-semibold" disabled={change.isPending}>
          {change.isPending && <Loader2 className="animate-spin" />}
          Guardar password
        </Button>
      </form>
    </Form>
  );
}
