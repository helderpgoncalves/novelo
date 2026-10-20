import { Link, useRouterState } from '@tanstack/react-router';
import { MailWarning } from 'lucide-react';
import type { MeOut } from '@/client';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';

/** Nº de alertas de email a mostrar ao administrador (0 para os outros perfis). */
export const emailAlertCount = (user: Pick<MeOut, 'role' | 'email_alerts'>): number =>
  user.role === 'admin' ? Math.max(0, user.email_alerts ?? 0) : 0;

/**
 * Faixa discreta para administradores quando o envio de emails tem alertas ativos (`MeOut.email_alerts`): as
 * pessoas podem estar sem receber links e avisos. Leva à vista «Emails»; não aparece nessa própria vista.
 */
export function EmailAlertsBanner({ user }: { user: MeOut }) {
  const count = emailAlertCount(user);
  const onEmails = useRouterState({
    select: (s) =>
      s.location.pathname.replace(/^\/(pt|en)(?=\/)/, '').startsWith('/users') &&
      new URLSearchParams(s.location.searchStr).get('view') === 'emails',
  });
  if (count === 0 || onEmails) return null;

  return (
    <div
      role="status"
      data-testid="email-alerts-banner"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-destructive/30 border-b bg-destructive/5 px-4 py-2 text-sm sm:px-6 lg:px-8"
    >
      <MailWarning className="size-4 shrink-0 text-destructive" aria-hidden="true" />
      <p className="min-w-0 flex-1">{m.email_banner_text({ count })}</p>
      <Button asChild variant="outline" size="sm" className="h-9 sm:h-8">
        <Link to="/users" search={{ tab: 'audit', view: 'emails' }}>
          {m.email_banner_cta()}
        </Link>
      </Button>
    </div>
  );
}
