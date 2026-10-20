import { Link } from '@tanstack/react-router';
import { ChevronDown, Factory, Landmark, Truck } from 'lucide-react';
import { GithubMark } from '@/components/github-mark';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { REPO_URL } from './facts';
import {
  BODY,
  CARD_LIFT,
  CARD_TITLE,
  CONTAINER,
  CTA_PRIMARY,
  CTA_SECONDARY,
  GRID_GAP,
  IconTile,
  LandingSection,
  SECTION_Y,
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
          <li key={p.title} className={`${CARD_LIFT} flex flex-col gap-4`}>
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

/** Convite final: cartão de tinta com o degradé de pontos dither e os três botões (demo, conta, código). */
export function FinalCta() {
  return (
    <section
      id="comecar"
      aria-labelledby="comecar-title"
      className={`lp-defer scroll-mt-[calc(var(--nav-h)+0.5rem)] ${SECTION_Y}`}
    >
      <div data-reveal="" className={CONTAINER}>
        <div className="tx tx-fio tx-dark relative isolate overflow-hidden rounded-2xl bg-[#14211d] p-8 text-[#f4f1ea] lg:p-16">
          <div className="relative flex max-w-2xl flex-col gap-6">
            <h2 id="comecar-title" className="lp-headline">
              {m.landing_cta_title()}
            </h2>
            <p className="lp-lead text-[#f4f1ea]/75">{m.landing_cta_lead()}</p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
              <Button
                asChild
                className={`${CTA_PRIMARY} lp-press h-12 bg-[#f4f1ea] text-[#14211d] text-base hover:bg-[#f4f1ea]/90`}
              >
                <Link to="/login">{m.landing_cta_demo()}</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className={`${CTA_SECONDARY} lp-press h-12 border-[#f4f1ea]/40 bg-transparent text-[#f4f1ea] text-base hover:bg-[#f4f1ea]/10 hover:text-[#f4f1ea]`}
              >
                <Link to="/register">{m.landing_register()}</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className={`${CTA_SECONDARY} lp-press h-12 gap-2 text-[#f4f1ea] text-base hover:bg-[#f4f1ea]/10 hover:text-[#f4f1ea]`}
              >
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                  <GithubMark className="size-4" />
                  {m.landing_cta_code()}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
