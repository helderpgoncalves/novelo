import {
  Camera,
  FileText,
  type LucideIcon,
  QrCode,
  Recycle,
  Scale,
  SlidersHorizontal,
} from 'lucide-react';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import {
  BODY,
  CARD,
  CARD_TITLE,
  Estimate,
  GRID_GAP,
  IconTile,
  LandingSection,
  STAT,
} from './layout';

/** O problema: captação atual face ao potencial (estimativa) e a referência francesa (por verificar). */
export function Problem() {
  const share = 22.9;
  return (
    <LandingSection
      id="problema"
      eyebrow={m.landing_problem_eyebrow()}
      title={m.landing_problem_title()}
      lead={m.landing_problem_lead()}
    >
      <div className={`grid lg:grid-cols-2 ${GRID_GAP}`}>
        <div className={`${CARD} flex flex-col gap-5`}>
          <h3 className={CARD_TITLE}>{m.landing_gap_title()}</h3>
          <div className="space-y-2">
            <p className={STAT}>
              {formatPercent(share)}
              <Estimate />
            </p>
            <p className="font-medium">{m.landing_gap_value_label()}</p>
          </div>
          <div
            role="img"
            aria-label={`${formatPercent(share)} ${m.landing_gap_value_label()} (${m.landing_estimate_tag()})`}
            className="h-3 overflow-hidden rounded-full border border-border bg-secondary"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
          </div>
          <dl className="grid grid-cols-2 gap-4 border-border border-t pt-5 text-sm">
            <div>
              <dt className="text-muted-foreground">{m.landing_gap_collected()}</dt>
              <dd className="mt-1 font-medium tabular-nums">{formatTonnes(301.3)}</dd>
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
          </p>
        </div>
      </div>
    </LandingSection>
  );
}

/** Como funciona: três passos numerados. */
export function HowItWorks() {
  const steps = [
    { title: m.landing_how_1_title(), text: m.landing_how_1_text() },
    { title: m.landing_how_2_title(), text: m.landing_how_2_text() },
    { title: m.landing_how_3_title(), text: m.landing_how_3_text() },
  ];
  return (
    <LandingSection
      id="como-funciona"
      tone="band"
      eyebrow={m.landing_how_eyebrow()}
      title={m.landing_how_title()}
      lead={m.landing_how_lead()}
    >
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
    </LandingSection>
  );
}

/** Funcionalidades: seis cartões iguais, todos com ícone Lucide de 20 px. */
export function Features() {
  const items: { icon: LucideIcon; title: string; text: string }[] = [
    {
      icon: SlidersHorizontal,
      title: m.landing_feat_simulator_title(),
      text: m.landing_feat_simulator_text(),
    },
    {
      icon: Scale,
      title: m.landing_feat_scenarios_title(),
      text: m.landing_feat_scenarios_text(),
    },
    { icon: Camera, title: m.landing_feat_triage_title(), text: m.landing_feat_triage_text() },
    { icon: QrCode, title: m.landing_feat_lots_title(), text: m.landing_feat_lots_text() },
    {
      icon: Recycle,
      title: m.landing_feat_exchange_title(),
      text: m.landing_feat_exchange_text(),
    },
    { icon: FileText, title: m.landing_feat_report_title(), text: m.landing_feat_report_text() },
  ];
  return (
    <LandingSection
      id="funcionalidades"
      eyebrow={m.landing_features_eyebrow()}
      title={m.landing_features_title()}
      lead={m.landing_features_lead()}
    >
      <ul className={`grid sm:grid-cols-2 lg:grid-cols-3 ${GRID_GAP}`}>
        {items.map((f) => (
          <li key={f.title} className={`${CARD} flex flex-col gap-4`}>
            <IconTile icon={f.icon} />
            <h3 className={CARD_TITLE}>{f.title}</h3>
            <p className={BODY}>{f.text}</p>
          </li>
        ))}
      </ul>
    </LandingSection>
  );
}
