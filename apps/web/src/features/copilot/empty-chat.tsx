import { ArrowRight } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { suggestionsFor } from './page-context';

interface Props {
  /** Padrão da rota onde a pessoa está (`/simulator`), para as perguntas fazerem sentido. */
  route: string | null;
  onPick: (text: string) => void;
}

/** Estado vazio sóbrio: uma saudação e três perguntas, em linhas com fio, sensíveis ao ecrã. */
export function EmptyChat({ route, onPick }: Props) {
  const suggestions = suggestionsFor(route);
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
