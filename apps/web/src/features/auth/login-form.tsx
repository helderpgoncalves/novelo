import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
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
import { getErrorMessage } from '@/lib/api-error';
import { FormAlert } from './form-alert';
import { PasswordInput } from './password-input';
import { type LoginValues, loginSchema } from './schemas';

export function LoginForm({ next }: { next: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember_me: true },
  });

  const login = useMutation({
    ...loginMutation(),
    onSuccess: async (user) => {
      queryClient.setQueryData(getMeQueryKey(), user);
      await navigate({ to: next });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => login.mutate({ body: v }))}
        className="space-y-4"
        noValidate
      >
        <FormAlert message={login.isError ? getErrorMessage(login.error) : null} />
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
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link to="/recuperar-password" className="text-primary text-xs hover:underline">
                  Esqueceste-te?
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
                Manter sessão iniciada neste dispositivo
              </FormLabel>
            </FormItem>
          )}
        />
        <Button type="submit" className="h-10 w-full font-semibold" disabled={login.isPending}>
          {login.isPending && <Loader2 className="animate-spin" />}
          Entrar
        </Button>
      </form>
    </Form>
  );
}
