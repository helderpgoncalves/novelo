import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Map as MapIcon, ScanLine, SlidersHorizontal, Sparkles } from 'lucide-react';
import { openCopilot } from '@/features/copilot/store';
import { m } from '@/paraglide/messages';

const TILE =
  'group flex min-h-16 items-center gap-3 rounded-lg bg-card p-4 text-left ring-1 ring-foreground/10 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/60';

function TileBody({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-sm">{title}</span>
        <span className="block text-muted-foreground text-xs leading-snug">{hint}</span>
      </span>
      <ArrowUpRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        aria-hidden="true"
      />
    </>
  );
}

/** Atalhos de ação e perguntas de exemplo para o copiloto. */
export function Shortcuts() {
  const questions = [m.home_q1(), m.home_q2(), m.home_q3()];
  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <li>
          <Link to="/simulator" className={TILE}>
            <TileBody
              icon={<SlidersHorizontal className="size-5" aria-hidden="true" />}
              title={m.home_act_simulate()}
              hint={m.home_act_simulate_hint()}
            />
          </Link>
        </li>
        <li>
          <Link to="/triage" className={TILE}>
            <TileBody
              icon={<ScanLine className="size-5" aria-hidden="true" />}
              title={m.home_act_triage()}
              hint={m.home_act_triage_hint()}
            />
          </Link>
        </li>
        <li>
          <Link to="/coverage" search={{ radius: 300 }} className={TILE}>
            <TileBody
              icon={<MapIcon className="size-5" aria-hidden="true" />}
              title={m.home_act_coverage()}
              hint={m.home_act_coverage_hint()}
            />
          </Link>
        </li>
        <li>
          <button type="button" className={`${TILE} w-full`} onClick={() => openCopilot()}>
            <TileBody
              icon={<Sparkles className="size-5" aria-hidden="true" />}
              title={m.home_act_copilot()}
              hint={m.home_act_copilot_hint()}
            />
          </button>
        </li>
      </ul>
      <div className="space-y-2">
        <p className="eyebrow">{m.home_ask_title()}</p>
        <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {questions.map((q) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => openCopilot({ question: q })}
                className="inline-flex min-h-10 w-full items-center gap-2 rounded-full px-4 py-2 text-left text-sm outline-none ring-1 ring-foreground/20 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:w-auto"
              >
                <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                {q}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
