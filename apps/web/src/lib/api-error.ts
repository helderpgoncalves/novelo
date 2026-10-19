// A API devolve {code, message, details} nos erros de domínio e {detail: [...]} nas validações (422).
interface ApiErrorBody {
  message?: string;
  detail?: string | { msg: string }[];
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Algo correu mal. Tenta de novo.',
): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const body = error as ApiErrorBody;
    if (body.message) return body.message;
    if (typeof body.detail === 'string') return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  }
  return fallback;
}
