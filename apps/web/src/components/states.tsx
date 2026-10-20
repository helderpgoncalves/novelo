import { Link, useRouterState } from '@tanstack/react-router';
import { AlertTriangle, Inbox, Lock, type LucideIcon, RefreshCw, WifiOff } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { reloadForNewVersion } from '@/features/errors/session-and-version-screens';
import { classifyError, type ErrorKind, getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <Inbox className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-muted-foreground text-sm">{description}</p>}
      {action}
    </div>
  );
}

const ERROR_TITLE: Record<ErrorKind, () => string> = {
  offline: () => m.err_inline_title_offline(),
  maintenance: () => m.err_inline_title_maintenance(),
  forbidden: () => m.err_inline_title_forbidden(),
  chunk: () => m.err_inline_title_chunk(),
  session: () => m.err_inline_title_session(),
  not_found: () => m.error_load_title(),
  generic: () => m.error_load_title(),
};

const ERROR_ICON: Record<ErrorKind, LucideIcon> = {
  offline: WifiOff,
  maintenance: RefreshCw,
  forbidden: Lock,
  chunk: RefreshCw,
  session: Lock,
  not_found: AlertTriangle,
  generic: AlertTriangle,
};

/**
 * Erro localizado (cartão, separador, painel): a página à volta continua a funcionar. A mensagem e a ação
 * dependem da família do erro; sem rede volta a tentar sozinho quando o browser avisa que a ligação voltou.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => unknown }) {
  const kind = classifyError(error);
  const Icon = ERROR_ICON[kind];
  const [retrying, setRetrying] = useState(false);
  const next = useRouterState({ select: (s) => s.location.href });

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      await onRetry?.();
    } finally {
      setRetrying(false);
    }
  }, [onRetry]);

  useEffect(() => {
    if (kind !== 'offline' || !onRetry) return;
    const again = () => void retry();
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, [kind, onRetry, retry]);

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
    >
      <Icon className="size-6 text-destructive" aria-hidden="true" />
      <p className="font-medium">{ERROR_TITLE[kind]()}</p>
      <p className="max-w-md text-muted-foreground text-sm">
        {kind === 'chunk' ? m.err_inline_chunk_text() : getErrorMessage(error)}
      </p>
      {kind === 'chunk' ? (
        <Button variant="outline" size="sm" className="h-10" onClick={reloadForNewVersion}>
          {m.err_chunk_reload()}
        </Button>
      ) : kind === 'session' ? (
        <Button asChild variant="outline" size="sm" className="h-10">
          <Link to="/login" search={{ next, reason: 'expired' }}>
            {m.err_session_login()}
          </Link>
        </Button>
      ) : (
        kind !== 'forbidden' &&
        onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="h-10"
            onClick={() => void retry()}
            disabled={retrying}
            loading={retrying}
          >
            {m.common_retry()}
          </Button>
        )
      )}
    </div>
  );
}

export { PageSkeleton } from '@/components/skeletons';
