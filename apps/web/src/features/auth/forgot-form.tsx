import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { forgotPasswordMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';
import { getLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { AUTH_CONTROL, AUTH_CTA, AUTH_FIELDS } from './auth-ui';
import { FormAlert } from './form-alert';
import { type ForgotValues, forgotSchema } from './schemas';
import { useTurnstile } from './use-turnstile';

export function ForgotForm() {
  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });
  const gate = useTurnstile('forgot_password');
  const forgot = useMutation(forgotPasswordMutation());

  if (forgot.isSuccess) {
    return (
      <div role="status" className="space-y-3 rounded-xl border bg-card p-5">
        <MailCheck className="size-6 text-primary" aria-hidden="true" />
        <p className="font-medium">{m.forgot_sent_title()}</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {m.forgot_sent_text({ email: form.getValues('email') })}
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) =>
          forgot.mutate(
            { body: { ...v, locale: getLocale() }, headers: gate.consume() },
            { onError: gate.onApiError },
          ),
        )}
        className={AUTH_FIELDS}
        noValidate
      >
        <FormAlert message={forgot.isError ? getErrorMessage(forgot.error) : null} />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{m.forgot_email()}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  className={AUTH_CONTROL}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {gate.field}
        <Button
          type="submit"
          className={AUTH_CTA}
          disabled={forgot.isPending || gate.blocked}
          loading={forgot.isPending || gate.busy}
        >
          {m.forgot_submit()}
        </Button>
      </form>
    </Form>
  );
}
