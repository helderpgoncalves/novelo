import { Link, useRouterState } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';

export interface CopilotErrorInfo {
  title: string;
  text: string;
  /** Gerar a resposta de novo costuma resolver (falhas passageiras). */
  retry: boolean;
  /** A sessão terminou: o caminho é o login, não regenerar. */
  login?: boolean;
}

/** Explica um erro do copiloto pelo código da API, em vez de uma frase genérica. Pura, para testar. */
export function describeCopilotError(code: string): CopilotErrorInfo {
  switch (code) {
    case 'ai_budget_exceeded':
      return { title: m.cop_err_budget_title(), text: m.cop_err_budget_text(), retry: false };
    case 'rate_limited':
      return { title: m.cop_err_rate_title(), text: m.cop_err_rate_text(), retry: true };
    case 'feature_disabled':
      return { title: m.cop_err_disabled_title(), text: m.cop_err_disabled_text(), retry: false };
    case 'unauthenticated':
    case 'session_expired':
      return {
        title: m.cop_err_session_title(),
        text: m.cop_err_session_text(),
        retry: false,
        login: true,
      };
    case 'service_unavailable':
      return {
        title: m.cop_err_unavailable_title(),
        text: m.cop_err_unavailable_text(),
        retry: true,
      };
    case 'upstream_error':
      return { title: m.cop_err_upstream_title(), text: m.cop_err_upstream_text(), retry: true };
    case 'bad_request':
    case 'validation_error':
      return { title: m.cop_err_request_title(), text: m.error_validation_error(), retry: false };
    case 'connection':
      return {
        title: m.cop_err_interrupted_title(),
        text: m.cop_err_interrupted_text(),
        retry: true,
      };
    default:
      return { title: m.cop_err_internal_title(), text: m.cop_err_internal_text(), retry: true };
  }
}

/** Erro dentro da conversa: diz o que aconteceu, mantém o texto já recebido e oferece "Gerar de novo" quando serve. */
export function CopilotError({
  code,
  partial,
  onRetry,
}: {
  code: string;
  /** Há texto parcial acima: avisa que está incompleto. */
  partial: boolean;
  /** Só a última mensagem se pode regenerar. */
  onRetry: (() => void) | null;
}) {
  const info = describeCopilotError(code);
  const next = useRouterState({ select: (s) => s.location.href });
  return (
    <div
      role="alert"
      data-testid="copilot-error"
      data-code={code}
      className="flex flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5"
    >
      <p className="flex items-center gap-2 font-medium text-sm">
        <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
        {info.title}
      </p>
      <p className="text-muted-foreground text-sm">{info.text}</p>
      {partial && <p className="text-muted-foreground text-xs">{m.cop_err_partial()}</p>}
      {info.login ? (
        <Button asChild variant="outline" size="sm" className="h-10">
          <Link to="/login" search={{ next, reason: 'expired' }}>
            {m.err_session_login()}
          </Link>
        </Button>
      ) : (
        info.retry &&
        onRetry && (
          <Button variant="outline" size="sm" className="h-10" onClick={onRetry}>
            {m.chat_regenerate()}
          </Button>
        )
      )}
    </div>
  );
}
