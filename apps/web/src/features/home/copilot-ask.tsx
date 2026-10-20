import { MessageCircle, SendHorizontal } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { openCopilot } from '@/features/copilot/store';
import { formatEur, formatNumber } from '@/lib/format';
import { formatList } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import type { QuestionInputs } from './derive';

/** As três perguntas sugeridas, geradas a partir dos dados atuais (nunca fixas no texto). */
export function suggestedQuestions(q: QuestionInputs): string[] {
  const out: string[] = [];
  if (q.topParishes.length > 0) out.push(m.home_ask_q1({ parishes: formatList(q.topParishes) }));
  out.push(m.home_ask_q2({ t: formatNumber(q.targetT) }));
  out.push(
    q.budgetEur
      ? m.home_ask_q3_budget({ from: formatEur(q.budgetEur), to: formatEur(q.budgetEur * 0.8) })
      : m.home_ask_q3(),
  );
  return out;
}

/** Copiloto na página: perguntas sugeridas e uma caixa que abre o Copiloto já com a pergunta enviada. */
export function CopilotAsk({ inputs }: { inputs: QuestionInputs }) {
  const id = useId();
  const [text, setText] = useState('');
  const questions = suggestedQuestions(inputs);
  return (
    <div className="space-y-3">
      <ul className="flex flex-col gap-2">
        {questions.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => openCopilot({ question: q })}
              className="inline-flex min-h-11 w-full items-center gap-2.5 rounded-xl px-4 py-2 text-left text-sm outline-none ring-1 ring-foreground/15 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/60"
            >
              <MessageCircle className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {q}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const question = text.trim();
          if (!question) return;
          openCopilot({ question });
          setText('');
        }}
      >
        <label htmlFor={id} className="sr-only">
          {m.home_ask_label()}
        </label>
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={m.home_ask_placeholder()}
          maxLength={500}
          className="h-11 min-w-0 flex-1 rounded-xl bg-card px-4 text-base outline-none ring-1 ring-foreground/20 placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60"
        />
        <Button type="submit" className="h-11 gap-2 px-4" disabled={!text.trim()}>
          <SendHorizontal className="size-4" aria-hidden="true" />
          <span className="max-sm:sr-only">{m.home_ask_send()}</span>
        </Button>
      </form>
      <p className="text-muted-foreground text-xs">{m.home_ask_hint()}</p>
    </div>
  );
}
