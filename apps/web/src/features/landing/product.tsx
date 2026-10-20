import { Building2, Check, Map as MapIcon, MapPin, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatNumber, formatPercent } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { BODY, CARD, CARD_TITLE, GRID_GAP, IconTile, LandingSection, STAT } from './layout';

/** Copiloto: pontos de confiança e um exemplo ilustrativo (sem números: o modelo nunca faz contas). */
export function Copilot() {
  const points = [
    m.landing_copilot_point_1(),
    m.landing_copilot_point_2(),
    m.landing_copilot_point_3(),
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
        <figure aria-label={m.landing_chat_label()} className={`${CARD} flex flex-col gap-4`}>
          <Badge variant="outline" className="self-start">
            {m.landing_chat_example()}
          </Badge>
          <p className="max-w-[85%] self-end rounded-lg rounded-br-sm bg-primary px-4 py-3 text-pretty text-primary-foreground">
            {m.landing_chat_question()}
          </p>
          <div className="max-w-[92%] space-y-3 rounded-lg rounded-bl-sm border border-border bg-background px-4 py-3">
            <p className="text-pretty leading-relaxed">{m.landing_chat_answer()}</p>
            <p className="flex items-center gap-2 font-medium text-primary text-sm">
              <Check className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {m.landing_chat_checked()}
            </p>
          </div>
        </figure>
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
        containers: formatNumber(2751),
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
          <li key={s.title} className={`${CARD} flex flex-col gap-4`}>
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

/** Rede e impacto: destino do recolhido (59,4 / 26,5 / 14,1 %) e a rede atual (40 circuitos, 29 viaturas, 82 localidades). */
export function Impact() {
  const destinations = [
    { id: 'reuse', label: m.landing_dest_reuse(), share: 59.4, swatch: 'bg-primary' },
    { id: 'recycling', label: m.landing_dest_recycling(), share: 26.5, swatch: 'bg-chart-2' },
    { id: 'reject', label: m.landing_dest_reject(), share: 14.1, swatch: 'bg-areia' },
  ] as const;
  const network = [
    { id: 'circuits', value: 40, label: m.landing_net_circuits() },
    { id: 'vehicles', value: 29, label: m.landing_net_vehicles() },
    { id: 'places', value: 82, label: m.landing_net_places() },
  ] as const;
  const summary = destinations.map((d) => `${d.label} ${formatPercent(d.share)}`).join(', ');
  return (
    <LandingSection
      id="impacto"
      tone="band"
      eyebrow={m.landing_impact_eyebrow()}
      title={m.landing_impact_title()}
      lead={m.landing_impact_lead()}
    >
      <div className={`grid lg:grid-cols-2 ${GRID_GAP}`}>
        <div className={`${CARD} flex flex-col gap-5`}>
          <h3 className={CARD_TITLE}>{m.landing_dest_title()}</h3>
          <div
            role="img"
            aria-label={summary}
            className="flex h-3 gap-0.5 overflow-hidden rounded-full"
          >
            {destinations.map((d) => (
              <div key={d.id} className={d.swatch} style={{ width: `${d.share}%` }} />
            ))}
          </div>
          <ul className="grid gap-3 border-border border-t pt-5">
            {destinations.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span aria-hidden="true" className={`size-3 rounded-sm ${d.swatch}`} />
                  {d.label}
                </span>
                <span className="font-medium tabular-nums">{formatPercent(d.share)}</span>
              </li>
            ))}
          </ul>
        </div>
        <dl className={`${CARD} grid grid-cols-3 content-center gap-4`}>
          {network.map((n) => (
            <div key={n.id} className="flex flex-col gap-2">
              <dd className={`order-1 ${STAT}`}>{formatNumber(n.value)}</dd>
              <dt className="order-2 text-muted-foreground">{n.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </LandingSection>
  );
}
