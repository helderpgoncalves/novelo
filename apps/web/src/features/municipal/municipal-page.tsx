import { Link } from '@tanstack/react-router';
import { MapPinned } from 'lucide-react';
import type { MunicipalOverview } from '@/client';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { CandidatesTab } from './candidates-tab';
import { GapsTab } from './gaps-tab';
import { MunicipalNote } from './note';
import { OverviewTab } from './overview-tab';
import { ParishesTab } from './parishes-tab';
import { QualityTab } from './quality-tab';
import { SiteSheet } from './site-sheet';
import { SitesTab } from './sites-tab';
import type { MunicipalTab } from './tabs';

interface MunicipalPageProps {
  overview: MunicipalOverview;
  tab: MunicipalTab;
  parish: string | undefined;
  site: string | undefined;
  onTabChange: (tab: MunicipalTab) => void;
  onParishChange: (parish: string | undefined) => void;
  onSiteChange: (site: string | undefined) => void;
}

export function MunicipalPage({
  overview,
  tab,
  parish,
  site,
  onTabChange,
  onParishChange,
  onSiteChange,
}: MunicipalPageProps) {
  const open = overview.quality.open_alerts;
  return (
    <Page>
      <PageHeader
        eyebrow={m.mun_eyebrow()}
        title={m.mun_title()}
        description={m.mun_description()}
        actions={
          <Button asChild variant="outline" className="h-10 w-full gap-2 sm:w-auto">
            <Link to="/map" search={{ preset: 'municipal' }}>
              <MapPinned aria-hidden="true" />
              {m.mun_open_map()}
            </Link>
          </Button>
        }
      />
      <MunicipalNote />
      <PageTabs
        label={m.mun_tabs_label()}
        value={tab}
        onValueChange={onTabChange}
        tabs={[
          {
            id: 'overview',
            label: m.mun_tab_overview(),
            content: <OverviewTab overview={overview} />,
          },
          {
            id: 'parishes',
            label: m.mun_tab_parishes(),
            content: <ParishesTab focus={parish} onFocusChange={onParishChange} />,
          },
          {
            id: 'sites',
            label: m.mun_tab_sites(),
            count: overview.sites.total,
            content: <SitesTab onOpenSite={onSiteChange} />,
          },
          {
            id: 'candidates',
            label: m.mun_tab_candidates(),
            count: overview.sites.textile_candidates,
            content: <CandidatesTab overview={overview} onOpenSite={onSiteChange} />,
          },
          { id: 'gaps', label: m.mun_tab_gaps(), content: <GapsTab /> },
          {
            id: 'quality',
            label: m.mun_tab_quality(),
            status: open > 0 ? 'attention' : undefined,
            statusLabel: m.mun_quality_open({ count: formatNumber(open) }),
            content: <QualityTab overview={overview} />,
          },
        ]}
      />
      <SiteSheet siteId={site ?? null} onClose={() => onSiteChange(undefined)} />
    </Page>
  );
}
