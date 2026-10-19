import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
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
import { getErrorMessage } from '@/lib/api-error';
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

  const register = useMutation({
    ...registerMutation(),
    onSuccess: async (user) => {
      queryClient.setQueryData(getMeQueryKey(), user);
      await navigate({ to: next });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) =>
          register.mutate({ body: { ...v, name: v.name || null } }),
        )}
        className="space-y-4"
        noValidate
      >
        <FormAlert message={register.isError ? getErrorMessage(register.error) : null} />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="name"
                  placeholder="Como te chamas?"
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
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="nome@organizacao.pt"
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
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput {...field} autoComplete="new-password" className="h-10" />
              </FormControl>
              <FormDescription>Pelo menos {PASSWORD_MIN} caracteres.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="h-10 w-full font-semibold" disabled={register.isPending}>
          {register.isPending && <Loader2 className="animate-spin" />}
          Criar conta
        </Button>
      </form>
    </Form>
  );
}
