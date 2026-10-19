import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Page, Section } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSwitchLanguage } from '@/features/account/use-switch-language';
import { ChangePasswordForm } from '@/features/auth/change-password-form';
import { LogoutAllButton } from '@/features/auth/logout-all-button';
import { ProfileForm } from '@/features/auth/profile-form';
import { getLocale, LOCALE_LABELS, type Locale, locales } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/account')({
  staticData: { skeleton: 'form' },
  head: () => ({ meta: [{ title: m.title_account() }] }),
  component: Account,
});

function AccountCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-4 shadow-none ring-1 ring-foreground/10">
      <CardHeader>
        <CardTitle className="font-sans font-semibold text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

function LanguageCard() {
  const switchLanguage = useSwitchLanguage(true);
  return (
    <AccountCard title={m.account_language_title()} description={m.account_language_description()}>
      <div className="flex flex-wrap gap-2">
        {locales.map((locale: Locale) => (
          <Button
            key={locale}
            variant={locale === getLocale() ? 'default' : 'outline'}
            className="h-10"
            lang={locale}
            aria-pressed={locale === getLocale()}
            onClick={() => void switchLanguage(locale)}
          >
            {LOCALE_LABELS[locale]}
          </Button>
        ))}
      </div>
    </AccountCard>
  );
}

function Account() {
  const { user } = Route.useRouteContext();
  return (
    <Page>
      <PageHeader
        eyebrow={m.account_eyebrow()}
        title={m.account_title()}
        description={m.account_description()}
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-6">
        <Section title={m.rw_account_profile_section()} className="space-y-4 lg:col-span-7">
          <AccountCard
            title={m.account_profile_title()}
            description={m.account_profile_description()}
          >
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {user.role === 'admin' ? m.account_role_admin() : m.account_role_operator()}
              </Badge>
              <Badge variant={user.email_verified ? 'secondary' : 'outline'}>
                {user.email_verified ? m.account_email_verified() : m.account_email_unverified()}
              </Badge>
              {user.google_linked && <Badge variant="outline">{m.account_google_linked()}</Badge>}
            </div>
            <ProfileForm user={user} />
          </AccountCard>
          <LanguageCard />
        </Section>
        <Section title={m.rw_account_security_section()} className="space-y-4 lg:col-span-5">
          <AccountCard
            title={
              user.has_password ? m.account_password_change_title() : m.account_password_set_title()
            }
            description={
              user.has_password
                ? m.account_password_change_description()
                : m.account_password_set_description()
            }
          >
            <ChangePasswordForm user={user} />
          </AccountCard>
          <AccountCard
            title={m.account_sessions_title()}
            description={m.account_sessions_description()}
          >
            <LogoutAllButton />
          </AccountCard>
        </Section>
      </div>
    </Page>
  );
}
