import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getLastApiFailure } from '@/lib/api-config';
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { mailtoLink, makeClientRef } from '@/lib/support';
import { m } from '@/paraglide/messages';
import { ErrorReference } from './error-reference';
import { ErrorScreen } from './error-screen';

/** Id do pedido da API que falhou (o `x-request-id` dos logs) ou, se o erro foi só do browser, uma referência nova. */
function useReference(): string {
  return useMemo(() => getLastApiFailure()?.requestId ?? makeClientRef(), []);
}

/** 500 e erros de rota sem família própria: mensagem humana, referência copiável, tentar de novo e reportar. */
export function ServerErrorScreen({
  error,
  onRetry,
  layout = 'panel',
}: {
  error: unknown;
  onRetry: () => unknown;
  layout?: 'page' | 'panel';
}) {
  const ref = useReference();
  const [retrying, setRetrying] = useState(false);
  const code = getErrorCode(error);
  // Só os códigos da API têm texto próprio; o resto (um bug nosso) recebe a mensagem genérica honesta.
  const specific = code && code !== 'internal_error' ? getErrorMessage(error) : m.err_500_text();

  const retry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  const report = mailtoLink(
    m.err_report_subject({ ref }),
    m.err_report_body({
      ref,
      url: window.location.href,
      time: new Date().toISOString(),
      code: code ?? (error instanceof Error ? error.name : 'unknown'),
    }),
  );

  return (
    <ErrorScreen
      layout={layout}
      eyebrow={m.rooterror_eyebrow()}
      title={m.rooterror_title()}
      actions={
        <>
          <Button
            className="h-10"
            onClick={() => void retry()}
            disabled={retrying}
            loading={retrying}
          >
            {m.common_retry()}
          </Button>
          <Button asChild variant="outline" className="h-10">
            <a href={report}>{m.err_report()}</a>
          </Button>
          <Button asChild variant="ghost" className="h-10">
            <Link to="/">{m.common_back_home()}</Link>
          </Button>
        </>
      }
    >
      <p>{specific}</p>
      <p className="text-xs">{m.err_500_hint()}</p>
      <ErrorReference value={ref} />
      {import.meta.env.DEV && error instanceof Error && (
        <details className="rounded-lg border bg-muted/50 p-3 text-left text-xs">
          <summary className="cursor-pointer font-medium text-foreground">
            {m.err_dev_details()}
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono">
            {error.stack ?? `${error.name}: ${error.message}`}
          </pre>
        </details>
      )}
    </ErrorScreen>
  );
}
