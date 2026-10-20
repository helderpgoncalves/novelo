/**
 * O token do convite vive no URL só até ser lido: a página tira-o de lá (não fica no histórico nem em capturas) e
 * guarda-o na sessão do separador para sobreviver a um refresh. Nunca em localStorage.
 */
const KEY = 'novelo.invite.token';

/** Um token opaco: letras, números, `-` e `_`, com um tamanho razoável. Qualquer outra coisa nem é enviada à API. */
export const looksLikeToken = (value: string | null | undefined): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{16,256}$/.test(value);

export function readToken(urlToken: string | undefined): string | null {
  if (looksLikeToken(urlToken)) {
    try {
      window.sessionStorage.setItem(KEY, urlToken);
    } catch {
      // sem armazenamento: o token fica só em memória
    }
    return urlToken;
  }
  try {
    const stored = window.sessionStorage.getItem(KEY);
    return looksLikeToken(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function forgetToken(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // nada a fazer
  }
}
