import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { BrandSymbol } from '@/components/brand-logo';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { BODY, CARD_LIFT, CARD_TITLE, LandingSection } from './layout';

/** Moldura comum dos micro-visuais: 160 × 80, decorativos, só tokens da marca. */
function Mini({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 160 80"
      aria-hidden="true"
      focusable="false"
      className="h-20 w-full max-w-72 self-start"
    >
      {children}
    </svg>
  );
}

const track = 'fill-border';
const fill = 'fill-primary';

const VISUALS = {
  simulator: (
    <Mini>
      <rect x="6" y="20" width="148" height="5" rx="2.5" className={track} />
      <rect x="6" y="20" width="92" height="5" rx="2.5" className={fill} />
      <circle cx="98" cy="22.5" r="7" className="fill-card stroke-primary" strokeWidth="2" />
      <rect x="6" y="54" width="148" height="5" rx="2.5" className={track} />
      <rect x="6" y="54" width="46" height="5" rx="2.5" className={fill} />
      <circle cx="52" cy="56.5" r="7" className="fill-card stroke-primary" strokeWidth="2" />
    </Mini>
  ),
  scenarios: (
    <Mini>
      {[18, 30, 24].map((h, i) => (
        <rect
          key={h}
          x={10 + i * 20}
          y={72 - h * 2}
          width="14"
          height={h * 2}
          rx="2"
          className={fill}
        />
      ))}
      {[26, 20, 34].map((h, i) => (
        <rect
          key={h}
          x={92 + i * 20}
          y={72 - h * 2}
          width="14"
          height={h * 2}
          rx="2"
          className="fill-areia"
        />
      ))}
      <rect x="6" y="73" width="148" height="1.5" className={track} />
    </Mini>
  ),
  whatif: (
    <Mini>
      <rect x="40" y="8" width="114" height="22" rx="8" className={fill} />
      <rect x="6" y="40" width="120" height="30" rx="8" className="fill-card stroke-border" />
      <rect x="16" y="49" width="70" height="4" rx="2" className={track} />
      <rect x="16" y="58" width="44" height="4" rx="2" className={track} />
      <path
        d="M104 56l5 5 9-11"
        fill="none"
        className="stroke-primary"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Mini>
  ),
  triage: (
    <Mini>
      {['M20 22V10h12', 'M128 10h12v12', 'M140 58v12h-12', 'M32 70H20V58'].map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          className="stroke-primary"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
      <rect x="52" y="28" width="56" height="24" rx="4" className="fill-card stroke-border" />
      <rect x="58" y="34" width="30" height="3" rx="1.5" className={track} />
      <rect x="58" y="41" width="20" height="3" rx="1.5" className="fill-areia" />
    </Mini>
  ),
  lots: (
    <Mini>
      {Array.from({ length: 49 }, (_, i) => {
        const x = i % 7;
        const y = Math.floor(i / 7);
        const on = (x * 3 + y * 5 + x * y) % 3 !== 0 || (x < 2 && y < 2);
        return on ? (
          <rect
            key={`${x}-${y}`}
            x={8 + x * 9}
            y={8 + y * 9}
            width="7"
            height="7"
            rx="1"
            className={fill}
          />
        ) : null;
      })}
      <rect x="84" y="14" width="68" height="5" rx="2.5" className={track} />
      <rect x="84" y="28" width="50" height="5" rx="2.5" className={track} />
      <rect x="84" y="42" width="60" height="5" rx="2.5" className="fill-areia" />
      <rect x="84" y="56" width="36" height="5" rx="2.5" className={track} />
    </Mini>
  ),
  exchange: (
    <Mini>
      <rect x="6" y="10" width="118" height="12" rx="3" className={fill} />
      <rect x="6" y="34" width="84" height="12" rx="3" className="fill-areia" />
      <rect x="6" y="58" width="52" height="12" rx="3" className="fill-chart-2" />
    </Mini>
  ),
  report: (
    <Mini>
      <rect x="44" y="4" width="72" height="72" rx="4" className="fill-card stroke-border" />
      <rect x="54" y="14" width="30" height="4" rx="2" className={track} />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={56 + i * 14}
          y={56 - (i + 1) * 8}
          width="9"
          height={(i + 1) * 8}
          rx="1.5"
          className={i === 3 ? fill : 'fill-primary/40'}
        />
      ))}
    </Mini>
  ),
  map: (
    <Mini>
      <path
        d="M10 56 22 24 52 14 78 30 70 56 38 68Z"
        className="fill-accent stroke-primary"
        strokeWidth="1.5"
      />
      <path
        d="M78 30 108 16 134 30 128 58 98 66 70 56Z"
        className="fill-primary/25 stroke-primary"
        strokeWidth="1.5"
      />
      <path d="M52 14 80 6 108 16 78 30Z" className="fill-card stroke-primary" strokeWidth="1.5" />
      {[
        [36, 44],
        [58, 30],
        [96, 40],
        [112, 52],
        [84, 16],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="3.5" className="fill-areia" />
      ))}
    </Mini>
  ),
  copilot: (
    <Mini>
      <rect x="6" y="10" width="148" height="26" rx="8" className="fill-card stroke-border" />
      <rect x="16" y="20" width="76" height="4" rx="2" className={track} />
      <rect x="96" y="19" width="2" height="8" className={fill} />
      <rect x="6" y="46" width="100" height="26" rx="8" className={fill} />
      <circle cx="132" cy="59" r="8" className="fill-areia" />
    </Mini>
  ),
  onboarding: (
    <Mini>
      <path d="M20 40H140" className="stroke-border" strokeWidth="2" />
      <path d="M20 40H80" className="stroke-primary" strokeWidth="2" />
      {[20, 80, 140].map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy="40"
          r="9"
          className={cn(i < 2 ? fill : 'fill-card stroke-border')}
          strokeWidth="2"
        />
      ))}
    </Mini>
  ),
  roles: (
    <Mini>
      {[24, 56, 88].map((x, i) => (
        <g key={x}>
          <circle
            cx={x}
            cy="22"
            r="10"
            className={i === 0 ? fill : i === 1 ? 'fill-areia' : 'fill-chart-2'}
          />
        </g>
      ))}
      {[40, 52, 64].map((y, i) => (
        <rect key={y} x="12" y={y} width={120 - i * 24} height="4" rx="2" className={track} />
      ))}
    </Mini>
  ),
  pwa: (
    <svg
      viewBox="0 0 160 80"
      aria-hidden="true"
      focusable="false"
      className="h-20 w-full max-w-72 self-start"
    >
      <rect
        x="58"
        y="2"
        width="44"
        height="76"
        rx="9"
        className="fill-card stroke-border"
        strokeWidth="2"
      />
      <rect x="72" y="6" width="16" height="4" rx="2" className="fill-foreground/80" />
      <foreignObject x="70" y="26" width="20" height="20">
        <BrandSymbol className="size-5" />
      </foreignObject>
      <path
        d="M80 62v-8M76 58l4-4 4 4"
        fill="none"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
} as const;

type Feature = {
  key: keyof typeof VISUALS;
  title: string;
  text: string;
  span?: boolean;
  /** Âncora da página (`#id`) ou `/register`. */
  to: string;
};

/** Funcionalidades: bento de 12 cartões reais, cada um com um micro-visual e ligação à secção ou ao registo. */
export function Features() {
  const items: Feature[] = [
    {
      key: 'simulator',
      title: m.landing_feat_simulator_title(),
      text: m.landing_feat_simulator_text(),
      span: true,
      to: '#produto',
    },
    {
      key: 'scenarios',
      title: m.landing_feat_scenarios_title(),
      text: m.landing_feat_scenarios_text(),
      to: '#prova',
    },
    {
      key: 'whatif',
      title: m.landing_feat_whatif_title(),
      text: m.landing_feat_whatif_text(),
      to: '#copiloto',
    },
    {
      key: 'triage',
      title: m.landing_feat_triage_title(),
      text: m.landing_feat_triage_text(),
      to: '/register',
    },
    {
      key: 'lots',
      title: m.landing_feat_lots_title(),
      text: m.landing_feat_lots_text(),
      span: true,
      to: '/register',
    },
    {
      key: 'exchange',
      title: m.landing_feat_exchange_title(),
      text: m.landing_feat_exchange_text(),
      to: '/register',
    },
    {
      key: 'report',
      title: m.landing_feat_report_title(),
      text: m.landing_feat_report_text(),
      to: '/register',
    },
    {
      key: 'map',
      title: m.landing_feat_map_title(),
      text: m.landing_feat_map_text(),
      span: true,
      to: '#produto',
    },
    {
      key: 'copilot',
      title: m.landing_feat_copilot_title(),
      text: m.landing_feat_copilot_text(),
      to: '#copiloto',
    },
    {
      key: 'onboarding',
      title: m.landing_feat_onboarding_title(),
      text: m.landing_feat_onboarding_text(),
      to: '/register',
    },
    {
      key: 'roles',
      title: m.landing_feat_roles_title(),
      text: m.landing_feat_roles_text(),
      to: '#rigor',
    },
    {
      key: 'pwa',
      title: m.landing_feat_pwa_title(),
      text: m.landing_feat_pwa_text(),
      span: true,
      to: '/register',
    },
  ];
  return (
    <LandingSection
      id="funcionalidades"
      eyebrow={m.landing_features_eyebrow()}
      title={m.landing_features_title()}
      lead={m.landing_features_lead()}
    >
      <ul className="grid grid-flow-dense gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {items.map((f) => {
          const anchor = f.to.startsWith('#');
          const label = anchor ? m.landing_feat_see() : m.landing_feat_try();
          const linkClass =
            'mt-auto inline-flex min-h-11 items-center gap-1 self-start rounded-sm font-medium text-primary text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring';
          return (
            <li
              key={f.key}
              className={cn(CARD_LIFT, 'flex flex-col gap-4', f.span && 'lg:col-span-2')}
            >
              {VISUALS[f.key]}
              <h3 className={CARD_TITLE}>{f.title}</h3>
              <p className={BODY}>{f.text}</p>
              {anchor ? (
                <a href={f.to} className={linkClass}>
                  {label}
                  <span className="sr-only">: {f.title}</span>
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              ) : (
                <Link to="/register" className={linkClass}>
                  {label}
                  <span className="sr-only">: {f.title}</span>
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </LandingSection>
  );
}
