import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { MapPinned, TriangleAlert } from 'lucide-react';
import type { MunicipalContainerOut, MunicipalSiteDetail } from '@/client';
import { getMunicipalSiteOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { formatLitres, formatMetres, formatNumber } from '@/lib/format';
import { formatList } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { EstimateBadge, MunicipalNote } from './note';
import { kindLabel, precisionLabel, producerLabel, siteClassLabel, streamLabel } from './vocab';

const NEIGHBOUR_RADIUS_M = 150;

interface SiteSheetProps {
  siteId: string | null;
  onClose: () => void;
  /** No mapa já estamos na vista geográfica; no ecrã municipal oferece-se "Ver no mapa". */
  showMapLink?: boolean;
}

/** Detalhe de um local municipal: folha inferior em telemóvel, painel lateral em ecrã largo. Nunca mostra nomes. */
export function SiteSheet({ siteId, onClose, showMapLink = true }: SiteSheetProps) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  return (
    <Sheet open={siteId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        className="max-h-[88dvh] gap-0 overflow-y-auto overscroll-contain rounded-t-2xl lg:max-h-none lg:w-[28rem] lg:max-w-[28rem] lg:rounded-none"
        data-testid="municipal-site-sheet"
      >
        {siteId && <SiteBody siteId={siteId} showMapLink={showMapLink} />}
      </SheetContent>
    </Sheet>
  );
}

function SiteBody({ siteId, showMapLink }: { siteId: string; showMapLink: boolean }) {
  const query = useQuery(
    getMunicipalSiteOptions({ path: { site_id: siteId }, query: { radius_m: NEIGHBOUR_RADIUS_M } }),
  );
  if (query.isPending) {
    return (
      <div aria-busy="true" className="space-y-4 p-4 pt-6">
        <span className="sr-only">{m.common_loading()}</span>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <>
        <SheetHeader className="pr-14">
          <SheetTitle className="font-serif text-2xl">
            {m.mun_site_title({ id: siteId })}
          </SheetTitle>
          <SheetDescription className="sr-only">{m.mun_site_error_desc()}</SheetDescription>
        </SheetHeader>
        <div className="p-4">
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </div>
      </>
    );
  }
  return <SiteDetail detail={query.data} showMapLink={showMapLink} />;
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

const containerColumns = (): Column<MunicipalContainerOut>[] => [
  {
    id: 'id',
    header: m.mun_col_container(),
    primary: true,
    value: (c) => c.external_id,
    cell: (c) => <span className="font-medium tabular-nums">{c.external_id}</span>,
  },
  {
    id: 'kind',
    header: m.mun_col_kind(),
    value: (c) => kindLabel[c.kind](),
    cell: (c) => (
      <span>
        {kindLabel[c.kind]()}
        {c.brand ? ` · ${c.brand}` : ''}
      </span>
    ),
    badge: true,
  },
  {
    id: 'capacity',
    header: m.mun_col_capacity(),
    value: (c) => c.capacity_litres,
    cell: (c) =>
      c.capacity_litres == null ? (
        m.mun_capacity_unknown()
      ) : (
        <span className="tabular-nums">
          {formatLitres(c.capacity_litres)}
          {c.capacity_status === 'assumed_litres' ? ` (${m.mun_capacity_assumed()})` : ''}
        </span>
      ),
    align: 'right',
  },
  {
    id: 'stream',
    header: m.mun_col_stream(),
    value: (c) => streamLabel[c.stream](),
    cell: (c) => streamLabel[c.stream](),
    desktopOnly: true,
  },
];

function SiteDetail({
  detail,
  showMapLink,
}: {
  detail: MunicipalSiteDetail;
  showMapLink: boolean;
}) {
  const { site } = detail;
  const kindsText = formatList(site.kinds.map((k) => kindLabel[k]()));
  const streams = site.streets.length > 0 ? site.streets.join(', ') : null;
  const reasons = site.candidate_reason ?? null;
  const unknownCapacity = site.capacity_unknown > 0;
  return (
    <>
      <SheetHeader className="space-y-1 pr-14">
        <p className="eyebrow">{m.mun_site_eyebrow()}</p>
        <SheetTitle className="font-serif text-2xl leading-tight">
          {m.mun_site_title({ id: site.site_id })}
        </SheetTitle>
        <SheetDescription>
          {[site.parish_name, siteClassLabel[site.site_class]()].filter(Boolean).join(' · ')}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-6">
        {site.coord_suspect_containers > 0 && (
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            <p>
              <span className="font-medium">
                {m.mun_site_suspect_title({ count: formatNumber(site.coord_suspect_containers) })}
              </span>{' '}
              <span className="text-muted-foreground">{m.mun_site_suspect_text()}</span>
            </p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Fact label={m.mun_fact_containers()} value={formatNumber(site.containers)} />
          <Fact
            label={m.mun_fact_capacity()}
            value={formatLitres(site.capacity_litres_total)}
            hint={
              unknownCapacity
                ? m.mun_fact_capacity_unknown({ count: formatNumber(site.capacity_unknown) })
                : undefined
            }
          />
          <Fact
            label={m.mun_fact_nn()}
            value={site.nn_distance_m == null ? m.common_dash() : formatMetres(site.nn_distance_m)}
            hint={site.nn_distance_m == null ? m.mun_fact_nn_none() : undefined}
          />
          <Fact
            label={m.mun_fact_precision()}
            value={precisionLabel[site.coord_precision]()}
            hint={site.coord_precision === 'approximate' ? m.mun_fact_precision_hint() : undefined}
          />
          <Fact label={m.mun_fact_kinds()} value={kindsText} />
          <Fact
            label={m.mun_fact_neighbours({ radius: NEIGHBOUR_RADIUS_M })}
            value={formatNumber(detail.neighbours.length)}
          />
        </dl>

        <dl className="space-y-3 text-sm">
          {streams && (
            <div>
              <dt className="text-muted-foreground text-xs">{m.mun_fact_streets()}</dt>
              <dd>{streams}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground text-xs">{m.mun_fact_streams()}</dt>
            <dd>
              {[
                site.by_stream.organico > 0 &&
                  `${streamLabel.organico()} (${formatNumber(site.by_stream.organico)})`,
                site.by_stream.verdes > 0 &&
                  `${streamLabel.verdes()} (${formatNumber(site.by_stream.verdes)})`,
                site.by_stream.desconhecido > 0 &&
                  `${streamLabel.desconhecido()} (${formatNumber(site.by_stream.desconhecido)})`,
              ]
                .filter(Boolean)
                .join(', ')}
            </dd>
          </div>
          {site.producer_types.length > 0 && (
            <div>
              <dt className="text-muted-foreground text-xs">{m.mun_fact_producers()}</dt>
              <dd>{formatList(site.producer_types.map((t) => producerLabel[t]()))}</dd>
            </div>
          )}
        </dl>

        {site.textile_candidate && (
          <section
            aria-label={m.mun_site_candidate_title()}
            className="space-y-1.5 rounded-lg bg-muted/50 px-3.5 py-3 text-sm"
          >
            <p className="flex items-center gap-2 font-medium">
              {m.mun_site_candidate_title()} <EstimateBadge />
            </p>
            {reasons && (
              <p className="text-muted-foreground" lang="pt-PT">
                {reasons}
              </p>
            )}
            <p className="text-muted-foreground text-xs">{m.mun_site_candidate_note()}</p>
          </section>
        )}

        <section aria-label={m.mun_site_containers_title()} className="space-y-2">
          <h3 className="font-semibold text-sm">{m.mun_site_containers_title()}</h3>
          <DataTable
            id="municipal-site-containers"
            columns={containerColumns()}
            rows={detail.containers}
            getRowId={(c) => c.container_uid}
            controls="never"
            pageSize={50}
            exportName={`local-${site.site_id}`}
          />
        </section>

        <MunicipalNote />

        <div className="flex flex-wrap gap-2">
          {site.parish_dicofre && (
            <Button asChild variant="outline" className="h-10">
              <Link to="/municipal" search={{ tab: 'parishes', parish: site.parish_dicofre }}>
                {m.mun_site_parish_link()}
              </Link>
            </Button>
          )}
          {showMapLink && (
            <Button asChild variant="outline" className="h-10 gap-2">
              <Link to="/map" search={{ preset: 'municipal', site: site.site_id }}>
                <MapPinned aria-hidden="true" />
                {m.mun_site_map_link()}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
