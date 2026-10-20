import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { SuppressionOut } from '@/client';
import {
  createEmailSuppressionMutation,
  deleteEmailSuppressionMutation,
  listEmailSuppressionsOptions,
} from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { EmptyState } from '@/components/states';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
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
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { invalidateAdminQueries } from './cache';
import { suppressionReason } from './email-logic';

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: () => m.validation_email_required() })
    .email({ error: () => m.validation_email_invalid() }),
});
type Values = z.infer<typeof schema>;

function AddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } });
  const add = useMutation({
    ...createEmailSuppressionMutation(),
    onSuccess: async (created) => {
      await invalidateAdminQueries(queryClient);
      toast.success(m.email_sup_added({ email: created.to_email }));
      form.reset();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{m.email_sup_add_title()}</DialogTitle>
          <DialogDescription>{m.email_sup_add_text()}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="space-y-4"
            onSubmit={form.handleSubmit((v) => add.mutate({ body: { email: v.email } }))}
          >
            <FormAlert message={add.isError ? getErrorMessage(add.error) : null} />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.email_sup_add_label()}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="h-10"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => onOpenChange(false)}
              >
                {m.common_cancel()}
              </Button>
              <Button type="submit" className="h-10 font-semibold" loading={add.isPending}>
                {m.email_sup_add()}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** Endereços que não recebem emails (devolvidos, spam ou bloqueio manual): ver, bloquear e remover o bloqueio. */
export function EmailSuppressions() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<SuppressionOut | null>(null);
  const list = useQuery(listEmailSuppressionsOptions());
  const rows = list.data?.items ?? [];

  const remove = useMutation({
    ...deleteEmailSuppressionMutation(),
    onSuccess: async () => {
      await invalidateAdminQueries(queryClient);
      toast.success(m.email_sup_removed({ email: removing?.to_email ?? '' }));
      setRemoving(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const columns: Column<SuppressionOut>[] = [
    {
      id: 'email',
      header: m.email_sup_col_email(),
      label: m.email_sup_col_email(),
      primary: true,
      value: (s) => s.to_email,
      cell: (s) => <span className="[overflow-wrap:anywhere] font-medium">{s.to_email}</span>,
    },
    {
      id: 'reason',
      header: m.email_sup_col_reason(),
      badge: true,
      value: (s) => s.reason,
      exportValue: (s) => suppressionReason(s.reason),
      filter: { format: (v) => suppressionReason(v as SuppressionOut['reason']) },
      cell: (s) => (
        <Badge variant={s.reason === 'manual' ? 'secondary' : 'outline'}>
          <Ban aria-hidden="true" />
          {suppressionReason(s.reason)}
        </Badge>
      ),
    },
    {
      id: 'created',
      type: 'datetime',
      header: m.email_sup_col_created(),
      className: 'text-muted-foreground',
      value: (s) => s.created_at,
      searchable: false,
      cell: (s) => formatDateTime(s.created_at),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-muted-foreground text-sm leading-relaxed">
          {m.email_sup_intro()}
        </p>
        <Button className="h-10 w-full font-semibold sm:w-auto" onClick={() => setAdding(true)}>
          <Ban aria-hidden="true" />
          {m.email_sup_add()}
        </Button>
      </div>
      <DataTable
        id="email-suppressions"
        exportName="emails-bloqueados"
        columns={columns}
        rows={rows}
        getRowId={(s) => s.id}
        caption={m.email_sup_title()}
        searchLabel={m.email_sup_search()}
        loading={list.isPending}
        refreshing={list.isFetching && !list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        initialSort={{ id: 'created', desc: true }}
        empty={
          <EmptyState title={m.email_sup_empty_title()} description={m.email_sup_empty_text()} />
        }
        rowActions={(s) => [
          {
            id: 'remove',
            label: m.email_sup_remove(),
            icon: <ShieldCheck />,
            onSelect: () => setRemoving(s),
          },
        ]}
      />
      <AddDialog open={adding} onOpenChange={setAdding} />
      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">
              {m.email_sup_remove_title({ email: removing?.to_email ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{m.email_sup_remove_text()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10">{m.common_cancel()}</AlertDialogCancel>
            <Button
              className="h-10 font-semibold"
              loading={remove.isPending}
              onClick={() => removing && remove.mutate({ path: { suppression_id: removing.id } })}
            >
              {m.email_sup_remove()}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
