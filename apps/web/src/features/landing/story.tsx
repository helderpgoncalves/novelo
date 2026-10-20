import { useRef } from 'react';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { useInViewOnce } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { CountUp } from './count-up';
import { FACTS } from './facts';
import {
  BODY,
  CARD,
  CARD_TITLE,
  Cite,
  Estimate,
  FigCaption,
  GRID_GAP,
  LandingSection,
  MONO,
  STAT,
} from './layout';

/** O problema: captação atual face ao potencial (estimativa), a referência francesa (por verificar) e o prazo europeu. */
export function Problem() {
  return (
    <LandingSection
      id="problema"
      eyebrow={m.landing_problem_eyebrow()}
      title={m.landing_problem_title()}
      lead={
        <>
          {m.landing_problem_lead()}
          <Cite n={4} />
          <Cite n={1} />
          <Cite n={3} />
        </>
      }
    >
      <div className={`grid lg:grid-cols-2 ${GRID_GAP}`}>
        <div className={`${CARD} tx tx-campo relative flex flex-col gap-5 overflow-hidden`}>
          <h3 className={`${CARD_TITLE} relative`}>{m.landing_gap_title()}</h3>
          <div className="relative space-y-2">
            <p className={STAT}>
              <CountUp value={FACTS.capturePct} format={(n) => formatPercent(n)} />
              <Estimate />
            </p>
            <p className="font-medium">{m.landing_gap_value_label()}</p>
          </div>
          <div
            role="img"
            aria-label={`${formatPercent(FACTS.capturePct)} ${m.landing_gap_value_label()} (${m.landing_estimate_tag()})`}
            className="relative h-3 overflow-hidden rounded-full border border-border bg-secondary"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${FACTS.capturePct}%` }}
            />
          </div>
          <dl className="relative grid grid-cols-2 gap-4 border-border border-t pt-5 text-sm">
            <div>
              <dt className="text-muted-foreground">{m.landing_gap_collected()}</dt>
              <dd className="mt-1 font-medium tabular-nums">{formatTonnes(FACTS.collectedT)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{m.landing_gap_potential()}</dt>
              <dd className="mt-1 font-medium tabular-nums">
                {m.landing_gap_potential_value({ value: formatTonnes(1317, 0) })}
                <Estimate />
              </dd>
            </div>
          </dl>
        </div>
        <div className={`${CARD} flex flex-col gap-5`}>
          <h3 className={CARD_TITLE}>{m.landing_benchmark_title()}</h3>
          <div className="space-y-2">
            <p className={STAT}>
              {m.landing_benchmark_vs({ a: formatNumber(1.92, 2), b: formatNumber(4.27, 2) })}
            </p>
            <p className="font-medium">{m.landing_benchmark_label()}</p>
          </div>
          <p className="mt-auto border-border border-t pt-5 text-muted-foreground text-sm leading-relaxed">
            {m.landing_benchmark_source()}
            <Cite n={6} />
          </p>
        </div>
      </div>
      <p className={`${BODY} max-w-3xl`}>
        {m.landing_problem_directive()}
        <Cite n={2} />
      </p>
    </LandingSection>
  );
}

/** Um nó do pipeline: número, título e subtítulo mono. */
function PipeNode({
  n,
  title,
  sub,
  accent = false,
  link,
}: {
  n: number;
  title: string;
  sub: string;
  accent?: boolean;
  /** Conector para o nó seguinte (só em linha, a partir de `lg`): `seen` dispara o desenho. */
  link?: { seen: boolean; delay: number };
}) {
  return (
    <li
      className={cn(
        'relative flex flex-col gap-1 rounded-lg border bg-card p-4',
        accent ? 'border-primary/50' : 'border-border',
      )}
    >
      <span className={MONO}>{String(n).padStart(2, '0')}</span>
      <span className="font-medium font-serif text-xl leading-tight">{title}</span>
      <span className={MONO}>{sub}</span>
      {link && (
        <span
          data-in={link.seen}
          style={{ transitionDelay: `${link.delay}ms` }}
          className="pointer-events-none absolute top-9 -right-6 hidden h-px w-6 origin-left scale-x-0 bg-primary transition-transform duration-700 ease-out data-[in=true]:scale-x-100 lg:block"
        />
      )}
    </li>
  );
}

/**
 * Fig. 1: dados → procura → otimizador → cenários → Copiloto, com o verificador de números a vigiar o Copiloto.
 * Os conectores desenham-se ao entrar (transform, uma vez); sem movimento aparece tudo.
 */
function Pipeline() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInViewOnce(ref);
  const nodes = [
    [m.landing_pipe_data(), m.landing_pipe_data_sub()],
    [m.landing_pipe_demand(), m.landing_pipe_demand_sub()],
    [m.landing_pipe_solver(), m.landing_pipe_solver_sub()],
    [m.landing_pipe_scenarios(), m.landing_pipe_scenarios_sub()],
    [m.landing_pipe_copilot(), m.landing_pipe_copilot_sub()],
  ] as const;
  return (
    <figure ref={ref} data-in={seen} className="flex flex-col gap-4">
      <div role="img" aria-label={m.landing_pipe_label()}>
        <ol className="grid gap-5 lg:grid-cols-5 lg:gap-6" aria-hidden="true">
          {nodes.map(([title, sub], i) => (
            <PipeNode
              key={title}
              n={i + 1}
              title={title}
              sub={sub}
              accent={i === 2}
              link={i < nodes.length - 1 ? { seen, delay: i * 140 } : undefined}
            />
          ))}
        </ol>
        <div className="mt-5 flex justify-end">
          <p
            aria-hidden="true"
            className={cn(
              MONO,
              'rounded-lg border border-primary/50 border-dashed bg-primary/5 px-4 py-2 text-foreground transition-opacity duration-700 lg:w-[calc(20%-1.2rem)]',
              seen ? 'opacity-100' : 'opacity-0',
            )}
          >
            ✓ {m.landing_pipe_verifier()}
          </p>
        </div>
      </div>
      <FigCaption label={m.landing_fig_1()}>{m.landing_fig_1_caption()}</FigCaption>
    </figure>
  );
}

/** Método: o modelo em três linhas, a calibração com dados reais e o pipeline (Fig. 1), mais os três passos. */
export function HowItWorks() {
  const steps = [
    { title: m.landing_how_1_title(), text: m.landing_how_1_text() },
    { title: m.landing_how_2_title(), text: m.landing_how_2_text() },
    { title: m.landing_how_3_title(), text: m.landing_how_3_text() },
  ];
  return (
    <LandingSection
      id="metodo"
      tone="band"
      eyebrow={m.landing_method_eyebrow()}
      title={m.landing_method_title()}
      lead={m.landing_method_lead()}
    >
      <Pipeline />
      <ol className={`grid md:grid-cols-3 ${GRID_GAP}`}>
        {steps.map((s, i) => (
          <li key={s.title} className={`${CARD} flex flex-col gap-4`}>
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-md bg-accent font-medium font-serif text-primary text-xl"
            >
              {i + 1}
            </span>
            <h3 className={CARD_TITLE}>{s.title}</h3>
            <p className={BODY}>{s.text}</p>
          </li>
        ))}
      </ol>
      <div className={`grid items-stretch lg:grid-cols-2 ${GRID_GAP}`}>
        <div className={`${CARD} flex flex-col gap-4`}>
          <h3 className={CARD_TITLE}>{m.landing_formulas_title()}</h3>
          <dl className="grid gap-4 font-mono text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">{m.landing_formula_demand()}</dt>
              <dd className="mt-1 text-base">
                D<sub>z</sub> = P<sub>z</sub> · q · 12
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{m.landing_formula_capture()}</dt>
              <dd className="mt-1 text-base">
                C<sub>z</sub> = D<sub>z</sub> · c<sub>m</sub>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{m.landing_formula_cost()}</dt>
              <dd className="mt-1 text-base">
                €/t = custo anual ÷ Σ C<sub>z</sub>
              </dd>
            </div>
          </dl>
        </div>
        <div className={`${CARD} flex flex-col justify-between gap-4`}>
          <p className={BODY}>
            {m.landing_method_calibration()}
            <Cite n={4} />
          </p>
          <p className={`${MONO} border-border border-t pt-4`}>
            {formatPercent(FACTS.capturePct)} ÷ 80 % = {formatPercent(FACTS.streetCapturePct)}
          </p>
        </div>
      </div>
    </LandingSection>
  );
}
