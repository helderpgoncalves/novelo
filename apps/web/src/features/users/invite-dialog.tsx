import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { InvitationOut } from '@/client';
import { createInvitationMutation } from '@/client/@tanstack/react-query.gen';
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
import { applyApiFieldErrors } from '@/lib/form-errors';
import { getLocale, LOCALE_LABELS, type Locale, locales } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { invalidateAdminQueries } from './cache';
import { ConfirmCheck } from './confirm-check';
import { InviteResult } from './invite-result';
import { INVITE_MESSAGE_MAX, needsAdminConfirm, type Role } from './logic';
import { RolePicker } from './role-picker';

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: () => m.validation_email_required() })
    .email({ error: () => m.validation_email_invalid() }),
  name: z
    .string()
    .trim()
    .max(120, { error: () => m.validation_name_max() }),
  message: z.string().max(INVITE_MESSAGE_MAX),
});
type Values = z.infer<typeof schema>;

export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <InviteBody onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function InviteBody({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role>('operator');
  const [confirmAdmin, setConfirmAdmin] = useState(false);
  const [locale, setLocale] = useState<Locale>(getLocale());
  const [fieldError, setFieldError] = useState(false);
  const [result, setResult] = useState<InvitationOut | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', name: '', message: '' },
  });
  const message = form.watch('message');

  const create = useMutation({
    ...createInvitationMutation(),
    onMutate: () => setFieldError(false),
    onError: (error) =>
      setFieldError(
        applyApiFieldErrors(form, error, { email_taken: 'email', invitation_pending: 'email' }),
      ),
    onSuccess: async (invitation: InvitationOut) => {
      await invalidateAdminQueries(queryClient);
      // O diálogo fica aberto com o estado real do envio (enviado ou não) e as saídas se falhou.
      setResult(invitation);
    },
  });
  const ready = !needsAdminConfirm(role) || confirmAdmin;

  if (result) return <InviteResult invitation={result} onClose={onClose} />;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{m.invite_title()}</DialogTitle>
        <DialogDescription>{m.invite_description()}</DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((v) => {
            if (!ready) return;
            create.mutate({
              body: {
                email: v.email,
                name: v.name || null,
                message: v.message.trim() || null,
                role,
                locale,
                confirm_admin: needsAdminConfirm(role) ? confirmAdmin : undefined,
              },
            });
          })}
        >
          <FormAlert
            message={create.isError && !fieldError ? getErrorMessage(create.error) : null}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.invite_email()}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    autoCapitalize="none"
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.invite_name()}</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" className="h-10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <RolePicker
            value={role}
            onChange={(next) => {
              setRole(next);
              setConfirmAdmin(false);
            }}
            legend={m.invite_role()}
          />
          {needsAdminConfirm(role) && (
            <ConfirmCheck checked={confirmAdmin} onChange={setConfirmAdmin}>
              {m.invite_admin_confirm()}
            </ConfirmCheck>
          )}
          <fieldset className="space-y-2">
            <legend className="font-medium text-sm">{m.invite_locale()}</legend>
            <div className="flex gap-2">
              {locales.map((l: Locale) => (
                <Button
                  key={l}
                  type="button"
                  lang={l}
                  variant={locale === l ? 'default' : 'outline'}
                  className="h-10"
                  aria-pressed={locale === l}
                  onClick={() => setLocale(l)}
                >
                  {LOCALE_LABELS[l]}
                </Button>
              ))}
            </div>
          </fieldset>
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.invite_message()}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={3}
                    maxLength={INVITE_MESSAGE_MAX}
                    placeholder={m.invite_message_placeholder()}
                    className="min-h-20"
                  />
                </FormControl>
                <p className="text-muted-foreground text-xs">
                  {m.invite_message_hint({ count: message.length, max: INVITE_MESSAGE_MAX })}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10" onClick={onClose}>
              {m.common_cancel()}
            </Button>
            <Button
              type="submit"
              className="h-10 font-semibold"
              disabled={!ready}
              loading={create.isPending}
            >
              {m.invite_submit()}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
