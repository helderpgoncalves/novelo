import { useQuery } from '@tanstack/react-query';
import { Check, CircleHelp, TriangleAlert, X } from 'lucide-react';
import { getEmailDnsHealthOptions } from '@/client/@tanstack/react-query.gen';
import { ErrorState } from '@/components/states';
import { Skeleton } from '@/components/ui/skeleton';
import { intlTag } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { TONE_CLASS } from './delivery-badge';
import { type DnsStatus, dnsHint, dnsKeyLabel, dnsStatusLabel, dnsTone } from './email-logic';

const ICON: Record<DnsStatus, typeof Check> = {
  ok: Check,
  warn: TriangleAlert,
  fail: X,
  unknown: CircleHelp,
};

/** Saúde do DNS do remetente (SPF, DKIM, retorno, DMARC): estado com ícone e texto e a dica do que corrigir. */
export function EmailDnsPanel() {
  const health = useQuery({ ...getEmailDnsHealthOptions(), staleTime: 5 * 60_000 });

  if (health.isPending) return <Skeleton className="h-40 w-full rounded-xl" aria-busy="true" />;
  if (health.isError) return <ErrorState error={health.error} onRetry={health.refetch} />;

  const { checks, domain, overall, checked_at } = health.data;
  const time = new Intl.DateTimeFormat(intlTag(), { timeStyle: 'short' }).format(
    new Date(checked_at),
  );

  return (
    <div className="space-y-3" data-testid="email-dns" data-overall={overall}>
      <p className="max-w-3xl text-muted-foreground text-sm leading-relaxed">
        {m.email_dns_intro({ domain })}{' '}
        <span className="whitespace-nowrap">{m.email_dns_checked({ time })}</span>
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {checks.map((check) => {
          const Icon = ICON[check.status];
          return (
            <li
              key={check.key}
              data-check={check.key}
              data-status={check.status}
              className="flex items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
            >
              <span
                className={cn(
                  'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border',
                  TONE_CLASS[dnsTone(check.status)],
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium text-sm">
                  {dnsKeyLabel(check.key)}
                  <span className="font-normal text-muted-foreground">
                    {' · '}
                    {dnsStatusLabel(check.status)}
                  </span>
                </p>
                <p className="break-words text-muted-foreground text-xs leading-relaxed">
                  {dnsHint(check, domain)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
