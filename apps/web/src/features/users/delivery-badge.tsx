import {
  Check,
  Clock,
  Hourglass,
  Mail,
  MailX,
  Minus,
  Send,
  ShieldAlert,
  SkipForward,
  Undo2,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { UserAdminOut } from '@/client';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDateTime } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import {
  DELIVERY_META,
  type DeliveryIcon,
  type DeliveryStatus,
  deliveryTooltip,
  errorText,
  type Tone,
  templateLabel,
} from './email-logic';

const ICONS: Record<DeliveryIcon, typeof Mail> = {
  clock: Clock,
  send: Send,
  check: Check,
  hourglass: Hourglass,
  undo: Undo2,
  spam: ShieldAlert,
  x: X,
  skip: SkipForward,
  minus: Minus,
};

/** Cores dos tokens da marca; o ícone e o texto dizem o estado, a cor só reforça. */
export const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-border bg-muted/60 text-muted-foreground',
  info: 'border-primary/30 bg-primary/10 text-foreground',
  success: 'border-primary/40 bg-primary/15 text-primary',
  warning: 'border-areia bg-areia/25 text-foreground',
  danger: 'border-destructive/40 bg-destructive/10 text-destructive',
};

interface Props {
  status: DeliveryStatus;
  /** Quando foi a última tentativa (aparece no tooltip). */
  at?: string | null;
  /** Código de erro da API (aparece no tooltip, traduzido). */
  error?: string | null;
  /** Mostra por baixo a causa do erro em texto curto (para o telemóvel, onde não há tooltip). */
  showError?: boolean;
  className?: string;
}

/** Estado de entrega de um email: ícone + texto, com a explicação em tooltip e a causa visível quando falha. */
export function DeliveryBadge({
  status,
  at = null,
  error = null,
  showError = true,
  className,
}: Props) {
  const meta = DELIVERY_META[status];
  const Icon = ICONS[meta.icon];
  const detail = deliveryTooltip(status, at, error, formatDateTime);
  const visibleError = showError && error ? errorText(error) : '';
  return (
    <div className={cn('flex min-w-0 flex-col items-start gap-1', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-testid="delivery-badge"
            data-status={status}
            className={cn(
              'inline-flex min-h-6 items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              TONE_CLASS[meta.tone],
            )}
          >
            <Icon className="size-3" aria-hidden="true" />
            {meta.label()}
            <span className="sr-only">. {detail}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{detail}</TooltipContent>
      </Tooltip>
      {visibleError && (
        <p className="max-w-xs text-pretty text-muted-foreground text-xs leading-snug">
          {visibleError}
        </p>
      )}
    </div>
  );
}

/** Ícone do envelope para cabeçalhos de blocos de email. */
export function EmailIcon({
  failing,
  className,
}: {
  failing?: boolean;
  className?: string;
}): ReactNode {
  const Icon = failing ? MailX : Mail;
  return <Icon className={cn('size-5', className)} aria-hidden="true" />;
}

/** Email que avisa a pessoa do pedido ou da decisão (campo `approval_email` das listas de contas). */
export function ApprovalEmailCell({ email }: { email: UserAdminOut['approval_email'] }) {
  if (!email) return <span className="text-muted-foreground">{m.common_dash()}</span>;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <DeliveryBadge status={email.status} at={email.at} error={email.error_code} />
      {email.template && (
        <p className="text-muted-foreground text-xs">{templateLabel(email.template)}</p>
      )}
    </div>
  );
}
