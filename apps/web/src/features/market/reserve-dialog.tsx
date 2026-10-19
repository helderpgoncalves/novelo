import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getFibreMarketQueryKey, reserveLotMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';

const schema = z.object({
  recycler_name: z
    .string()
    .trim()
    .min(2, { error: () => m.validation_name_required() })
    .max(120),
  contact: z
    .string()
    .trim()
    .min(3, { error: () => m.validation_contact_required() })
    .max(160),
  note: z.string().trim().max(500).optional(),
});
type Values = z.infer<typeof schema>;

export function ReserveDialog({
  code,
  open,
  onOpenChange,
}: {
  code: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { recycler_name: '', contact: '', note: '' },
  });
  const reserve = useMutation({
    ...reserveLotMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getFibreMarketQueryKey() });
      toast.success(m.market_reserved());
      form.reset();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.market_reserve_title({ code: code ?? '' })}</DialogTitle>
          <DialogDescription>{m.market_reserve_description()}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            noValidate
            onSubmit={form.handleSubmit(
              (v) =>
                code && reserve.mutate({ path: { code }, body: { ...v, note: v.note || null } }),
            )}
          >
            <FormAlert message={reserve.isError ? getErrorMessage(reserve.error) : null} />
            <FormField
              control={form.control}
              name="recycler_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.market_recycler()}</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-10" autoComplete="organization" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.market_contact()}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="h-10"
                      autoComplete="email"
                      placeholder={m.market_contact_placeholder()}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.market_note()}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} maxLength={500} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {m.common_cancel()}
              </Button>
              <Button type="submit" disabled={reserve.isPending}>
                {reserve.isPending && <Loader2 className="animate-spin" />}
                {m.market_reserve()}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
