import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { getMeQueryKey, loginMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { m } from '@/paraglide/messages';
import { FormAlert } from './form-alert';
import { PasswordInput } from './password-input';
import { type LoginValues, loginSchema } from './schemas';
import { useAutofillSync } from './use-autofill-sync';
import { useTurnstile } from './use-turnstile';

const AUTOFILL_FIELDS = ['email', 'password'] as const;

export function LoginForm({ next, initialEmail = '' }: { next: string; initialEmail?: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: initialEmail, password: '', remember_me: true },
  });

  const formRef = useRef<HTMLFormElement>(null);
  const syncAutofill = useAutofillSync(form, formRef, AUTOFILL_FIELDS);

  const gate = useTurnstile('login');
  const login = useMutation({
    ...loginMutation(),
    onSuccess: async (user) => {
      queryClient.setQueryData(getMeQueryKey(), user);
      await navigate(
        user.approval_status === 'approved' ? { to: next } : { to: '/pending-approval' },
      );
    },
  });

  return (
    <Form {...form}>
      <form
        ref={formRef}
        onSubmit={(e) => {
          syncAutofill();
          void form.handleSubmit((v) =>
            login.mutate({ body: v, headers: gate.consume() }, { onError: gate.onApiError }),
          )(e);
        }}
        className="space-y-4"
        noValidate
      >
        <FormAlert message={login.isError ? getErrorMessage(login.error) : null} />
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
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
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
              <div className="flex items-center justify-between">
                <FormLabel>{m.login_password()}</FormLabel>
                <Link to="/forgot-password" className="text-primary text-xs hover:underline">
                  {m.login_forgot()}
                </Link>
              </div>
              <FormControl>
                <PasswordInput {...field} autoComplete="current-password" className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="remember_me"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              </FormControl>
              <FormLabel className="font-normal text-muted-foreground">
                {m.login_remember()}
              </FormLabel>
            </FormItem>
          )}
        />
        {gate.field}
        <Button
          type="submit"
          className="h-10 w-full font-semibold"
          disabled={login.isPending || gate.blocked}
          loading={login.isPending}
        >
          {gate.verifying ? m.turnstile_verifying() : m.login_submit()}
        </Button>
      </form>
    </Form>
  );
}
