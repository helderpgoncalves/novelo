import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { getMeQueryKey, registerMutation } from '@/client/@tanstack/react-query.gen';
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
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';
import { applyApiFieldErrors } from '@/lib/form-errors';
import { getLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { FormAlert } from './form-alert';
import { PasswordInput } from './password-input';
import { PASSWORD_MIN, type RegisterValues, registerSchema } from './schemas';

export function RegisterForm({ next }: { next: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const [fieldError, setFieldError] = useState(false);
  const register = useMutation({
    ...registerMutation(),
    onMutate: () => setFieldError(false),
    onError: (error) => setFieldError(applyApiFieldErrors(form, error, { email_taken: 'email' })),
    onSuccess: async (user) => {
      queryClient.setQueryData(getMeQueryKey(), user);
      await navigate({ to: next });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) =>
          register.mutate({ body: { ...v, name: v.name || null, locale: getLocale() } }),
        )}
        className="space-y-4"
        noValidate
      >
        <FormAlert
          message={register.isError && !fieldError ? getErrorMessage(register.error) : null}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.register_name()}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="name"
                  placeholder={m.register_name_placeholder()}
                  className="h-10"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.login_email()}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder={m.login_email_placeholder()}
                  className="h-10"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.login_password()}</FormLabel>
              <FormControl>
                <PasswordInput {...field} autoComplete="new-password" className="h-10" />
              </FormControl>
              <FormDescription>{m.register_password_hint({ min: PASSWORD_MIN })}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="h-10 w-full font-semibold"
          disabled={register.isPending}
          loading={register.isPending}
        >
          {m.register_submit()}
        </Button>
      </form>
    </Form>
  );
}
