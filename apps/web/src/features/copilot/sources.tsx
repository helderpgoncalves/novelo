import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Globe, SearchX } from 'lucide-react';
import type { CopilotSource } from '@/client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { toolLabel } from './labels';
import type { ChatMessage } from './types';
import {
  domainInitial,
  safeWebUrl,
  sourceDomain,
  splitSources,
  webSearchNotes,
  webSearchStepText,
} from './web';

/** Cartão de uma fonte externa: inicial do domínio (sem pedidos a terceiros), título, domínio e excerto. */
export function WebSourceCard({ source }: { source: CopilotSource }) {
  const href = safeWebUrl(source.ref);
  const domain = sourceDomain(source);
  const title = source.label || domain;
  const body = (
    <>
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 font-serif text-primary text-sm"
      >
        {domainInitial(domain)}
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="min-w-0 break-words font-medium text-[0.8125rem] text-foreground leading-snug">
            {title}
          </span>
          <span className="inline-flex shrink-0 items-center rounded-full border border-areia/60 bg-areia/10 px-1.5 py-px text-[10px] text-foreground/80 uppercase leading-4 tracking-wide">
            {m.chat_source_external_tag()}
          </span>
        </span>
        {domain && <span className="block truncate text-muted-foreground">{domain}</span>}
        {source.excerpt && (
          <span className="line-clamp-2 block break-words text-muted-foreground leading-snug">
            {source.excerpt}
          </span>
        )}
      </span>
      {href && (
        <ArrowUpRight
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </>
  );
  const cls = 'flex min-h-11 items-start gap-2.5 rounded-lg border bg-background px-3 py-2.5';
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label={m.chat_source_open({ title, domain })}
      data-testid="copilot-web-source"
      className={cn(
        cls,
        'transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
      )}
    >
      {body}
    </a>
  ) : (
    <div data-testid="copilot-web-source" className={cls}>
      {body}
    </div>
  );
}

/** Rodapé «Fontes»: dados do Novelo primeiro, fontes externas (web) à parte e rotuladas. */
export function SourcesPanel({ message }: { message: Pick<ChatMessage, 'sources'> }) {
  const { internal, web } = splitSources(message.sources);
  return (
    <div className="space-y-3">
      {internal.length > 0 && (
        <section className="space-y-1.5">
          {web.length > 0 && (
            <h3 className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
              {m.chat_sources_internal()}
            </h3>
          )}
          <ul className="flex flex-wrap gap-1.5">
            {internal.map((s, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fontes podem repetir o rótulo
              <li key={i}>
                {s.ref?.startsWith('/') ? (
                  <Link
                    to={s.ref as never}
                    className="inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 py-0.5 hover:bg-muted"
                  >
                    {s.label}
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="inline-flex min-h-8 items-center rounded-full border px-2.5 py-0.5 text-muted-foreground">
                    {s.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {web.length > 0 && (
        <section className="space-y-1.5" data-testid="copilot-web-sources">
          <h3 className="flex items-center gap-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
            <Globe className="size-3" strokeWidth={1.75} aria-hidden="true" />
            {m.chat_sources_external({ count: web.length })}
          </h3>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {web.map((s, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: duas fontes podem ter o mesmo URL
              <li key={`${s.ref ?? s.label}-${i}`} className="min-w-0">
                <WebSourceCard source={s} />
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground leading-snug">{m.chat_sources_external_note()}</p>
        </section>
      )}
    </div>
  );
}

/** Pesquisas na web e ferramentas, no painel «Passos». */
export function WebSearchSteps({ message }: { message: Pick<ChatMessage, 'webSearches'> }) {
  return (
    <>
      {message.webSearches.map((w, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: as pesquisas chegam por ordem
          key={i}
          className="flex flex-wrap items-baseline gap-x-2 rounded-md bg-muted/50 px-2 py-1"
          data-testid="copilot-web-step"
        >
          <Globe className="size-3 shrink-0 self-center text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">{toolLabel('web_search')}</span>
          {w.query && (
            <span className="min-w-0 break-words text-muted-foreground">«{w.query}»</span>
          )}
          <span className="ml-auto text-muted-foreground">{webSearchStepText(w)}</span>
        </li>
      ))}
    </>
  );
}

/** Aviso discreto (nunca vermelho): a pesquisa não correu e o copiloto seguiu com dados do Novelo. */
export function WebSearchNotes({ message }: { message: Pick<ChatMessage, 'webSearches'> }) {
  const notes = webSearchNotes(message.webSearches);
  if (notes.length === 0) return null;
  return (
    <div data-testid="copilot-web-note" className="space-y-1">
      {notes.map((note) => (
        <p
          key={note}
          role="note"
          className="flex items-start gap-1.5 text-muted-foreground text-xs leading-snug"
        >
          <SearchX className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {note}
        </p>
      ))}
    </div>
  );
}
