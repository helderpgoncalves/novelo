import { Link } from '@tanstack/react-router';
import { CalendarClock, Check, MapPinned } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';

const NEXT = [
  () => m.cov_awaiting_next_1(),
  () => m.cov_awaiting_next_2(),
  () => m.cov_awaiting_next_3(),
  () => m.cov_awaiting_next_4(),
];

/** Estado "à espera de dados": explica o que falta, o que já se sabe e o que vai aparecer, sem parecer erro. */
export function AwaitingPanel() {
  return (
    <section
      aria-labelledby="cov-awaiting-title"
      className="space-y-6 rounded-xl border border-dashed border-areia/70 bg-areia/10 p-6 sm:p-8"
    >
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-foreground/10">
          <CalendarClock className="size-5 text-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-2">
          <p className="eyebrow">{m.cov_awaiting_eyebrow()}</p>
          <h2
            id="cov-awaiting-title"
            className="text-balance text-[1.4rem] leading-snug sm:text-2xl"
          >
            {m.cov_awaiting_title()}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{m.cov_awaiting_text()}</p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
          {m.cov_awaiting_known()}
        </h3>
        <p className="text-sm leading-relaxed">{m.cov_awaiting_known_text()}</p>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
          {m.cov_awaiting_next()}
        </h3>
        <ul className="space-y-2.5">
          {NEXT.map((text) => (
            <li key={text()} className="flex items-start gap-3 text-sm leading-relaxed">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {text()}
            </li>
          ))}
        </ul>
      </div>

      <Button asChild variant="outline" className="h-10">
        <Link to="/map">
          <MapPinned aria-hidden="true" />
          {m.cov_awaiting_action()}
        </Link>
      </Button>
    </section>
  );
}
