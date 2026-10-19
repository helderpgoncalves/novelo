import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
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
import { getErrorMessage } from '@/lib/api-error';
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
      toast.success('Password redefinida. Já podes entrar.');
      await navigate({ to: '/entrar' });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => reset.mutate({ body: { token, password: v.password } }))}
        className="space-y-4"
        noValidate
      >
        <FormAlert message={reset.isError ? getErrorMessage(reset.error) : null} />
        {reset.isError && (
          <p className="text-sm">
            <Link to="/recuperar-password" className="text-primary hover:underline">
              Pedir um novo link
            </Link>
          </p>
        )}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nova password</FormLabel>
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
              <FormLabel>Repete a password</FormLabel>
              <FormControl>
                <PasswordInput {...field} autoComplete="new-password" className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="h-10 w-full font-semibold" disabled={reset.isPending}>
          {reset.isPending && <Loader2 className="animate-spin" />}
          Redefinir password
        </Button>
      </form>
    </Form>
  );
}
