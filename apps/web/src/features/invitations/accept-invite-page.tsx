import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Loader2, MailX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { InvitationPreview } from '@/client';
import {
  acceptInvitationMutation,
  getMeQueryKey,
  previewInvitationMutation,
} from '@/client/@tanstack/react-query.gen';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
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
import { FormAlert } from '@/features/auth/form-alert';
import { PasswordInput } from '@/features/auth/password-input';
import { safeNext } from '@/features/auth/passwordless';
import { PASSWORD_MIN } from '@/features/auth/schemas';
import { HoneypotField, useTurnstile } from '@/features/auth/use-turnstile';
import { markTourPending } from '@/features/onboarding/tour-store';
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { applyApiFieldErrors } from '@/lib/form-errors';
import { mailtoLink } from '@/lib/support';
import { m } from '@/paraglide/messages';
import { forgetToken, readToken } from './invite-token';

const roleLabel = (role: InvitationPreview['role']) =>
  role === 'admin'
    ? m.account_role_admin()
    : role === 'guest'
      ? m.account_role_guest()
      : m.account_role_operator();

// Mensagens como funções: avaliadas na validação, no idioma ativo. A password é opcional, mas se vier tem regras.
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: () => m.inv_name_required() })
    .max(120, { error: () => m.validation_name_max() }),
  password: z
    .string()
    .refine((v) => v === '' || v.length >= PASSWORD_MIN, {
      error: () => m.validation_password_min({ min: PASSWORD_MIN }),
    })
    .refine((v) => v.length <= 128, { error: () => m.validation_password_max() })
    .refine((v) => v.trim() === v, { error: () => m.validation_password_spaces() }),
});
type Values = z.infer<typeof schema>;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <BrandLogo className="h-8" />
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-col justify-center py-10">{children}</main>
    </div>
  );
}

/**
 * Destino do link do convite. Mostra quem convidou e com que perfil, pede o nome (e uma password opcional) e entra
 * logo. Todos os convites inválidos (expirado, revogado, usado, incompleto) respondem o mesmo: a API não distingue
 * de propósito, para ninguém poder sondar emails.
 */
export function AcceptInvitePage({
  urlToken,
  clearToken,
}: {
  urlToken: string | undefined;
  clearToken: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const token = useRef<string | null>(null);
  const started = useRef(false);
  const preview = useMutation(previewInvitationMutation());
  const { mutate: loadPreview } = preview;

  const load = useCallback(() => {
    if (token.current) loadPreview({ body: { token: token.current } });
  }, [loadPreview]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    token.current = readToken(urlToken);
    if (urlToken) clearToken();
    load();
  }, [urlToken, clearToken, load]);

  const code = getErrorCode(preview.error);
  const invalid = !token.current
    ? started.current
    : preview.isError && (code === 'invalid_token' || code === 'validation_error');

  if (preview.data && token.current) {
    return (
      <Shell>
        <AcceptForm
          preview={preview.data}
          token={token.current}
          onSignedIn={async (user, next) => {
            forgetToken();
            queryClient.clear();
            queryClient.setQueryData(getMeQueryKey(), user);
            markTourPending();
            toast.success(m.inv_welcome({ name: user.name ?? user.email }));
            await navigate({
              to: user.approval_status === 'approved' ? safeNext(next) : '/pending-approval',
              replace: true,
            });
          }}
          onInvalid={() => {
            forgetToken();
            token.current = null;
            preview.reset();
          }}
        />
      </Shell>
    );
  }

  if (invalid || (started.current && !token.current)) {
    return (
      <Shell>
        <InvalidInvite />
      </Shell>
    );
  }

  if (preview.isError) {
    return (
      <Shell>
        <div className="space-y-5 text-center" role="alert">
          <h1 className="text-2xl">{m.err_inline_title_offline()}</h1>
          <p className="text-muted-foreground text-sm">{getErrorMessage(preview.error)}</p>
          <Button className="h-11 w-full font-semibold" onClick={load} loading={preview.isPending}>
            {m.common_retry()}
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div role="status" aria-live="polite" className="space-y-4 text-center">
        <Loader2
          className="mx-auto size-8 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p className="font-medium">{m.inv_loading()}</p>
      </div>
    </Shell>
  );
}

function InvalidInvite() {
  return (
    <div
      className="motion-safe:fade-in-0 motion-safe:animate-in space-y-6 duration-300"
      data-testid="invite-invalid"
    >
      <div className="space-y-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-areia/25 text-foreground">
          <MailX className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-3xl">{m.inv_invalid_title()}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">{m.inv_invalid_text()}</p>
        <p className="text-muted-foreground text-sm leading-relaxed">{m.inv_invalid_login()}</p>
      </div>
      <div className="space-y-2">
        <Button asChild className="h-11 w-full font-semibold">
          <Link to="/login">{m.inv_go_login()}</Link>
        </Button>
        <Button asChild variant="ghost" className="h-11 w-full">
          <a href={mailtoLink(m.inv_contact_subject(), m.inv_contact_body())}>{m.inv_contact()}</a>
        </Button>
      </div>
    </div>
  );
}

function AcceptForm({
  preview,
  token,
  onSignedIn,
  onInvalid,
}: {
  preview: InvitationPreview;
  token: string;
  onSignedIn: (user: import('@/client').UserOut, next: string) => Promise<void>;
  onInvalid: () => void;
}) {
  const gate = useTurnstile('accept_invitation');
  const [fieldError, setFieldError] = useState(false);
  const [withPassword, setWithPassword] = useState(true);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: preview.name ?? '', password: '' },
  });
  const accept = useMutation({
    ...acceptInvitationMutation(),
    onMutate: () => setFieldError(false),
    onError: (error) => {
      gate.onApiError(error);
      if (getErrorCode(error) === 'invalid_token') onInvalid();
      else setFieldError(applyApiFieldErrors(form, error, {}));
    },
    onSuccess: ({ user, next }) => onSignedIn(user, next),
  });

  const submit = (usePassword: boolean) =>
    form.handleSubmit((v) => {
      accept.mutate({
        body: {
          token,
          name: v.name.trim(),
          password: usePassword && v.password ? v.password : null,
        },
        headers: gate.consume(),
      });
    })();

  const inviter = preview.invited_by_name;
  const role = roleLabel(preview.role);
  const emailTaken = getErrorCode(accept.error) === 'email_taken';
  const pending = accept.isPending;

  return (
    <div className="motion-safe:fade-in-0 motion-safe:animate-in space-y-6 duration-300">
      <div className="space-y-2">
        <p className="eyebrow">{m.inv_eyebrow()}</p>
        <h1 className="text-3xl">{m.inv_heading()}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {inviter ? m.inv_invited_by({ inviter, role }) : m.inv_invited_generic({ role })}
        </p>
        <p className="[overflow-wrap:anywhere] rounded-md bg-muted px-3 py-2 font-medium text-sm">
          {m.inv_for_email({ email: preview.email })}
        </p>
      </div>
      {preview.message && (
        <figure className="space-y-1 border-areia border-l-2 pl-4">
          <blockquote className="break-words text-sm leading-relaxed">{preview.message}</blockquote>
          <figcaption className="text-muted-foreground text-xs">
            {inviter ? m.inv_message_from({ inviter }) : m.inv_message_anon()}
          </figcaption>
        </figure>
      )}
      <Form {...form}>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(withPassword);
          }}
        >
          <HoneypotField />
          <FormAlert
            message={accept.isError && !fieldError ? getErrorMessage(accept.error) : null}
          />
          {emailTaken && (
            <Button asChild variant="outline" className="h-11 w-full">
              <Link to="/login">{m.inv_go_login()}</Link>
            </Button>
          )}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.inv_name()}</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="name" className="h-11" />
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
                <FormLabel>{m.inv_password()}</FormLabel>
                <FormControl>
                  <PasswordInput
                    {...field}
                    autoComplete="new-password"
                    className="h-11"
                    onChange={(e) => {
                      setWithPassword(true);
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <FormDescription>{m.inv_password_hint()}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {gate.field}
          <div className="space-y-2">
            <Button
              type="submit"
              className="h-11 w-full font-semibold"
              disabled={pending || gate.blocked}
              loading={pending && withPassword}
              onClick={() => setWithPassword(true)}
            >
              {gate.verifying ? m.turnstile_verifying() : m.inv_submit()}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full"
              disabled={pending || gate.blocked}
              loading={pending && !withPassword}
              onClick={() => {
                setWithPassword(false);
                form.clearErrors('password');
                void submit(false);
              }}
            >
              {m.inv_submit_no_password()}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
