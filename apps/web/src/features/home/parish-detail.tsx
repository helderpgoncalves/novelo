import { Link } from '@tanstack/react-router';
import { Map as MapIcon, MessageCircle, SlidersHorizontal, X } from 'lucide-react';
import type { OverviewParish } from '@/client';
import { Button } from '@/components/ui/button';
import { openCopilot } from '@/features/copilot/store';
import { tipauLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import { stripUnion } from './choropleth';
import { num, tonnes } from './safe';
import { EstimateTag, EYEBROW, MeasuredTag, SourceLine } from './tags';

interface ParishDetailProps {
  parish: OverviewParish;
  /** Potencial por captar (t/ano, estimativa). */
  gapT: number;
  areaKm2: number | null;
  /** Contentores municipais na freguesia (não são de têxteis); `null` enquanto os contornos carregam. */
  municipalContainers: number | null;
  /** `true` / `false` quando há cenário de referência para o orçamento; `null` sem ele. */
  covered: boolean | null;
  onClose: () => void;
}

function Fact({
  label,
  value,
  tag,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  tag?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
        {label}
        {tag}
      </dt>
      <dd className="font-medium font-serif text-2xl tabular-nums leading-none">{value}</dd>
      {hint && <p className="text-muted-foreground text-xs leading-snug">{hint}</p>}
    </div>
  );
}

/** Detalhe de uma freguesia: quatro números com fonte e as três ações (simular, perguntar, ver no mapa completo). */
export function ParishDetail({
  parish,
  gapT,
  areaKm2,
  municipalContainers,
  covered,
  onClose,
}: ParishDetailProps) {
  const question = m.home_detail_question({ name: parish.name });
  const density = areaKm2 && areaKm2 > 0 ? parish.population / areaKm2 : null;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className={EYEBROW}>
            {parish.tipau ? tipauLabel[parish.tipau]() : m.home_detail_no_tipau()}
          </p>
          <h3 className="text-balance font-serif text-2xl leading-tight" title={parish.name}>
            {stripUnion(parish.name)}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mt-1 -mr-2 hidden size-10 shrink-0 lg:inline-flex"
          onClick={onClose}
          aria-label={m.common_close()}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Fact
          label={m.home_detail_gap()}
          tag={<EstimateTag />}
          value={`${tonnes(gapT, 1)}/ano`}
          hint={m.home_detail_potential_of({ potential: tonnes(parish.potential_t, 1) })}
        />
        <Fact
          label={m.home_detail_population()}
          tag={<MeasuredTag />}
          value={num(parish.population)}
          hint={m.home_detail_density({ density: num(density), area: num(areaKm2, 1) })}
        />
        <Fact
          label={m.home_detail_circuits()}
          value={num(parish.circuits_count)}
          hint={m.home_detail_circuits_hint({ n: parish.localities_count })}
        />
        <Fact
          label={m.home_detail_municipal()}
          value={num(municipalContainers)}
          hint={m.home_detail_municipal_hint()}
        />
      </dl>

      <p className="rounded-lg bg-muted/60 p-3 text-[13px] leading-relaxed">
        {parish.containers_count > 0
          ? m.home_detail_textile_containers({ n: parish.containers_count })
          : m.home_detail_textile_missing()}
      </p>
      {covered !== null && (
        <p className="text-[13px] leading-relaxed">
          {covered ? m.home_detail_covered() : m.home_detail_not_covered()}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button asChild className="h-11 justify-start gap-2">
          <Link to="/simulator" search={{ name: m.home_detail_sim_name({ name: parish.name }) }}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {m.home_detail_simulate()}
          </Link>
        </Button>
        <Button
          variant="outline"
          className="h-11 justify-start gap-2"
          onClick={() => openCopilot({ question })}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          {m.home_detail_ask()}
        </Button>
        <Button asChild variant="outline" className="h-11 justify-start gap-2">
          <Link to="/map" search={{ parish: parish.code }}>
            <MapIcon className="size-4" aria-hidden="true" />
            {m.home_detail_full_map()}
          </Link>
        </Button>
      </div>
      <SourceLine>{m.home_detail_source()}</SourceLine>
    </div>
  );
}
