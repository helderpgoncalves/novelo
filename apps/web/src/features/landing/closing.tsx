import { Link } from '@tanstack/react-router';
import { ChevronDown, Factory, Landmark, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import {
  BODY,
  CARD,
  CARD_SURFACE,
  CARD_TITLE,
  CONTAINER,
  CTA_PRIMARY,
  CTA_SECONDARY,
  GRID_GAP,
  IconTile,
  LandingSection,
  SECTION_Y,
  SymbolWatermark,
} from './layout';

/** Para quem é: três perfis, cartões iguais. */
export function Audience() {
  const people = [
    { icon: Landmark, title: m.landing_aud_council_title(), text: m.landing_aud_council_text() },
    { icon: Truck, title: m.landing_aud_ops_title(), text: m.landing_aud_ops_text() },
    {
      icon: Factory,
      title: m.landing_aud_recyclers_title(),
      text: m.landing_aud_recyclers_text(),
    },
  ];
  return (
    <LandingSection
      id="para-quem"
      eyebrow={m.landing_audience_eyebrow()}
      title={m.landing_audience_title()}
    >
      <ul className={`grid md:grid-cols-3 ${GRID_GAP}`}>
        {people.map((p) => (
          <li key={p.title} className={`${CARD} flex flex-col gap-4`}>
            <IconTile icon={p.icon} />
            <h3 className={CARD_TITLE}>{p.title}</h3>
            <p className={BODY}>{p.text}</p>
          </li>
        ))}
      </ul>
    </LandingSection>
  );
}

/** Perguntas frequentes em `<details>` nativo: teclado, leitores de ecrã e zero JavaScript. */
export function Faq() {
  const items = [
    { q: m.landing_faq_q1(), a: m.landing_faq_a1() },
    { q: m.landing_faq_q2(), a: m.landing_faq_a2() },
    { q: m.landing_faq_q3(), a: m.landing_faq_a3() },
    { q: m.landing_faq_q4(), a: m.landing_faq_a4() },
    { q: m.landing_faq_q5(), a: m.landing_faq_a5() },
    { q: m.landing_faq_q6(), a: m.landing_faq_a6({ count: formatNumber(2751) }) },
  ];
  return (
    <LandingSection
      id="perguntas"
      tone="band"
      eyebrow={m.landing_faq_eyebrow()}
      title={m.landing_faq_title()}
    >
      <div className="max-w-3xl divide-y divide-border overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        {items.map((item) => (
          <details key={item.q} name="faq" className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-medium outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown
                className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </summary>
            <p className={`${BODY} px-6 pb-5`}>{item.a}</p>
          </details>
        ))}
      </div>
    </LandingSection>
  );
}

/** Convite final: o mesmo cartão, com o símbolo da marca como marca de água. */
export function FinalCta() {
  return (
    <section id="comecar" aria-labelledby="comecar-title" className={`scroll-mt-16 ${SECTION_Y}`}>
      <div data-reveal="" className={CONTAINER}>
        <div className={`${CARD_SURFACE} relative overflow-hidden p-8 lg:p-14`}>
          <SymbolWatermark className="-right-16 -bottom-20 hidden sm:block" />
          <div className="relative flex max-w-2xl flex-col gap-6">
            <h2 id="comecar-title" className="lp-headline">
              {m.landing_cta_title()}
            </h2>
            <p className="lp-lead text-muted-foreground">{m.landing_cta_lead()}</p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button asChild className={CTA_PRIMARY}>
                <Link to="/login">{m.landing_sign_in()}</Link>
              </Button>
              <Button asChild variant="outline" className={CTA_SECONDARY}>
                <Link to="/register">{m.landing_register()}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
