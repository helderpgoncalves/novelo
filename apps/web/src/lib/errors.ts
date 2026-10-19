import type { ErrorBody, ValidationErrorBody } from '@/client';
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

export type ApiError = ErrorBody | ValidationErrorBody;

const isApiError = (error: unknown): error is ApiError =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  typeof (error as { code: unknown }).code === 'string';

export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === 'string' && value in MESSAGES;

/** Mensagem traduzida para qualquer erro devolvido pelo cliente gerado. */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error) && isErrorCode(error.code)) return MESSAGES[error.code]();
  if (error instanceof TypeError) return m.error_network(); // fetch falhou: sem rede
  return m.error_unknown();
}

/** Código de um erro da API (para decisões de fluxo, ex.: 'session_expired'). */
export const getErrorCode = (error: unknown): ErrorCode | null =>
  isApiError(error) && isErrorCode(error.code) ? error.code : null;
