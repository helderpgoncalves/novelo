import { ArrowUpRight, Check, TriangleAlert, X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { GithubMark } from '@/components/github-mark';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { FACTS, QUALITY, REF_LINKS, REPO_URL } from './facts';
import {
  BODY,
  CARD,
  Cite,
  CONTAINER,
  FigCaption,
  Heading,
  MONO,
  Section,
  type Status,
  StatusBadge,
} from './layout';
import { sectionNumber } from './sections';

const stagger = (i: number) => ({ '--i': i }) as CSSProperties;

type Row = {
  key: string;
  param: string;
  value: string;
  source: ReactNode;
  status: Status;
};

/** Tabela 1: pressupostos com valor, fonte e estado (medido, estimativa, pressuposto, calibrado, por verificar, em validação). */
function AssumptionsTable() {
  const rows: Row[] = [
    {
      key: 'collected',
      param: m.landing_row_collected(),
      value: formatTonnes(FACTS.collectedT),
      source: (
        <>
          {m.landing_row_collected_src()}
          <Cite n={4} />
        </>
      ),
      status: 'measured',
    },
    {
      key: 'people',
      param: m.landing_row_people(),
      value: formatNumber(FACTS.inhabitants),
      source: (
        <>
          {m.landing_row_people_src()}
          <Cite n={3} />
        </>
      ),
      status: 'measured',
    },
    {
      key: 'q',
      param: m.landing_row_q(),
      value: m.landing_row_q_val(),
      source: (
        <>
          {m.landing_row_q_src()}
          <Cite n={1} />
        </>
      ),
      status: 'estimate',
    },
    {
      key: 'potential',
      param: m.landing_row_potential(),
      value: `≈ ${formatTonnes(FACTS.potentialT)}`,
      source: m.landing_row_potential_src(),
      status: 'estimate',
    },
    {
      key: 'capture',
      param: m.landing_row_capture(),
      value: formatPercent(FACTS.capturePct),
      source: m.landing_row_capture_src(),
      status: 'estimate',
    },
    {
      key: 'street',
      param: m.landing_row_street(),
      value: formatPercent(FACTS.streetCapturePct),
      source: m.landing_row_street_src(),
      status: 'calibrated',
    },
    {
      key: 'detour',
      param: m.landing_row_detour(),
      value: m.landing_row_detour_val(),
      source: m.landing_row_detour_src(),
      status: 'assumption',
    },
    {
      key: 'costs',
      param: m.landing_row_costs(),
      value: '—',
      source: m.landing_row_costs_src(),
      status: 'validating',
    },
    {
      key: 'locations',
      param: m.landing_row_locations(),
      value: '—',
      source: m.landing_row_locations_src(),
      status: 'validating',
    },
    {
      key: 'france',
      param: m.landing_row_france(),
      value: m.landing_row_france_val(),
      source: (
        <>
          {m.landing_row_france_src()}
          <Cite n={6} />
        </>
      ),
      status: 'unverified',
    },
    {
      key: 'ceiling',
      param: m.landing_row_ceiling(),
      value: m.landing_row_ceiling_val(),
      source: m.landing_row_ceiling_src(),
      status: 'estimate',
    },
  ];
  const cell = 'block px-5 py-0.5 md:table-cell md:px-5 md:py-3.5';
  return (
    <figure data-reveal="" className="flex flex-col gap-4">
      <FigCaption label={m.landing_table_1()}>{m.landing_table_1_title()}</FigCaption>
      <div className="overflow-hidden rounded-[1.375rem] border border-border bg-card">
        <table className="block w-full text-left text-sm md:table">
          <thead className="sr-only md:not-sr-only md:table-header-group">
            <tr className="border-border border-b bg-secondary/50 md:table-row">
              {[
                m.landing_table_param(),
                m.landing_table_value(),
                m.landing_table_source(),
                m.landing_table_status(),
              ].map((h) => (
                <th key={h} scope="col" className={`${MONO} px-5 py-3 font-semibold`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="block divide-y divide-border md:table-row-group">
            {rows.map((r) => (
              <tr
                key={r.key}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 py-3.5 md:table-row md:py-0"
              >
                <th scope="row" className={`${cell} col-span-2 font-medium`}>
                  {r.param}
                </th>
                <td className={`${cell} font-mono tabular-nums`}>{r.value}</td>
                <td
                  className={`${cell} col-span-2 text-muted-foreground max-md:order-last max-md:text-[13px]`}
                >
                  {r.source}
                </td>
                <td className={`${cell} max-md:justify-self-end`}>
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Uma linha do «livro-razão»: ícone, título serifado e texto; a linha de cima desenha-se ao entrar. */
function LedgerRow({
  i,
  icon,
  title,
  text,
}: {
  i: number;
  icon: ReactNode;
  title?: string;
  text: string;
}) {
  return (
    <li data-s="" style={stagger(i)} className="lp-rule relative flex gap-4 pt-5">
      {icon}
      <div className="flex flex-col gap-1.5">
        {title && <h4 className="font-medium font-serif text-xl leading-snug">{title}</h4>}
        <p className={BODY}>{text}</p>
      </div>
    </li>
  );
}

/**
 * Metodologia e rigor: duas colunas, «o que garantimos» e «o que não fazemos», a tabela de pressupostos, as limitações
 * conhecidas, o código e testes e como citar.
 */
export function Rigor() {
  const yes = [
    [m.landing_rigor_verifier_title(), m.landing_rigor_verifier_text()],
    [m.landing_rigor_repro_title(), m.landing_rigor_repro_text()],
    [m.landing_rigor_prov_title(), m.landing_rigor_prov_text()],
    [m.landing_feat_roles_title(), m.landing_feat_roles_text()],
  ] as const;
  const not = [m.landing_not_1(), m.landing_not_2(), m.landing_not_3(), m.landing_not_4()];
  const limits = [
    m.landing_limit_1(),
    m.landing_limit_2(),
    m.landing_limit_3(),
    m.landing_limit_4(),
    m.landing_limit_5(),
  ];
  return (
    <Section id="rigor">
      <div className={`${CONTAINER} flex flex-col gap-12 lg:gap-16`}>
        <Heading
          id="rigor"
          n={sectionNumber('rigor')}
          eyebrow={m.landing_rigor_eyebrow()}
          title={m.landing_rigor_title()}
          lead={m.landing_rigor_lead()}
        />
        <div data-reveal="" data-fx="stagger" className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          <section
            aria-labelledby="rigor-yes"
            className={cn(CARD, 'flex flex-col border-primary/30 bg-accent/60 p-7 sm:p-9')}
          >
            <h3 id="rigor-yes" className="lp-kicker text-primary">
              {m.landing_rigor_yes_title()}
            </h3>
            <ul className="mt-6 flex flex-1 flex-col justify-between gap-6">
              {yes.map(([title, text], i) => (
                <LedgerRow
                  key={title}
                  i={i}
                  title={title}
                  text={text}
                  icon={
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
                    </span>
                  }
                />
              ))}
            </ul>
          </section>
          <div className="flex flex-col gap-4 lg:gap-5">
            <section
              aria-labelledby="rigor-no"
              className={cn(CARD, 'border-dashed bg-transparent p-7 sm:p-9')}
            >
              <h3 id="rigor-no" className="lp-kicker">
                {m.landing_not_title()}
              </h3>
              <ul className="mt-6 flex flex-col gap-6">
                {not.map((t, i) => (
                  <LedgerRow
                    key={t}
                    i={i}
                    text={t}
                    icon={
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-foreground/30 text-muted-foreground">
                        <X className="size-4" strokeWidth={2} aria-hidden="true" />
                      </span>
                    }
                  />
                ))}
              </ul>
            </section>
            <section
              data-s=""
              style={stagger(4)}
              className={cn(CARD, 'border-areia/50 bg-areia/10 p-7 sm:p-9')}
            >
              <h3 className="flex items-center gap-2.5 font-medium text-xl">
                <TriangleAlert
                  className="size-5 text-areia"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {m.landing_limits_title()}
              </h3>
              <ol className="mt-5 flex flex-col gap-3.5">
                {limits.map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(MONO, 'mt-0.5 w-6 shrink-0 text-foreground')}
                    >
                      L{i + 1}
                    </span>
                    <span className={BODY}>{t}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
        <AssumptionsTable />
        <div data-reveal="" data-fx="stagger" className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          <div data-s="" style={stagger(0)} className={cn(CARD, 'flex flex-col gap-3 p-7')}>
            <h3 className="text-xl">{m.landing_quality_title()}</h3>
            <p className={BODY}>
              {m.landing_quality_tests({
                api: formatNumber(QUALITY.api),
                web: formatNumber(QUALITY.web),
                date: QUALITY.date,
              })}
            </p>
            <p className={MONO}>{m.landing_quality_stack()}</p>
          </div>
          <div data-s="" style={stagger(1)} className={cn(CARD, 'flex flex-col gap-3 p-7')}>
            <h3 className="text-xl">{m.landing_cite_title()}</h3>
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
      </div>
    </Section>
  );
}

/** Equipa, próximos passos (linha do tempo que se desenha) e agradecimentos: tipografia grande, sem cartões nem fotografias. */
export function Team() {
  const people = ['Hélder Gonçalves', 'Flávio Fernandes'];
  const next = [m.landing_next_1(), m.landing_next_2(), m.landing_next_3()];
  return (
    <Section id="equipa" tone="band">
      <div className={`${CONTAINER} flex flex-col gap-14 lg:gap-20`}>
        <Heading
          id="equipa"
          n={sectionNumber('equipa')}
          eyebrow={m.landing_team_eyebrow()}
          title={m.landing_team_title()}
          lead={m.landing_team_lead()}
        />
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
          <ul data-reveal="" data-fx="stagger" className="flex flex-col gap-8 lg:col-span-5">
            {people.map((name, i) => (
              <li key={name} data-s="" style={stagger(i)} className="flex items-center gap-5">
                <span
                  aria-hidden="true"
                  className="grid size-16 shrink-0 place-items-center rounded-full border border-primary/40 bg-accent font-medium font-serif text-2xl text-primary"
                >
                  {name
                    .split(' ')
                    .map((p) => p[0])
                    .join('')}
                </span>
                <span className="font-medium font-serif text-[clamp(1.75rem,1.2rem+2vw,2.75rem)] leading-[1.05] tracking-[-0.02em]">
                  {name}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-6 lg:col-span-7">
            <h3 className="lp-kicker">{m.landing_next_title()}</h3>
            <ol
              data-reveal=""
              data-fx="stagger"
              className="lp-timeline relative flex flex-col gap-8"
            >
              {next.map((t, i) => (
                <li key={t} data-s="" style={stagger(i)} className="relative flex gap-5">
                  <span
                    aria-hidden="true"
                    className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full border border-primary bg-background font-mono font-medium text-primary text-sm"
                  >
                    {i + 1}
                  </span>
                  <span className="pt-1 text-pretty text-[1.0625rem] text-foreground/90 leading-relaxed">
                    {t}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-border border-t pt-8">
          <h3 className="lp-kicker">{m.landing_thanks_title()}</h3>
          <p className="max-w-3xl text-pretty font-serif text-2xl leading-snug sm:text-3xl">
            {m.landing_thanks_text()}
          </p>
        </div>
      </div>
    </Section>
  );
}

/** Referências numeradas (notas de fim), ligadas às remissões [n] do texto. */
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
      className="lp-defer scroll-mt-[calc(var(--nav-h)+0.5rem)] py-14 lg:py-20"
    >
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <h2 id="referencias-title" className="lp-kicker">
          {m.landing_refs_title()}
        </h2>
        <ol className="grid gap-x-12 gap-y-3 lg:grid-cols-2">
          {refs.map((text, i) => {
            const n = i + 1;
            const href = REF_LINKS[n];
            return (
              <li
                key={n}
                id={`ref-${n}`}
                className="flex scroll-mt-[calc(var(--nav-h)+1rem)] gap-3 rounded-md text-sm target:bg-primary/10"
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
                        className="whitespace-nowrap text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
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
