import type { CopilotSource } from '@/client';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import type { ChatMessage, WebSearchInfo } from './types';

/** Uma pesquisa em curso fecha-se com o estado final seguinte; sem pesquisa aberta, abre-se uma nova. */
export function applyWebSearch(list: WebSearchInfo[], next: WebSearchInfo): WebSearchInfo[] {
  if (next.state === 'searching') return [...list, next];
  const openIndex = list.findLastIndex((w) => w.state === 'searching');
  if (openIndex === -1) return [...list, next];
  return list.map((w, i) => (i === openIndex ? { ...next, query: next.query ?? w.query } : w));
}

/** Só `https` (ou `http`): nunca `javascript:` nem outros esquemas vindos de um excerto externo. */
export function safeWebUrl(ref: string | null | undefined): string | null {
  if (!ref) return null;
  try {
    const url = new URL(ref);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export const isWebSource = (s: CopilotSource): boolean => s.kind === 'web' || s.external === true;

/** Fontes internas (dados do Novelo) separadas das externas (web), mantendo a ordem. */
export function splitSources(sources: CopilotSource[]): {
  internal: CopilotSource[];
  web: CopilotSource[];
} {
  return {
    internal: sources.filter((s) => !isWebSource(s)),
    web: sources.filter(isWebSource),
  };
}

/** Domínio a mostrar: o que vem do servidor ou o do URL, sem «www.». */
export function sourceDomain(source: CopilotSource): string {
  if (source.domain) return source.domain.replace(/^www\./, '');
  const url = safeWebUrl(source.ref);
  return url ? new URL(url).hostname.replace(/^www\./, '') : '';
}

/** Inicial do domínio para o «favicon» local (nunca se pede nada a serviços de terceiros). */
export function domainInitial(domain: string): string {
  const first = domain.replace(/^www\./, '').charAt(0);
  return first ? first.toLocaleUpperCase() : '·';
}

/** Fontes ao recarregar: o servidor devolve só as web (`web_sources`). */
export function sourcesFromServer(web: CopilotSource[] | undefined): CopilotSource[] {
  return (web ?? []).map((s) => ({ ...s, kind: 'web', external: true }));
}

/** Mensagem curta e discreta para uma pesquisa que não decorreu; `null` quando correu bem. */
export function webSearchNote(info: WebSearchInfo): string | null {
  if (info.state === 'searching' || info.state === 'done') return null;
  switch (info.reason) {
    case 'disabled_by_user':
      return m.chat_web_reason_disabled_by_user();
    case 'disabled_by_system':
      return m.chat_web_reason_disabled_by_system();
    case 'guest':
      return m.chat_web_reason_guest();
    case 'region':
      return m.chat_web_reason_region();
    case 'provider_rejected':
      return m.chat_web_reason_provider_rejected();
    case 'failed':
      return m.chat_web_reason_failed();
    case 'query_blocked':
      return m.chat_web_reason_query_blocked();
    case 'limit_reached':
      return m.chat_web_reason_limit_reached();
    case 'no_results':
      return m.chat_web_reason_no_results();
    case 'budget':
      return m.chat_web_reason_budget();
    default:
      return m.chat_web_reason_unavailable();
  }
}

/** Notas únicas (a mesma razão repetida em várias pesquisas aparece uma vez). */
export function webSearchNotes(list: WebSearchInfo[]): string[] {
  return [...new Set(list.flatMap((w) => webSearchNote(w) ?? []))];
}

/** Linha de uma pesquisa no painel de passos. */
export function webSearchStepText(info: WebSearchInfo): string {
  if (info.state === 'searching') return m.chat_web_searching();
  if (info.state === 'done') return m.chat_web_found({ count: info.results });
  return webSearchNote(info) ?? m.chat_web_reason_unavailable();
}

/** Passos mostrados: ferramentas (sem a `web_search`, que aparece como pesquisa) mais as pesquisas. */
export function stepCount(message: Pick<ChatMessage, 'tools' | 'webSearches'>): number {
  return message.tools.filter((t) => t.name !== 'web_search').length + message.webSearches.length;
}

/** Números externos em pt-PT, para o aviso de verificação. */
export function formatExternalNumbers(numbers: number[]): string {
  return numbers
    .slice(0, 6)
    .map((n) => formatNumber(n, Number.isInteger(n) ? 0 : 2))
    .join('; ');
}
