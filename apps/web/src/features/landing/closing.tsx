import { Link } from '@tanstack/react-router';
import { ArrowRight, Landmark, Plus, Shirt, Truck } from 'lucide-react';
import type { CSSProperties } from 'react';
import { GithubMark } from '@/components/github-mark';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { FACTS, REPO_URL } from './facts';
import { BODY, CONTAINER, Heading, MONO, SECTION_Y, Section } from './layout';
import { sectionNumber } from './sections';

/**
 * Para quem é: cabeçalho com a prioridade comum (reutilizar antes de reciclar) e três colunas editoriais (ícone, nome em serifa,
 * texto e o que cada um usa), separadas por fios; em telemóvel empilham.
 */
export function Audience() {
  const people = [
    {
      icon: Landmark,
      title: m.landing_aud_council_title(),
      text: m.landing_aud_council_text(),
      tags: m.landing_aud_council_tags(),
    },
    {
      icon: Truck,
      title: m.landing_aud_ops_title(),
      text: m.landing_aud_ops_text(),
      tags: m.landing_aud_ops_tags(),
    },
    {
      icon: Shirt,
      title: m.landing_aud_reuse_title(),
      text: m.landing_aud_reuse_text(),
      tags: m.landing_aud_reuse_tags(),
    },
  ];
  return (
    <Section id="para-quem" className="border-border border-t">
      <div className={`${CONTAINER} flex flex-col gap-10 lg:gap-14`}>
        <Heading
          id="para-quem"
          n={sectionNumber('para-quem')}
          eyebrow={m.landing_audience_eyebrow()}
          title={m.landing_audience_title()}
          lead={m.landing_audience_lead()}
        />
        <ul
          data-reveal=""
          data-fx="stagger"
          className="grid border-border border-t md:grid-cols-3 md:divide-x md:divide-border max-md:divide-y max-md:divide-border"
        >
          {people.map((p, i) => (
            <li
              key={p.title}
              data-s=""
              style={{ '--i': i } as CSSProperties}
              className="lp-aud group flex flex-col gap-4 py-8 md:px-7 md:py-9 md:first:pl-0 md:last:pr-0"
            >
              <span className="flex items-center gap-3">
                <span className={`${MONO} tabular-nums`}>{String(i + 1).padStart(2, '0')}</span>
                <p.icon
                  className="size-6 text-primary transition-transform duration-500 group-hover:-translate-y-0.5"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </span>
              <h3 className="font-medium font-serif text-[clamp(1.625rem,1.3rem+1vw,2.125rem)] leading-tight tracking-[-0.02em] text-balance">
                {p.title}
              </h3>
              <p className={`${BODY} text-[1.0625rem]`}>{p.text}</p>
              <p
                className={`${MONO} mt-auto border-border border-t border-dashed pt-4 text-foreground/80`}
              >
                {p.tags}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/** Perguntas frequentes em `<details>` nativo (teclado, leitores de ecrã, zero JavaScript): título fixo à esquerda, lista à direita. */
export function Faq() {
  const items = [
    { q: m.landing_faq_q1(), a: m.landing_faq_a1() },
    { q: m.landing_faq_q2(), a: m.landing_faq_a2() },
    { q: m.landing_faq_q3(), a: m.landing_faq_a3() },
    { q: m.landing_faq_q4(), a: m.landing_faq_a4() },
    { q: m.landing_faq_q5(), a: m.landing_faq_a5() },
    {
      q: m.landing_faq_q6(),
      a: m.landing_faq_a6({ count: formatNumber(FACTS.municipalContainers) }),
    },
  ];
  return (
    <Section id="perguntas" tone="band">
      <div className={`${CONTAINER} grid gap-12 lg:grid-cols-12 lg:gap-16`}>
        <Heading
          id="perguntas"
          n={sectionNumber('perguntas')}
          size="md"
          eyebrow={m.landing_faq_eyebrow()}
          title={m.landing_faq_title()}
          className="lg:sticky lg:top-28 lg:col-span-4 lg:self-start"
        />
        <div className="divide-y divide-border border-border border-y lg:col-span-8">
          {items.map((item, i) => (
            <details key={item.q} name="faq" open={i === 0} className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 font-medium font-serif text-xl outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:text-2xl [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus
                  className="size-6 shrink-0 text-primary transition-transform duration-300 group-open:rotate-45"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </summary>
              <p className={`${BODY} max-w-2xl pb-6 text-[1.0625rem]`}>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

/** Convite final: cartão de tinta a toda a largura com a Plataforma das Artes em meio-tom, título grande e os botões. */
export function FinalCta() {
  return (
    <section
      id="comecar"
      aria-labelledby="comecar-title"
      className={`lp-defer scroll-mt-[calc(var(--nav-h)+0.5rem)] ${SECTION_Y}`}
    >
      <div data-reveal="" data-fx="scale" className={CONTAINER}>
        <div className="photo-bg photo-plataforma photo-dark relative isolate flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-[1.75rem] bg-[#14211d] p-7 text-[#f4f1ea] max-sm:-mx-4 max-sm:rounded-[1.75rem] sm:p-12 lg:min-h-[32rem] lg:p-16">
          <div className="relative flex max-w-3xl flex-col gap-6">
            <h2 id="comecar-title" className="lp-headline lp-h-xl">
              {m.landing_cta_title()}
            </h2>
            <p className="lp-lead max-w-xl text-[#f4f1ea]/80">{m.landing_cta_lead()}</p>
            <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                asChild
                className="lp-press h-[3.25rem] gap-2 bg-[#f4f1ea] px-7 font-semibold text-[#14211d] text-base hover:bg-[#f4f1ea]/90 sm:h-12"
              >
                <Link to="/login">
                  {m.landing_cta_demo()}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="lp-press h-[3.25rem] border-[#f4f1ea]/45 bg-transparent px-6 font-medium text-[#f4f1ea] text-base hover:bg-[#f4f1ea]/10 hover:text-[#f4f1ea] sm:h-12"
              >
                <Link to="/register">{m.landing_register()}</Link>
              </Button>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-press inline-flex min-h-11 items-center gap-2 rounded-md px-2 font-medium text-[#f4f1ea] text-base underline decoration-[#f4f1ea]/40 underline-offset-[0.3em] outline-none hover:decoration-current focus-visible:ring-2 focus-visible:ring-[#f4f1ea]"
              >
                <GithubMark className="size-4" />
                {m.landing_cta_code()}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
