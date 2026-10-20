import { useQueryClient } from '@tanstack/react-query';
import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import type { UserOut } from '@/client';
import { getMeQueryKey } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { mailtoLink } from '@/lib/support';
import { m } from '@/paraglide/messages';
import { ErrorScreen } from './error-screen';

type Role = 'admin' | 'operator';
const plural = (r: Role) => (r === 'admin' ? m.err_role_admin() : m.err_role_operator());
const single = (r: Role) => (r === 'admin' ? m.err_role_admin_one() : m.err_role_operator_one());

/** 403: diz o papel que falta (quando se sabe), qual é o da conta, e como pedir acesso. */
export function ForbiddenScreen({
  requiredRole,
  layout = 'panel',
}: {
  requiredRole: Role | null;
  layout?: 'page' | 'panel';
}) {
  const router = useRouter();
  const me = useQueryClient().getQueryData<UserOut>(getMeQueryKey());
  const href = useRouterState({ select: (s) => s.location.href });
  const url =
    typeof window === 'undefined' ? href : `${window.location.origin}${window.location.pathname}`;
  const mail = mailtoLink(
    m.err_403_mail_subject(),
    m.err_403_mail_body({
      url,
      role: requiredRole ? single(requiredRole) : '-',
      email: me?.email ?? '-',
    }),
  );

  return (
    <ErrorScreen
      layout={layout}
      code="403"
      eyebrow={m.err_403_eyebrow()}
      title={m.err_403_title()}
      actions={
        <>
          <Button asChild className="h-10">
            <a href={mail}>{m.err_403_request()}</a>
          </Button>
          <Button asChild variant="outline" className="h-10">
            <Link to="/">{m.common_back_home()}</Link>
          </Button>
          <Button variant="ghost" className="h-10" onClick={() => router.history.back()}>
            {m.err_back()}
          </Button>
        </>
      }
    >
      <p>
        {requiredRole && me
          ? m.err_403_text_role({ role: plural(requiredRole), current: single(me.role) })
          : m.err_403_text()}
      </p>
    </ErrorScreen>
  );
}
