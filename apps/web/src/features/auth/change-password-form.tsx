import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
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
import { getErrorMessage } from '@/lib/errors';
import { applyApiFieldErrors } from '@/lib/form-errors';
import { queryClient } from '@/lib/query-client';
import { m } from '@/paraglide/messages';
import { FormAlert } from './form-alert';
import { PasswordInput } from './password-input';
import { type ChangePasswordValues, changePasswordSchema, PASSWORD_MIN } from './schemas';

export function ChangePasswordForm({ user }: { user: UserOut }) {
  const navigate = useNavigate();
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current: '', password: '', confirm: '' },
  });
  const [fieldError, setFieldError] = useState(false);
  const change = useMutation({
    ...changePasswordMutation(),
    onMutate: () => setFieldError(false),
    onError: (error) =>
      setFieldError(applyApiFieldErrors(form, error, { current_password_incorrect: 'current' })),
    onSuccess: async () => {
      // O servidor termina todas as sessões ao mudar a password.
      toast.success(m.account_password_changed());
      queryClient.clear();
      await navigate({ to: '/login' });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => {
          if (user.has_password && !v.current)
            return form.setError('current', { message: m.validation_current_required() });
          change.mutate({
            body: { current_password: v.current || null, new_password: v.password },
          });
        })}
        className="max-w-md space-y-4"
        noValidate
      >
        <FormAlert message={change.isError && !fieldError ? getErrorMessage(change.error) : null} />
        {user.has_password && (
          <FormField
            control={form.control}
            name="current"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.account_current_password()}</FormLabel>
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
              <FormLabel>
                {user.has_password ? m.account_new_password() : m.account_set_password()}
              </FormLabel>
              <FormControl>
                <PasswordInput {...field} autoComplete="new-password" className="h-10" />
              </FormControl>
              <FormDescription>{m.register_password_hint({ min: PASSWORD_MIN })}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.account_repeat_password()}</FormLabel>
              <FormControl>
                <PasswordInput {...field} autoComplete="new-password" className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="h-10 font-semibold"
          disabled={change.isPending}
          loading={change.isPending}
        >
          {m.account_save_password()}
        </Button>
      </form>
    </Form>
  );
}
