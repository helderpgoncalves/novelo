import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, QrCode } from 'lucide-react';
import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from 'react';
import type { UserOut } from '@/client';
import { getMeQueryKey, quickJoinMutation } from '@/client/@tanstack/react-query.gen';
import { BrandLogo, BrandSpinner } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { FormAlert } from '@/features/auth/form-alert';
import { MagicLinkSent } from '@/features/auth/magic-link-sent';
import {
  looksLikeEmail,
  looksLikeName,
  readLastEmail,
  storeLastEmail,
} from '@/features/auth/passwordless';
import { HoneypotField, readHoneypot, useTurnstile } from '@/features/auth/use-turnstile';
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { formatPercent, formatTonnes } from '@/lib/format';
import { getLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

type Stage =
  | { name: 'form' }
  | { name: 'welcome'; user: UserOut }
  | { name: 'existing'; email: string }
  | { name: 'badcode' };

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canAutofocus = () => window.matchMedia('(pointer: fine)').matches;

/** Entrada escalonada: `--i` é a posição (60 ms por passo), ver `.rise` em styles.css. */
const rise = (i: number): { className: string; style: CSSProperties } => ({
  className: 'rise',
  style: { '--i': i } as CSSProperties,
});

// Números reais da Vitrus (docs/dados): 301,3 t recolhidas em 2025, captura ≈ 22,9 %, potencial ≈ 1 317 t/ano.
function Stats() {
  const items = [
    [formatTonnes(301.3), m.join_stat_collected()],
    [formatPercent(22.9), m.join_stat_capture()],
    [`≈ ${formatTonnes(1317, 0)}`, m.join_stat_potential()],
  ] as const;
  return (
    <dl
      aria-label={m.join_stats_label()}
      className="grid grid-cols-3 gap-2 [@media(max-height:600px)]:hidden"
    >
      {items.map(([value, label]) => (
        <div key={label} className="rounded-xl border border-border/70 bg-card/60 px-2.5 py-2">
          <dt className="sr-only">{label}</dt>
          <dd className="font-heading text-lg leading-none tabular-nums" aria-hidden="true">
            {value}
          </dd>
          <dd className="mt-1 text-[11px] text-muted-foreground leading-tight">{label}</dd>
        </div>
      ))}
    </dl>
  );
}

function Notice({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-5" role="status">
      <span
        {...rise(0)}
        className="rise flex size-12 items-center justify-center rounded-full bg-areia/25"
      >
        <QrCode className="size-6" aria-hidden="true" />
      </span>
      <h1 {...rise(1)} className="rise text-3xl">
        {title}
      </h1>
      <p {...rise(2)} className="rise text-muted-foreground text-sm leading-relaxed">
        {text}
      </p>
      <div {...rise(3)} className="rise space-y-2">
        {children}
        <Button
          asChild
          variant={children ? 'ghost' : 'default'}
          className="h-12 w-full rounded-xl font-semibold"
        >
          <Link to="/login">{m.join_go_login()}</Link>
        </Button>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  index,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <div {...rise(index)} className="rise space-y-1.5">
      <label htmlFor={id} className="font-medium text-sm leading-none">
        {label}
      </label>
      {children}
      <p id={`${id}-error`} role="alert" className="min-h-4 text-destructive text-xs">
        {error}
      </p>
    </div>
  );
}

const FIELD =
  'h-12 rounded-xl px-3.5 text-base transition-[color,box-shadow,border-color] duration-200';

function JoinForm({ code, onStage }: { code: string; onStage: (stage: Stage) => void }) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const gate = useTurnstile('quick_join');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; consent?: string }>({});

  // Com rato o teclado não incomoda: foco no nome. Em telemóvel não se abre o teclado sozinho.
  useEffect(() => {
    if (canAutofocus()) nameRef.current?.focus();
  }, []);

  const join = useMutation({
    ...quickJoinMutation(),
    onSuccess: (result, vars) => {
      storeLastEmail(vars.body.email);
      if (result.status === 'signed_in' && result.user) {
        queryClient.clear();
        queryClient.setQueryData(getMeQueryKey(), result.user);
        onStage({ name: 'welcome', user: result.user });
      } else {
        onStage({ name: 'existing', email: vars.body.email });
      }
    },
    onError: (error) => {
      gate.onApiError(error);
      if (
        getErrorCode(error) === 'invalid_event_code' ||
        getErrorCode(error) === 'feature_disabled'
      )
        onStage({ name: 'badcode' });
    },
  });

  const check = (name: string, email: string) => ({
    name: looksLikeName(name) ? undefined : m.join_name_hint(),
    email: !email
      ? m.validation_email_required()
      : looksLikeEmail(email)
        ? undefined
        : m.join_email_hint(),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const next = {
      ...check(name, email),
      consent: consent ? undefined : m.join_consent_required(),
    };
    setErrors(next);
    if (next.name || next.email || next.consent) {
      const first = next.name ? 'join-name' : next.email ? 'join-email' : 'join-consent';
      document.getElementById(first)?.focus();
      return;
    }
    join.mutate({
      body: {
        name,
        email,
        code,
        consent: true,
        locale: getLocale(),
        website: readHoneypot(formRef.current),
      },
      headers: gate.consume(),
    });
  };

  // Validação amável: só depois de sair do campo, e some assim que o valor passa a servir.
  const onBlur = (field: 'name' | 'email') => (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value.trim();
    if (!value && field === 'name') return;
    setErrors((prev) => ({
      ...prev,
      [field]: check(field === 'name' ? value : 'ok', field === 'email' ? value : 'ok')[field],
    }));
  };
  const clear = (field: 'name' | 'email') => () =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="relative flex flex-1 flex-col"
      noValidate
      aria-label={m.join_form_label()}
    >
      <HoneypotField />
      <div className="flex-1 space-y-0.5">
        <FormAlert message={join.isError && !join.isPending ? getErrorMessage(join.error) : null} />
        <Field id="join-name" label={m.join_name()} error={errors.name} index={4}>
          <Input
            ref={nameRef}
            id="join-name"
            name="name"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            maxLength={120}
            placeholder={m.join_name_placeholder()}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby="join-name-error"
            onBlur={onBlur('name')}
            onChange={clear('name')}
            className={FIELD}
          />
        </Field>
        <Field id="join-email" label={m.login_email()} error={errors.email} index={5}>
          <Input
            id="join-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            defaultValue={readLastEmail()}
            placeholder={m.login_email_placeholder()}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby="join-email-error"
            onBlur={onBlur('email')}
            onChange={clear('email')}
            className={FIELD}
          />
        </Field>
        <div {...rise(6)} className="rise">
          <div className="flex items-start gap-3 py-1">
            <Checkbox
              id="join-consent"
              checked={consent}
              onCheckedChange={(v) => {
                setConsent(v === true);
                if (v === true) setErrors((prev) => ({ ...prev, consent: undefined }));
              }}
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby="join-consent-error"
              className="mt-0.5 size-6 rounded-md"
            />
            <div className="min-w-0 space-y-1">
              <label
                htmlFor="join-consent"
                className="block py-0.5 text-[13px] text-muted-foreground leading-snug"
              >
                {m.join_consent_short()}
              </label>
              <p className="flex gap-3 text-[13px]">
                <Link
                  to="/privacy"
                  target="_blank"
                  className="inline-flex min-h-6 items-center font-medium text-primary underline-offset-2 hover:underline"
                >
                  {m.join_privacy_short()}
                </Link>
                <Link
                  to="/terms"
                  target="_blank"
                  className="inline-flex min-h-6 items-center font-medium text-primary underline-offset-2 hover:underline"
                >
                  {m.join_terms_short()}
                </Link>
              </p>
            </div>
          </div>
          <p id="join-consent-error" role="alert" className="min-h-4 text-destructive text-xs">
            {errors.consent}
          </p>
        </div>
      </div>

      {/* Botão no alcance do polegar: cola-se ao fundo e acompanha o teclado (interactive-widget). */}
      <div
        {...rise(7)}
        className="rise sticky bottom-0 z-10 -mx-5 mt-2 space-y-2 bg-linear-to-t from-background via-background/95 to-transparent px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:bg-none sm:px-0 sm:pb-0"
      >
        {gate.field}
        <Button
          type="submit"
          size="lg"
          className="h-14 w-full rounded-2xl font-semibold text-base shadow-sm transition-transform active:scale-[0.985]"
          loading={join.isPending}
          disabled={gate.blocked}
        >
          {join.isPending
            ? m.join_submitting()
            : gate.verifying
              ? m.turnstile_verifying()
              : m.join_submit()}
        </Button>
        <p className="text-center text-muted-foreground text-sm">
          {m.join_have_account()}{' '}
          <Link
            to="/login"
            className="inline-flex min-h-8 items-center font-medium text-primary hover:underline"
          >
            {m.join_login_link()}
          </Link>
        </p>
      </div>
    </form>
  );
}

function Welcome({ user, onLeave }: { user: UserOut; onLeave: () => void }) {
  const navigate = useNavigate();
  useEffect(() => {
    const quick = reducedMotion();
    const leave = window.setTimeout(onLeave, quick ? 250 : 900);
    const go = window.setTimeout(
      () => void navigate({ to: '/', replace: true }),
      quick ? 450 : 1200,
    );
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(go);
    };
  }, [navigate, onLeave]);
  return (
    <div role="status" className="space-y-4 py-10 text-center">
      <CheckCircle2 {...rise(0)} className="rise mx-auto size-12 text-primary" aria-hidden="true" />
      <h1 {...rise(1)} className="rise text-3xl" data-testid="join-welcome">
        {m.join_welcome_title({ name: (user.name ?? '').split(' ')[0] ?? '' })}
      </h1>
      <p {...rise(2)} className="rise text-muted-foreground text-sm">
        {m.join_welcome_text()}
      </p>
    </div>
  );
}

export function JoinPage({
  code,
  enabled,
  user,
}: {
  code: string | undefined;
  enabled: boolean;
  user: UserOut | null;
}) {
  const [stage, setStage] = useState<Stage>({ name: 'form' });
  const [leaving, setLeaving] = useState(false);
  const showForm = stage.name === 'form' && !user && enabled && !!code;

  let body: React.ReactNode;
  if (stage.name === 'welcome')
    body = <Welcome user={stage.user} onLeave={() => setLeaving(true)} />;
  else if (stage.name === 'existing')
    body = (
      <MagicLinkSent
        email={stage.email}
        title={m.magic_existing_title()}
        text={m.magic_existing_text()}
        onChangeEmail={() => setStage({ name: 'form' })}
      />
    );
  else if (user)
    body = (
      <Notice
        title={m.join_signed_in_title()}
        text={m.join_signed_in_text({ name: user.name ?? user.email })}
      >
        <Button asChild className="h-12 w-full rounded-xl font-semibold">
          <Link to="/">{m.verify_open_app()}</Link>
        </Button>
      </Notice>
    );
  else if (!enabled)
    body = <Notice title={m.join_disabled_title()} text={m.join_disabled_text()} />;
  else if (!code) body = <Notice title={m.join_nocode_title()} text={m.join_nocode_text()} />;
  else if (stage.name === 'badcode')
    body = <Notice title={m.join_badcode_title()} text={m.join_badcode_text()} />;
  else
    body = (
      <div className="flex flex-1 flex-col gap-4">
        <div className="space-y-2">
          <p
            {...rise(0)}
            className="rise hidden font-semibold text-primary text-[11px] uppercase tracking-[0.18em] sm:block"
          >
            {m.auth_aside_eyebrow()}
          </p>
          <h1 {...rise(1)} className="rise text-balance text-[2rem] leading-[1.05] sm:text-4xl">
            {m.join_title()}
          </h1>
          <p
            {...rise(2)}
            className="rise text-[15px] text-muted-foreground leading-snug [@media(max-height:680px)]:hidden"
          >
            {m.join_lead_short()}
          </p>
        </div>
        <div {...rise(3)} className="rise">
          <Stats />
        </div>
        {code && <JoinForm code={code} onStage={setStage} />}
      </div>
    );

  return (
    <div
      data-leaving={leaving}
      className="relative isolate min-h-dvh overflow-x-clip transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none data-[leaving=true]:translate-y-1 data-[leaving=true]:opacity-0"
    >
      {/* O símbolo chega a rodar, assenta e deriva devagar atrás do conteúdo. */}
      <div
        aria-hidden="true"
        className="-top-24 -right-32 pointer-events-none absolute -z-10 opacity-[0.07] sm:-right-24 sm:opacity-[0.08]"
      >
        <BrandSpinner spin={false} className="brand-drift size-[420px] sm:size-[620px]" />
      </div>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))] sm:justify-center sm:py-10">
        <header className="flex items-center justify-between pb-3 sm:pb-6">
          <BrandLogo className="h-7" />
          <div className="-mr-2 flex items-center gap-0.5">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <main
          className={cn(
            'flex flex-1 flex-col sm:flex-none',
            !showForm && 'justify-center pb-10',
            'sm:rounded-3xl sm:border sm:bg-card/70 sm:p-8 sm:shadow-sm sm:backdrop-blur',
          )}
        >
          {body}
        </main>
        <p className="py-3 text-center text-muted-foreground text-xs [@media(max-height:760px)]:hidden">
          {m.auth_footer()}
        </p>
      </div>
    </div>
  );
}
