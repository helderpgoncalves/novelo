import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { suggestionsFor } from './page-context';

interface Props {
  /** Padrão da rota onde a pessoa está (`/simulator`), para as perguntas fazerem sentido. */
  route: string | null;
  onPick: (text: string) => void;
  /** `page`: centrado, com cartões e atalhos (página /chat). `panel`: compacto, junto ao campo (⌘K). */
  variant?: 'page' | 'panel';
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] text-foreground">
      {children}
    </kbd>
  );
}

/** Estado vazio: saudação, perguntas à medida do ecrã e, na página, os atalhos do campo. */
export function EmptyChat({ route, onPick, variant = 'panel' }: Props) {
  const suggestions = suggestionsFor(route);

  if (variant === 'page') {
    const shortcuts: { keys: string[]; label: string }[] = [
      { keys: ['Enter'], label: m.cp_key_send() },
      { keys: ['Shift', 'Enter'], label: m.cp_key_newline() },
      { keys: ['@'], label: m.cp_key_mention() },
      { keys: ['/'], label: m.cp_key_command() },
    ];
    return (
      <div
        className="flex min-h-full flex-1 flex-col justify-center gap-8 py-8"
        data-testid="copilot-empty"
      >
        <div className="space-y-2.5">
          <h2 className="font-medium font-serif text-3xl leading-tight tracking-tight">
            {m.copilot_empty_title()}
          </h2>
          <p className="max-w-lg text-muted-foreground text-sm leading-relaxed">
            {m.cp_empty_lead()}
          </p>
        </div>

        <section className="space-y-2.5" aria-labelledby="copilot-empty-start">
          <h3
            id="copilot-empty-start"
            className="font-sans font-semibold text-[0.6875rem] text-muted-foreground uppercase tracking-[0.16em]"
          >
            {m.cp_empty_suggestions_title()}
          </h3>
          <ul
            className="grid gap-2 sm:grid-cols-2"
            aria-label={m.copilot_suggestions_label()}
            data-testid="copilot-empty-suggestions"
          >
            {suggestions.map((s) => (
              <li key={s} className="flex">
                <button
                  type="button"
                  onClick={() => onPick(s)}
                  className="group flex min-h-14 w-full items-start justify-between gap-3 rounded-xl bg-card p-3.5 text-left text-[0.9375rem] leading-snug ring-1 ring-foreground/10 transition-colors hover:ring-primary/40 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span>{s}</span>
                  <ArrowUpRight
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="hidden space-y-2.5 pointer-fine:block"
          aria-labelledby="copilot-empty-keys"
        >
          <h3
            id="copilot-empty-keys"
            className="font-sans font-semibold text-[0.6875rem] text-muted-foreground uppercase tracking-[0.16em]"
          >
            {m.cp_shortcuts_title()}
          </h3>
          <dl className="grid gap-x-6 gap-y-2 text-muted-foreground text-sm sm:grid-cols-2">
            {shortcuts.map((k) => (
              <div key={k.label} className="flex items-center gap-3">
                <dt className="flex min-w-[7.5rem] shrink-0 items-center gap-1">
                  {k.keys.map((key, i) => (
                    <span key={key} className="flex items-center gap-1">
                      {i > 0 && <span aria-hidden="true">+</span>}
                      <Kbd>{key}</Kbd>
                    </span>
                  ))}
                </dt>
                <dd>{k.label}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col justify-end gap-7 pt-10 pb-3">
      <div className="space-y-2.5">
        <h2 className="font-medium font-serif text-[1.75rem] leading-tight tracking-tight sm:text-3xl">
          {m.copilot_empty_title()}
        </h2>
        <p className="max-w-md text-muted-foreground text-sm leading-relaxed">
          {m.cp_empty_lead()}
        </p>
      </div>
      <ul
        className="border-border/70 border-t"
        aria-label={m.copilot_suggestions_label()}
        data-testid="copilot-empty-suggestions"
      >
        {suggestions.map((s) => (
          <li key={s} className="border-border/70 border-b">
            <button
              type="button"
              onClick={() => onPick(s)}
              className="group -mx-1 flex min-h-12 w-[calc(100%+0.5rem)] items-center justify-between gap-4 rounded-md px-1 py-3 text-left text-[0.9375rem] leading-snug transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span>{s}</span>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
