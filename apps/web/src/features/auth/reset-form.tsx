import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { resetPasswordMutation } from '@/client/@tanstack/react-query.gen';
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
import { m } from '@/paraglide/messages';
import { AUTH_CONTROL, AUTH_CTA, AUTH_FIELDS, authLinkClass } from './auth-ui';
import { FormAlert } from './form-alert';
import { PasswordInput } from './password-input';
import { PASSWORD_MIN, type ResetValues, resetSchema } from './schemas';

export function ResetForm({ token }: { token: string }) {
  const navigate = useNavigate();
  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
  });
  const reset = useMutation({
    ...resetPasswordMutation(),
    onSuccess: async () => {
      toast.success(m.reset_success());
      await navigate({ to: '/login' });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => reset.mutate({ body: { token, password: v.password } }))}
        className={AUTH_FIELDS}
        noValidate
      >
        <FormAlert message={reset.isError ? getErrorMessage(reset.error) : null} />
        {reset.isError && (
          <p className="-mt-3 text-sm">
            <Link to="/forgot-password" className={authLinkClass}>
              {m.reset_request_new()}
            </Link>
          </p>
        )}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.reset_password()}</FormLabel>
              <FormControl>
                <PasswordInput {...field} autoComplete="new-password" className={AUTH_CONTROL} />
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
              <FormLabel>{m.reset_confirm()}</FormLabel>
              <FormControl>
                <PasswordInput {...field} autoComplete="new-password" className={AUTH_CONTROL} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className={AUTH_CTA}
          disabled={reset.isPending}
          loading={reset.isPending}
        >
          {m.reset_submit()}
        </Button>
      </form>
    </Form>
  );
}
