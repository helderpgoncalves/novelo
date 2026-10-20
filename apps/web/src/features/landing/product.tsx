import { Link } from '@tanstack/react-router';
import { ArrowRight, Building2, Check, Map as MapIcon, MapPin, Users } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { motionAllowed, useInViewOnce } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { CountUp } from './count-up';
import { FACTS } from './facts';
import {
  BODY,
  CARD,
  CARD_LIFT,
  CARD_TITLE,
  Estimate,
  FigCaption,
  GRID_GAP,
  IconTile,
  LandingSection,
  MONO,
  STAT,
} from './layout';
import { ParishMap } from './parish-map';

/** Moldura de janela de aplicação (só CSS): três pontos, endereço em mono e o conteúdo. */
function AppWindow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-lg">
      <div className="flex items-center gap-3 border-border border-b bg-secondary/60 px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <i className="size-2.5 rounded-full bg-foreground/20" />
          <i className="size-2.5 rounded-full bg-foreground/20" />
          <i className="size-2.5 rounded-full bg-foreground/20" />
        </span>
        <span className={`${MONO} truncate`}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function MockSlider({ label, hint, at }: { label: string; hint: string; at: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-sm">{label}</span>
        <span className={MONO}>{hint}</span>
      </div>
      <div aria-hidden="true" className="relative h-1.5 rounded-full bg-border">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${at}%` }}
        />
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-card"
          style={{ left: `${at}%` }}
        />
      </div>
    </div>
  );
}

function SimulatorMock() {
  const steps = [
    m.landing_mock_step_1(),
    m.landing_mock_step_2(),
    m.landing_mock_step_3(),
    m.landing_mock_step_4(),
  ];
  return (
    <AppWindow title="novelo.helder.si/simulator">
      <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_1fr] lg:p-6">
        <div className="flex flex-col gap-6">
          <MockSlider label={m.landing_mock_budget()} hint={m.landing_mock_you()} at={46} />
          <MockSlider
            label={m.landing_mock_goal()}
            hint={`${formatTonnes(FACTS.collectedT)} → ${formatTonnes(FACTS.potentialT, 0)}`}
            at={34}
          />
          <div
            aria-hidden="true"
            className="inline-flex h-11 items-center justify-center self-start rounded-md bg-primary px-5 font-semibold text-primary-foreground text-sm"
          >
            {m.landing_mock_run()}
          </div>
          <div className="space-y-3">
            <p className="eyebrow">{m.landing_mock_steps()}</p>
            <ol className="space-y-2">
              {steps.map((s) => (
                <li key={s} className="flex items-center gap-3 text-sm">
                  <Check className="size-4 text-primary" strokeWidth={2} aria-hidden="true" />
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="photo-bg photo-fabrica relative overflow-hidden rounded-lg border border-border bg-card p-5">
          <p className="eyebrow relative">{m.landing_mock_start()}</p>
          <dl className="relative mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
            <div>
              <dd className={`${STAT} text-3xl lg:text-4xl`}>{formatTonnes(FACTS.collectedT)}</dd>
              <dt className={MONO}>{m.landing_stat_collected_label()}</dt>
            </div>
            <div>
              <dd className={`${STAT} text-3xl lg:text-4xl`}>{formatPercent(FACTS.capturePct)}</dd>
              <dt className={MONO}>
                {m.landing_gap_value_label()} <Estimate />
              </dt>
            </div>
            <div>
              <dd className="font-medium font-serif text-2xl tabular-nums">
                {formatNumber(FACTS.circuits)}
              </dd>
              <dt className={MONO}>{m.landing_net_circuits()}</dt>
            </div>
            <div>
              <dd className="font-medium font-serif text-2xl tabular-nums">
                {formatNumber(FACTS.vehicles)}
              </dd>
              <dt className={MONO}>{m.landing_net_vehicles()}</dt>
            </div>
          </dl>
        </div>
      </div>
    </AppWindow>
  );
}

function MapMock() {
  return (
    <AppWindow title="novelo.helder.si/map">
      <div className="grid items-center gap-6 p-5 lg:grid-cols-[0.9fr_1fr] lg:p-6">
        <div className="mx-auto w-full max-w-sm">
          <ParishMap places label={m.landing_mock_map_title()} />
        </div>
        <div className="flex flex-col gap-4">
          <h3 className={CARD_TITLE}>{m.landing_mock_map_title()}</h3>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dd className={`${STAT} text-3xl lg:text-4xl`}>{formatNumber(FACTS.parishes)}</dd>
              <dt className={MONO}>{m.landing_mock_map_parishes({ count: '' }).trim()}</dt>
            </div>
            <div>
              <dd className={`${STAT} text-3xl lg:text-4xl`}>
                {formatNumber(FACTS.placesLocated)}
              </dd>
              <dt className={MONO}>{m.landing_mock_map_places({ count: '' }).trim()}</dt>
            </div>
          </dl>
          <p className={`${BODY} text-sm`}>{m.landing_mock_map_caption()}</p>
        </div>
      </div>
    </AppWindow>
  );
}

/** Produto: ecrãs reconstruídos em HTML/CSS/SVG (sem imagens), com separadores acessíveis (setas, Home, End). */
export function ProductShowcase() {
  const tabs = [
    { id: 'sim', label: m.landing_product_tab_sim(), panel: <SimulatorMock /> },
    { id: 'map', label: m.landing_product_tab_map(), panel: <MapMock /> },
  ];
  const [active, setActive] = useState('sim');
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === active);
    const next =
      e.key === 'ArrowRight'
        ? (i + 1) % tabs.length
        : e.key === 'ArrowLeft'
          ? (i - 1 + tabs.length) % tabs.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? tabs.length - 1
              : -1;
    const t = tabs[next];
    if (!t) return;
    e.preventDefault();
    setActive(t.id);
    refs.current[t.id]?.focus();
  };
  return (
    <LandingSection
      id="produto"
      eyebrow={m.landing_product_eyebrow()}
      title={m.landing_product_title()}
      lead={m.landing_product_lead()}
    >
      <div className="flex flex-col gap-5">
        <div
          role="tablist"
          aria-label={m.landing_product_tabs()}
          onKeyDown={onKeyDown}
          className="inline-flex self-start rounded-lg border border-border bg-secondary/60 p-1"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={active === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={active === t.id ? 0 : -1}
              onClick={() => setActive(t.id)}
              className={cn(
                'lp-press min-h-11 rounded-md px-5 font-medium text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active === t.id
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tabs.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            id={`panel-${t.id}`}
            aria-labelledby={`tab-${t.id}`}
            hidden={active !== t.id}
          >
            {t.panel}
          </div>
        ))}
        <p className={MONO}>{m.landing_mock_note()}</p>
      </div>
    </LandingSection>
  );
}

/**
 * Conversa gravada que «escreve» uma só vez ao entrar: pergunta, passos de ferramenta, resposta (sem números: o modelo
 * nunca faz contas) e a fonte. Com movimento reduzido aparece tudo de uma vez. O contador é derivado de um só intervalo.
 */
function ChatReplay() {
  const question = m.landing_chat_question();
  const answer = m.landing_chat_answer();
  const ref = useRef<HTMLElement>(null);
  const seen = useInViewOnce(ref);
  const animate = motionAllowed();
  const [tick, setTick] = useState(0);
  const stepsAt = question.length + 6;
  const answerAt = stepsAt + 4 * 10 + 4;
  const total = answerAt + Math.ceil(answer.length / 2) + 4;

  useEffect(() => {
    if (!seen || !animate) return;
    const id = window.setInterval(() => {
      setTick((t) => {
        if (t + 1 >= total) window.clearInterval(id);
        return t + 1;
      });
    }, 32);
    return () => window.clearInterval(id);
  }, [seen, animate, total]);

  const t = animate ? tick : total;
  const q = question.slice(0, Math.min(question.length, t));
  const stepsShown = Math.max(0, Math.min(4, Math.floor((t - stepsAt) / 10) + 1));
  const a = answer.slice(0, Math.max(0, Math.min(answer.length, (t - answerAt) * 2)));
  const done = t >= total;
  const steps = [
    m.landing_chat_step_1(),
    m.landing_chat_step_2(),
    m.landing_chat_step_3(),
    m.landing_chat_step_4(),
  ];
  return (
    <figure ref={ref} aria-label={m.landing_chat_label()} className={`${CARD} flex flex-col gap-4`}>
      <Badge variant="outline" className="self-start">
        {m.landing_chat_example()}
      </Badge>
      <p
        className={cn(
          'max-w-[88%] self-end rounded-lg rounded-br-sm bg-primary px-4 py-3 text-pretty text-primary-foreground',
          t < question.length && 'lp-caret',
        )}
      >
        <span className="sr-only">{question}</span>
        <span aria-hidden="true">{q}</span>
      </p>
      <ol className="space-y-1.5" aria-label={m.landing_chat_label()}>
        {steps.slice(0, stepsShown).map((s, i) => (
          <li key={s} className={`${MONO} flex items-center gap-2`}>
            <Check
              className={cn(
                'size-3.5',
                i < stepsShown - 1 || done ? 'text-primary' : 'text-muted-foreground',
              )}
              strokeWidth={2.25}
              aria-hidden="true"
            />
            {s}
          </li>
        ))}
      </ol>
      <div className="min-h-32 max-w-[94%] space-y-3 rounded-lg rounded-bl-sm border border-border bg-background px-4 py-3">
        <p className={cn('text-pretty leading-relaxed', !done && a && 'lp-caret')}>
          <span className="sr-only">{answer}</span>
          <span aria-hidden="true">{a}</span>
        </p>
        {done && (
          <p className="flex items-center gap-2 font-medium text-primary text-sm">
            <Check className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {m.landing_chat_checked()}
          </p>
        )}
      </div>
      <figcaption className={`${MONO} flex flex-wrap items-center justify-between gap-3`}>
        {m.landing_chat_source()}
        <Button asChild variant="outline" size="sm" className="lp-press h-10 gap-1.5 px-4">
          <Link to="/register">
            {m.landing_chat_cta()}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </figcaption>
    </figure>
  );
}

/** Copiloto: pontos de confiança e a conversa gravada. */
export function Copilot() {
  const points = [
    m.landing_copilot_point_1(),
    m.landing_copilot_point_2(),
    m.landing_copilot_point_3(),
    m.landing_copilot_point_4(),
  ];
  return (
    <LandingSection
      id="copiloto"
      tone="band"
      eyebrow={m.landing_copilot_eyebrow()}
      title={m.landing_copilot_title()}
      lead={m.landing_copilot_lead()}
    >
      <div className={`grid items-start lg:grid-cols-2 ${GRID_GAP}`}>
        <ul className={`${CARD} flex flex-col gap-5`}>
          {points.map((p) => (
            <li key={p} className="flex gap-3">
              <Check
                className="mt-0.5 size-5 shrink-0 text-primary"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className={BODY}>{p}</span>
            </li>
          ))}
        </ul>
        <ChatReplay />
      </div>
    </LandingSection>
  );
}

/** Mapa e dados: de onde vem cada fonte e o que ainda falta (localização dos contentores de têxteis). */
export function DataSources() {
  const sources = [
    {
      icon: Building2,
      title: m.landing_data_vitrus_title(),
      text: m.landing_data_vitrus_text(),
      received: true,
    },
    {
      icon: Users,
      title: m.landing_data_ine_title(),
      text: m.landing_data_ine_text(),
      received: true,
    },
    {
      icon: MapIcon,
      title: m.landing_data_municipal_title(),
      text: m.landing_data_municipal_text({
        containers: formatNumber(FACTS.municipalContainers),
        places: formatNumber(2026),
      }),
      received: true,
    },
    {
      icon: MapPin,
      title: m.landing_data_textile_title(),
      text: m.landing_data_textile_text(),
      received: false,
    },
  ];
  return (
    <LandingSection
      id="dados"
      eyebrow={m.landing_data_eyebrow()}
      title={m.landing_data_title()}
      lead={m.landing_data_lead()}
    >
      <ul className={`grid sm:grid-cols-2 lg:grid-cols-4 ${GRID_GAP}`}>
        {sources.map((s) => (
          <li key={s.title} className={`${CARD_LIFT} flex flex-col gap-4`}>
            <div className="flex items-start justify-between gap-3">
              <IconTile icon={s.icon} />
              <Badge variant={s.received ? 'secondary' : 'outline'}>
                {s.received ? m.landing_data_status_received() : m.landing_data_status_waiting()}
              </Badge>
            </div>
            <h3 className={CARD_TITLE}>{s.title}</h3>
            <p className={BODY}>{s.text}</p>
          </li>
        ))}
      </ul>
    </LandingSection>
  );
}

const DESTINATIONS = [
  { id: 'reuse', t: 178.995, share: FACTS.reuse, band: 'fill-primary', swatch: 'bg-primary' },
  {
    id: 'recycling',
    t: 79.933,
    share: FACTS.recycling,
    band: 'fill-chart-2',
    swatch: 'bg-chart-2',
  },
  { id: 'reject', t: 42.338, share: FACTS.reject, band: 'fill-areia', swatch: 'bg-areia' },
] as const;

/** Fig. 4: Sankey do destino das 301,3 t (observado). Faixas curvas em SVG que aparecem ao entrar. */
function Sankey({ labels }: { labels: Record<(typeof DESTINATIONS)[number]['id'], string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInViewOnce(ref);
  const H = 170;
  const gap = 12;
  const offset = (200 - H) / 2;
  let left = offset;
  let right = 0;
  const bands = DESTINATIONS.map((d) => {
    const h = (d.share / 100) * H;
    const y0 = left;
    const r0 = right;
    left += h;
    right += h + gap;
    return { ...d, h, y0, r0 };
  });
  const aria = DESTINATIONS.map((d) => `${labels[d.id]} ${formatPercent(d.share)}`).join(', ');
  return (
    <div ref={ref} data-in={seen} className="lp-draw">
      <svg
        viewBox="0 0 520 200"
        role="img"
        aria-label={`${m.landing_sankey_label()}: ${aria}`}
        className="h-auto w-full"
      >
        <rect x="0" y={offset} width="10" height={H} rx="2" className="fill-foreground" />
        {bands.map((b) => (
          <g key={b.id}>
            <path
              data-fade=""
              d={`M10 ${b.y0}C265 ${b.y0} 265 ${b.r0} 510 ${b.r0}V${b.r0 + b.h}C265 ${b.r0 + b.h} 265 ${b.y0 + b.h} 10 ${b.y0 + b.h}Z`}
              className={cn(b.band, 'opacity-55')}
            />
            <rect x="510" y={b.r0} width="10" height={b.h} rx="2" className={b.band} />
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Rede e impacto: destino do recolhido (Fig. 4, observado) e a rede atual (40 circuitos, 29 viaturas, 82 localidades). */
export function Impact() {
  const labels = {
    reuse: m.landing_dest_reuse(),
    recycling: m.landing_dest_recycling(),
    reject: m.landing_dest_reject(),
  };
  const network = [
    { id: 'circuits', value: FACTS.circuits, label: m.landing_net_circuits() },
    { id: 'vehicles', value: FACTS.vehicles, label: m.landing_net_vehicles() },
    { id: 'places', value: FACTS.places, label: m.landing_net_places() },
  ] as const;
  return (
    <LandingSection
      id="impacto"
      tone="band"
      eyebrow={m.landing_impact_eyebrow()}
      title={m.landing_impact_title()}
      lead={m.landing_impact_lead()}
    >
      <div className={`grid lg:grid-cols-[1.4fr_1fr] ${GRID_GAP}`}>
        <figure className={`${CARD} flex flex-col gap-5`}>
          <h3 className={CARD_TITLE}>{m.landing_dest_title()}</h3>
          <Sankey labels={labels} />
          <ul className="grid gap-3 border-border border-t pt-5">
            {DESTINATIONS.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span aria-hidden="true" className={`size-3 rounded-sm ${d.swatch}`} />
                  {labels[d.id]}
                </span>
                <span className="font-medium tabular-nums">
                  {formatTonnes(d.t)}{' '}
                  <span className="text-muted-foreground">· {formatPercent(d.share)}</span>
                </span>
              </li>
            ))}
          </ul>
          <FigCaption label={m.landing_fig_4()}>{m.landing_fig_4_caption()}</FigCaption>
        </figure>
        <dl
          className={`${CARD} photo-bg photo-couros relative grid grid-cols-3 content-center gap-4 overflow-hidden`}
        >
          {network.map((n) => (
            <div key={n.id} className="relative flex flex-col gap-2">
              <dd className={`order-1 ${STAT}`}>
                <CountUp value={n.value} format={(v) => formatNumber(Math.round(v))} />
              </dd>
              <dt className="order-2 text-muted-foreground">{n.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </LandingSection>
  );
}
