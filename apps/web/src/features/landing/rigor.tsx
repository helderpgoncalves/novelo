import { ArrowUpRight, Library, Repeat, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { GithubMark } from '@/components/github-mark';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { QUALITY, REF_LINKS, REPO_URL } from './facts';
import {
  BODY,
  CARD,
  CARD_LIFT,
  CARD_TITLE,
  CONTAINER,
  GRID_GAP,
  IconTile,
  LandingSection,
  MONO,
} from './layout';

/** Metodologia e rigor: três garantias, o que o Novelo não faz, limitações conhecidas, código/testes e como citar. */
export function Rigor() {
  const pillars = [
    {
      icon: ShieldCheck,
      title: m.landing_rigor_verifier_title(),
      text: m.landing_rigor_verifier_text(),
    },
    { icon: Repeat, title: m.landing_rigor_repro_title(), text: m.landing_rigor_repro_text() },
    { icon: Library, title: m.landing_rigor_prov_title(), text: m.landing_rigor_prov_text() },
  ];
  const not = [m.landing_not_1(), m.landing_not_2(), m.landing_not_3(), m.landing_not_4()];
  const limits = [
    m.landing_limit_1(),
    m.landing_limit_2(),
    m.landing_limit_3(),
    m.landing_limit_4(),
    m.landing_limit_5(),
  ];
  return (
    <LandingSection
      id="rigor"
      eyebrow={m.landing_rigor_eyebrow()}
      title={m.landing_rigor_title()}
      lead={m.landing_rigor_lead()}
    >
      <ul className={`grid md:grid-cols-3 ${GRID_GAP}`}>
        {pillars.map((p) => (
          <li key={p.title} className={`${CARD_LIFT} flex flex-col gap-4`}>
            <IconTile icon={p.icon} />
            <h3 className={CARD_TITLE}>{p.title}</h3>
            <p className={BODY}>{p.text}</p>
          </li>
        ))}
      </ul>
      <div className={`grid lg:grid-cols-2 ${GRID_GAP}`}>
        <div className={`${CARD} flex flex-col gap-4`}>
          <h3 className={CARD_TITLE}>{m.landing_not_title()}</h3>
          <ul className="flex flex-col gap-3">
            {not.map((t) => (
              <li key={t} className="flex gap-3">
                <X
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className={BODY}>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={`${CARD} flex flex-col gap-4`}>
          <h3 className={CARD_TITLE}>{m.landing_limits_title()}</h3>
          <ul className="flex flex-col gap-3">
            {limits.map((t) => (
              <li key={t} className="flex gap-3">
                <TriangleAlert
                  className="mt-0.5 size-5 shrink-0 text-areia"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className={BODY}>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={`grid lg:grid-cols-2 ${GRID_GAP}`}>
        <div className={`${CARD} flex flex-col gap-4`}>
          <h3 className={CARD_TITLE}>{m.landing_quality_title()}</h3>
          <p className={BODY}>
            {m.landing_quality_tests({
              api: formatNumber(QUALITY.api),
              web: formatNumber(QUALITY.web),
              date: QUALITY.date,
            })}
          </p>
          <p className={MONO}>{m.landing_quality_stack()}</p>
        </div>
        <div className={`${CARD} flex flex-col gap-4`}>
          <h3 className={CARD_TITLE}>{m.landing_cite_title()}</h3>
          <p className={`${MONO} text-pretty text-foreground`}>{m.landing_cite_text()}</p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-sm font-medium text-primary text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            <GithubMark className="size-4" />
            {m.landing_cite_repo()}: github.com/helderpgoncalves/novelo
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </LandingSection>
  );
}

/** Equipa, próximos passos e agradecimentos (sem fotografias: iniciais). */
export function Team() {
  const people = ['Hélder Gonçalves', 'Flávio Fernandes'];
  const next = [m.landing_next_1(), m.landing_next_2(), m.landing_next_3()];
  return (
    <LandingSection
      id="equipa"
      tone="band"
      eyebrow={m.landing_team_eyebrow()}
      title={m.landing_team_title()}
      lead={m.landing_team_lead()}
    >
      <div className={`grid lg:grid-cols-3 ${GRID_GAP}`}>
        <ul className={`${CARD} flex flex-col gap-4`}>
          {people.map((name) => (
            <li key={name} className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="grid size-12 place-items-center rounded-full bg-accent font-medium font-serif text-lg text-primary"
              >
                {name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')}
              </span>
              <span className="font-medium font-serif text-xl">{name}</span>
            </li>
          ))}
        </ul>
        <div className={`${CARD} flex flex-col gap-4`}>
          <h3 className={CARD_TITLE}>{m.landing_next_title()}</h3>
          <ol className="flex flex-col gap-3">
            {next.map((t, i) => (
              <li key={t} className="flex gap-3">
                <span className={`${MONO} mt-0.5 w-5 text-foreground`}>{i + 1}</span>
                <span className={BODY}>{t}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className={`${CARD} flex flex-col gap-4`}>
          <h3 className={CARD_TITLE}>{m.landing_thanks_title()}</h3>
          <p className={BODY}>{m.landing_thanks_text()}</p>
        </div>
      </div>
    </LandingSection>
  );
}

/** Referências numeradas, ligadas às remissões [n] do texto. */
export function References() {
  const refs = [
    m.landing_ref_1(),
    m.landing_ref_2(),
    m.landing_ref_3(),
    m.landing_ref_4(),
    m.landing_ref_5(),
    m.landing_ref_6(),
  ];
  return (
    <section
      id="referencias"
      aria-labelledby="referencias-title"
      className={`lp-defer scroll-mt-[calc(var(--nav-h)+0.5rem)] py-10 lg:py-14`}
    >
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <h2 id="referencias-title" className="font-serif text-2xl">
          {m.landing_refs_title()}
        </h2>
        <ol className="grid max-w-3xl gap-3">
          {refs.map((text, i) => {
            const n = i + 1;
            const href = REF_LINKS[n];
            return (
              <li
                key={n}
                id={`ref-${n}`}
                className="flex scroll-mt-[calc(var(--nav-h)+1rem)] gap-3 text-sm target:rounded-md target:bg-primary/10"
              >
                <span className={`${MONO} w-7 shrink-0 text-foreground`}>[{n}]</span>
                <span className="text-pretty text-muted-foreground leading-relaxed">
                  {text}
                  {href && (
                    <>
                      {' '}
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {new URL(href).hostname}
                      </a>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
