import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { UserOut } from '@/client';
import { getMeQueryKey, updateMeMutation } from '@/client/@tanstack/react-query.gen';
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
import { type ProfileValues, profileSchema } from './schemas';

export function ProfileForm({ user }: { user: UserOut }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name ?? '' },
  });
  const update = useMutation({
    ...updateMeMutation(),
    onSuccess: async (updated) => {
      queryClient.setQueryData(getMeQueryKey(), updated);
      form.reset({ name: updated.name ?? '' });
      await router.invalidate();
      toast.success('Perfil atualizado');
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => update.mutate({ body: { name: v.name || null } }))}
        className="max-w-md space-y-4"
        noValidate
      >
        <FormAlert message={update.isError ? getErrorMessage(update.error) : null} />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input {...field} autoComplete="name" className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-1.5">
          <p className="font-medium text-sm">Email</p>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </div>
        <Button
          type="submit"
          className="h-10 font-semibold"
          disabled={update.isPending || !form.formState.isDirty}
        >
          {update.isPending && <Loader2 className="animate-spin" />}
          Guardar perfil
        </Button>
      </form>
    </Form>
  );
}
