import { createFileRoute } from '@tanstack/react-router';
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
  head: () => ({ meta: [{ title: m.title_account() }] }),
  component: Account,
});

function LanguageCard() {
  const switchLanguage = useSwitchLanguage(true);
  return (
    <Card className="gap-4 shadow-none ring-1 ring-foreground/10">
      <CardHeader>
        <CardTitle className="font-sans font-semibold text-base">
          {m.account_language_title()}
        </CardTitle>
        <CardDescription>{m.account_language_description()}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
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
      </CardContent>
    </Card>
  );
}

function Account() {
  const { user } = Route.useRouteContext();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={m.account_eyebrow()}
        title={m.account_title()}
        description={m.account_description()}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-6">
          <Card className="gap-4 shadow-none ring-1 ring-foreground/10">
            <CardHeader>
              <CardTitle className="font-sans font-semibold text-base">
                {m.account_profile_title()}
              </CardTitle>
              <CardDescription>{m.account_profile_description()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
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
            </CardContent>
          </Card>
          <LanguageCard />
          <Card className="gap-4 shadow-none ring-1 ring-foreground/10">
            <CardHeader>
              <CardTitle className="font-sans font-semibold text-base">
                {m.account_sessions_title()}
              </CardTitle>
              <CardDescription>{m.account_sessions_description()}</CardDescription>
            </CardHeader>
            <CardContent>
              <LogoutAllButton />
            </CardContent>
          </Card>
        </div>
        <Card className="gap-4 self-start shadow-none ring-1 ring-foreground/10">
          <CardHeader>
            <CardTitle className="font-sans font-semibold text-base">
              {user.has_password
                ? m.account_password_change_title()
                : m.account_password_set_title()}
            </CardTitle>
            <CardDescription>
              {user.has_password
                ? m.account_password_change_description()
                : m.account_password_set_description()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm user={user} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
