import type { ErrorBody, UserOut, ValidationErrorBody } from '@/client';
import { getMeQueryKey } from '@/client/@tanstack/react-query.gen';
import { queryClient } from '@/lib/query-client';
import { m } from '@/paraglide/messages';

type ErrorCode = ErrorBody['code'];

// Record exaustivo sobre os códigos do OpenAPI: se a API ganhar um código novo, o `tsc` falha aqui
// até haver tradução. É isto que mantém os erros do servidor e do web sempre alinhados.
const MESSAGES: Record<ErrorCode, () => string> = {
  bad_request: () => m.error_bad_request(),
  validation_error: () => m.error_validation_error(),
  unauthenticated: () => m.error_unauthenticated(),
  session_expired: () => m.error_session_expired(),
  invalid_credentials: () => m.error_invalid_credentials(),
  account_inactive: () => m.error_account_inactive(),
  current_password_incorrect: () => m.error_current_password_incorrect(),
  invalid_token: () => m.error_invalid_token(),
  forbidden: () => m.error_forbidden(),
  registration_closed: () => m.error_registration_closed(),
  invalid_event_code: () => m.error_invalid_event_code(),
  not_found: () => m.error_not_found(),
  user_not_found: () => m.error_user_not_found(),
  email_taken: () => m.error_email_taken(),
  cannot_modify_self: () => m.error_cannot_modify_self(),
  conflict: () => m.error_conflict(),
  rate_limited: () => m.error_rate_limited(),
  feature_disabled: () => m.error_feature_disabled(),
  upstream_error: () => m.error_upstream_error(),
  ai_budget_exceeded: () => m.error_ai_budget_exceeded(),
  internal_error: () => m.error_internal_error(),
};

// Códigos que só existem no cliente: o nginx devolve 502/503/504 (HTML) enquanto a API reinicia.
const CLIENT_MESSAGES = { service_unavailable: () => m.error_service_unavailable() } as const;
type ClientCode = keyof typeof CLIENT_MESSAGES;
export const SERVICE_UNAVAILABLE: ClientCode = 'service_unavailable';

export type ApiError = ErrorBody | ValidationErrorBody;

const isApiError = (error: unknown): error is ApiError =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  typeof (error as { code: unknown }).code === 'string';

const isClientCode = (value: unknown): value is ClientCode =>
  typeof value === 'string' && value in CLIENT_MESSAGES;

export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === 'string' && value in MESSAGES;

// Convidados (QR do evento) têm limites próprios: a mensagem diz-lhes o que se passa em vez de um "sem permissão" seco.
const GUEST_MESSAGES: Partial<Record<ErrorCode, () => string>> = {
  forbidden: () => m.error_forbidden_guest(),
  rate_limited: () => m.error_rate_limited_guest(),
  ai_budget_exceeded: () => m.error_ai_budget_guest(),
};

const isGuestSession = (): boolean =>
  queryClient.getQueryData<UserOut>(getMeQueryKey())?.role === 'guest';

/** Mensagem traduzida para qualquer erro devolvido pelo cliente gerado. */
export function getErrorMessage(error: unknown): string {
  const code: unknown = isApiError(error) ? error.code : undefined;
  if (isErrorCode(code) && GUEST_MESSAGES[code] && isGuestSession()) return GUEST_MESSAGES[code]();
  if (isErrorCode(code)) return MESSAGES[code]();
  if (isClientCode(code)) return CLIENT_MESSAGES[code]();
  if (isNetworkError(error)) return m.error_network();
  return m.error_unknown();
}

/** Código de um erro da API (para decisões de fluxo, ex.: 'session_expired'). */
export const getErrorCode = (error: unknown): ErrorCode | null =>
  isApiError(error) && isErrorCode(error.code) ? error.code : null;

/** `fetch` falhou antes de haver resposta (sem rede, servidor em baixo). Chrome, Safari e Firefox dizem-no de formas diferentes. */
export const isNetworkError = (error: unknown): boolean =>
  error instanceof TypeError &&
  !isChunkError(error) &&
  /fetch|network|load failed/i.test(error.message);

/** Um ficheiro do site que já não existe: acontece a quem tinha a app aberta durante um deploy novo. */
export const isChunkError = (error: unknown): boolean =>
  error instanceof Error &&
  /dynamically imported module|importing a module script failed|ChunkLoadError|error loading dynamically/i.test(
    `${error.name} ${error.message}`,
  );

/** Lançado pelas rotas que exigem um papel (ver `requireRole`): o URL mantém-se e mostra-se o ecrã 403. */
export class ForbiddenError extends Error {
  constructor(readonly requiredRole: 'admin' | 'operator' | null = null) {
    super('forbidden');
    this.name = 'ForbiddenError';
  }
}

export type ErrorKind =
  | 'offline'
  | 'maintenance'
  | 'forbidden'
  | 'not_found'
  | 'session'
  | 'chunk'
  | 'generic';

/** Em que família cai um erro: decide o ecrã, o texto e se vale a pena tentar de novo sozinho. */
export function classifyError(error: unknown): ErrorKind {
  // Sem rede, um ficheiro que não chega não é uma versão nova: é só a rede.
  if (isChunkError(error))
    return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'chunk';
  if (error instanceof ForbiddenError) return 'forbidden';
  if (isNetworkError(error)) return 'offline';
  if (isApiError(error)) {
    const code: string = error.code ?? '';
    switch (code) {
      case SERVICE_UNAVAILABLE:
        return 'maintenance';
      case 'forbidden':
        return 'forbidden';
      case 'not_found':
      case 'user_not_found':
        return 'not_found';
      case 'unauthenticated':
      case 'session_expired':
        return 'session';
    }
  }
  return 'generic';
}

/** Falha de infraestrutura (rede ou API a reiniciar): tentar de novo resolve sem a pessoa fazer mais nada. */
export const isTransient = (kind: ErrorKind): boolean =>
  kind === 'offline' || kind === 'maintenance';
