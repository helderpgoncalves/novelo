import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2, MailCheck } from 'lucide-react';
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
import { getErrorMessage } from '@/lib/api-error';
import { FormAlert } from './form-alert';
import { type ForgotValues, forgotSchema } from './schemas';

export function ForgotForm() {
  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });
  const forgot = useMutation(forgotPasswordMutation());

  if (forgot.isSuccess) {
    return (
      <div role="status" className="space-y-3 rounded-xl border bg-card p-5">
        <MailCheck className="size-6 text-primary" aria-hidden="true" />
        <p className="font-medium">Verifica o teu email</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Se existir uma conta com{' '}
          <strong className="text-foreground">{form.getValues('email')}</strong>, enviámos um link
          para redefinires a password. O link expira em 60 minutos.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => forgot.mutate({ body: v }))}
        className="space-y-4"
        noValidate
      >
        <FormAlert message={forgot.isError ? getErrorMessage(forgot.error) : null} />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email da conta</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  className="h-10"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="h-10 w-full font-semibold" disabled={forgot.isPending}>
          {forgot.isPending && <Loader2 className="animate-spin" />}
          Enviar link de recuperação
        </Button>
      </form>
    </Form>
  );
}
