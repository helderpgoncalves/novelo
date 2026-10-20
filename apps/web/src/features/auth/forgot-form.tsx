import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
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
import { getErrorMessage } from '@/lib/errors';
import { getLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { AUTH_BLOCKS, AUTH_CONTROL, AUTH_CTA, AUTH_FIELDS, AuthHeading } from './auth-ui';
import { classifySendError, isBlockingFailure } from './email-flow';
import { EmailProblem } from './email-problem';
import { FormAlert } from './form-alert';
import { EmailSent } from './magic-link-sent';
import { type ForgotValues, forgotSchema } from './schemas';
import { useTurnstile } from './use-turnstile';

/** Pede o link de recuperação (com Turnstile); partilhado pelo formulário e pelo reenvio. */
function useForgotPassword() {
  const gate = useTurnstile('forgot_password');
  const mutation = useMutation(forgotPasswordMutation());
  const send = (
    email: string,
    options?: { onSuccess?: () => void; onError?: (error: unknown) => void },
  ) =>
    mutation.mutate(
      { body: { email, locale: getLocale() }, headers: gate.consume() },
      {
        onSuccess: options?.onSuccess,
        onError: (error) => {
          gate.onApiError(error);
          options?.onError?.(error);
        },
      },
    );
  return { ...mutation, gate, send };
}

function ForgotSent({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const resend = useForgotPassword();
  return (
    <EmailSent
      email={email}
      purpose="reset"
      title={m.forgot_sent_title()}
      text={m.forgot_sent_text()}
      tip={m.email_reset_tip()}
      request={{
        send: (options) => resend.send(email, options),
        isPending: resend.isPending,
        gate: resend.gate,
      }}
      onChangeEmail={onChangeEmail}
    />
  );
}

function ForgotFields({ onSent }: { onSent: (email: string) => void }) {
  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });
  const forgot = useForgotPassword();
  const [attempt, setAttempt] = useState('');
  // Falha que troca o formulário pelo ecrã de problema; fica até a tentativa seguinte correr bem.
  const [blocked, setBlocked] = useState<'unavailable' | 'suppressed' | null>(null);

  const submit = (email: string) => {
    setAttempt(email);
    forgot.send(email, {
      onSuccess: () => {
        setBlocked(null);
        onSent(email);
      },
      onError: (error) => {
        const kind = classifySendError(error);
        setBlocked(isBlockingFailure(kind) ? kind : null);
      },
    });
  };

  if (attempt && blocked) {
    return (
      <EmailProblem
        kind={blocked}
        email={attempt}
        purpose="reset"
        retrying={forgot.isPending}
        retryBlocked={forgot.gate.blocked}
        gateField={forgot.gate.field}
        onRetry={() => submit(attempt)}
        onChangeEmail={() => {
          setBlocked(null);
          forgot.reset();
        }}
      />
    );
  }

  return (
    <>
      <AuthHeading title={m.forgot_title()} subtitle={m.forgot_subtitle()} />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v) => submit(v.email))}
          className={AUTH_FIELDS}
          noValidate
        >
          <FormAlert message={forgot.isError ? getErrorMessage(forgot.error) : null} />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.forgot_email()}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    className={AUTH_CONTROL}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {forgot.gate.field}
          <Button
            type="submit"
            className={AUTH_CTA}
            disabled={forgot.isPending || forgot.gate.blocked}
            loading={forgot.isPending || forgot.gate.busy}
          >
            {m.forgot_submit()}
          </Button>
        </form>
      </Form>
    </>
  );
}

/**
 * Recuperar a palavra-passe: formulário → «Verifica o teu email» (com reenvio e contagem) ou, se o email não
 * puder sair, o ecrã de problema com alternativas.
 */
export function ForgotFlow() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  return (
    <div className={AUTH_BLOCKS}>
      {sentTo ? (
        <ForgotSent email={sentTo} onChangeEmail={() => setSentTo(null)} />
      ) : (
        <ForgotFields onSent={setSentTo} />
      )}
      <Link
        to="/login"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" /> {m.forgot_back()}
      </Link>
    </div>
  );
}
