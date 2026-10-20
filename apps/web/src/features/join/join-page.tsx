import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, Layers, MapPinned, MessagesSquare, QrCode } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import type { UserOut } from '@/client';
import { getMeQueryKey, quickJoinMutation } from '@/client/@tanstack/react-query.gen';
import { BrandLogo, BrandSymbol } from '@/components/brand-logo';
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
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { getLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

type Stage =
  | { name: 'form' }
  | { name: 'welcome'; user: UserOut }
  | { name: 'existing'; email: string }
  | { name: 'badcode' };

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Points({ tone }: { tone: 'light' | 'dark' }) {
  const items = [
    [Layers, m.join_point_sim_title(), m.join_point_sim_text()],
    [MapPinned, m.join_point_map_title(), m.join_point_map_text()],
    [MessagesSquare, m.join_point_copilot_title(), m.join_point_copilot_text()],
  ] as const;
  const dark = tone === 'dark';
  return (
    <ul className="space-y-4">
      {items.map(([Icon, title, text]) => (
        <li key={title} className="flex gap-3">
          <span
            className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${dark ? 'bg-[#f4f1ea]/10 text-[#7fb39c]' : 'bg-primary/10 text-primary'}`}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className={`font-semibold text-sm ${dark ? 'text-[#f4f1ea]' : ''}`}>{title}</p>
            <p
              className={`text-sm leading-relaxed ${dark ? 'text-[#f4f1ea]/70' : 'text-muted-foreground'}`}
            >
              {text}
            </p>
          </div>
        </li>
      ))}
    </ul>
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
    <div
      className="motion-safe:fade-in-0 motion-safe:animate-in space-y-5 duration-300"
      role="status"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-areia/25">
        <QrCode className="size-6" aria-hidden="true" />
      </span>
      <h1 className="text-3xl">{title}</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">{text}</p>
      {children}
      <Button
        asChild
        variant={children ? 'ghost' : 'default'}
        className="h-11 w-full font-semibold"
      >
        <Link to="/login">{m.join_go_login()}</Link>
      </Button>
    </div>
  );
}

function JoinForm({ code, onStage }: { code: string; onStage: (stage: Stage) => void }) {
  const queryClient = useQueryClient();
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; consent?: string }>({});
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
      if (
        getErrorCode(error) === 'invalid_event_code' ||
        getErrorCode(error) === 'feature_disabled'
      )
        onStage({ name: 'badcode' });
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const next = {
      name: looksLikeName(name) ? undefined : m.validation_name_required(),
      email: !email
        ? m.validation_email_required()
        : looksLikeEmail(email)
          ? undefined
          : m.validation_email_invalid(),
      consent: consent ? undefined : m.join_consent_required(),
    };
    setErrors(next);
    if (next.name || next.email || next.consent) {
      // Foco no primeiro campo com problema, para quem escreve com o teclado do telemóvel.
      const first = next.name ? 'join-name' : next.email ? 'join-email' : 'join-consent';
      document.getElementById(first)?.focus();
      return;
    }
    join.mutate({ body: { name, email, code, consent: true, locale: getLocale() } });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2" noValidate aria-label={m.join_form_label()}>
      <FormAlert message={join.isError && !join.isPending ? getErrorMessage(join.error) : null} />
      <div className="space-y-2">
        <label htmlFor="join-name" className="font-medium text-sm leading-none">
          {m.join_name()}
        </label>
        <Input
          id="join-name"
          name="name"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={120}
          placeholder={m.join_name_placeholder()}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby="join-name-error"
          className="h-11"
        />
        <p id="join-name-error" role="alert" className="min-h-5 text-destructive text-sm">
          {errors.name}
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="join-email" className="font-medium text-sm leading-none">
          {m.login_email()}
        </label>
        <Input
          id="join-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={readLastEmail()}
          placeholder={m.login_email_placeholder()}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby="join-email-error"
          className="h-11"
        />
        <p id="join-email-error" role="alert" className="min-h-5 text-destructive text-sm">
          {errors.email}
        </p>
      </div>
      <div className="space-y-1">
        <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
          <Checkbox
            id="join-consent"
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby="join-consent-text join-consent-error"
            className="mt-0.5 size-5"
          />
          <div className="space-y-1">
            <label
              htmlFor="join-consent"
              id="join-consent-text"
              className="block text-sm leading-relaxed"
            >
              {m.join_consent()}
            </label>
            <Link
              to="/privacy"
              target="_blank"
              className="font-medium text-primary text-sm hover:underline"
            >
              {m.join_privacy_link()}
            </Link>
          </div>
        </div>
        <p id="join-consent-error" role="alert" className="min-h-5 text-destructive text-sm">
          {errors.consent}
        </p>
      </div>
      <Button
        type="submit"
        size="lg"
        className="h-12 w-full font-semibold text-base"
        loading={join.isPending}
      >
        {join.isPending ? m.join_submitting() : m.join_submit()}
      </Button>
    </form>
  );
}

function Welcome({ user }: { user: UserOut }) {
  const navigate = useNavigate();
  useEffect(() => {
    const id = window.setTimeout(
      () => void navigate({ to: '/', replace: true }),
      reducedMotion() ? 400 : 1100,
    );
    return () => window.clearTimeout(id);
  }, [navigate]);
  return (
    <div
      role="status"
      className="motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:animate-in space-y-4 text-center duration-500"
    >
      <CheckCircle2 className="mx-auto size-10 text-primary" aria-hidden="true" />
      <h1 className="text-3xl" data-testid="join-welcome">
        {m.join_welcome_title({ name: (user.name ?? '').split(' ')[0] ?? '' })}
      </h1>
      <p className="text-muted-foreground text-sm">{m.join_welcome_text()}</p>
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

  let body: React.ReactNode;
  if (stage.name === 'welcome') body = <Welcome user={stage.user} />;
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
        <Button asChild className="h-11 w-full font-semibold">
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
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="font-semibold text-primary text-[11px] uppercase tracking-[0.18em] lg:hidden">
            {m.auth_aside_eyebrow()}
          </p>
          <h1 className="text-balance text-4xl leading-[1.05]">{m.join_title()}</h1>
          <p className="text-muted-foreground leading-relaxed">{m.join_lead()}</p>
        </div>
        <JoinForm code={code} onStage={setStage} />
        <p className="text-center text-muted-foreground text-sm">
          {m.join_have_account()}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {m.join_login_link()}
          </Link>
        </p>
      </div>
    );

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-[#14211d] p-12 text-[#f4f1ea] lg:flex lg:flex-col lg:justify-between">
        <BrandSymbol
          tone="negative"
          className="-right-40 -bottom-40 pointer-events-none absolute size-[640px] opacity-30"
        />
        <BrandLogo tone="negative" className="h-9 self-start" />
        <div className="relative max-w-md space-y-8">
          <p className="font-semibold text-[#7fb39c] text-[11px] uppercase tracking-[0.18em]">
            {m.auth_aside_eyebrow()}
          </p>
          <h2 className="text-balance text-4xl leading-[1.1]">{m.join_aside_title()}</h2>
          <Points tone="dark" />
        </div>
        <p className="relative text-[#f4f1ea]/60 text-xs">{m.auth_footer()}</p>
      </aside>
      <main className="flex flex-col pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] sm:px-12">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <BrandLogo className="h-8" />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-10 py-8">
          {body}
          {stage.name === 'form' && !user && enabled && code && (
            <section
              className="space-y-4 border-border border-t pt-8 lg:hidden"
              aria-label={m.join_points_label()}
            >
              <Points tone="light" />
            </section>
          )}
        </div>
        <p className="text-center text-muted-foreground text-xs">
          <Link to="/privacy" className="underline-offset-2 hover:underline">
            {m.join_privacy_link()}
          </Link>
        </p>
      </main>
    </div>
  );
}
