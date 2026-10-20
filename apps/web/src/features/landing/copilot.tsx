import { Link } from '@tanstack/react-router';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { CopilotChat } from './copilot-chat';
import { CONTAINER, CTA_PRIMARY, Heading, MONO, Section } from './layout';
import { sectionNumber } from './sections';

/** Copiloto: secção escura. À esquerda o título e as três garantias (o verificador em destaque), à direita a conversa. */
export function Copilot() {
  const points = [
    m.landing_copilot_point_1(),
    m.landing_copilot_point_2(),
    m.landing_copilot_point_3(),
  ];
  return (
    <Section id="copiloto" tone="dark">
      <div className={`${CONTAINER} grid gap-12 lg:grid-cols-12 lg:gap-16`}>
        <div className="flex flex-col gap-10 lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
          <Heading
            id="copiloto"
            n={sectionNumber('copiloto')}
            size="md"
            eyebrow={m.landing_copilot_eyebrow()}
            title={m.landing_copilot_title()}
            lead={m.landing_copilot_lead()}
          />
          <ol data-reveal="" data-fx="stagger" className="flex flex-col gap-3">
            {points.map((p, i) => (
              <li
                key={p}
                data-s=""
                style={{ '--i': i } as React.CSSProperties}
                className={cn(
                  'flex gap-4 rounded-2xl border p-4',
                  i === 1 ? 'border-primary/50 bg-primary/10' : 'border-transparent px-0',
                )}
              >
                {i === 1 ? (
                  <ShieldCheck
                    className="mt-0.5 size-5 shrink-0 text-primary"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                ) : (
                  <span aria-hidden="true" className={cn(MONO, 'mt-0.5 w-5 shrink-0 text-primary')}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                )}
                <span
                  className={cn(
                    'text-pretty leading-relaxed',
                    i === 1 ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {p}
                </span>
              </li>
            ))}
          </ol>
          <Button asChild size="lg" className={cn(CTA_PRIMARY, 'lp-press w-fit gap-2')}>
            <Link to="/register">
              {m.landing_cp_cta()}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <div className="min-w-0 lg:col-span-7">
          <CopilotChat />
        </div>
      </div>
    </Section>
  );
}
