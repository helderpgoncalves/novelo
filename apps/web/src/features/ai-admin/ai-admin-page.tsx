import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { AiSettingsOut } from '@/client';
import { getAiSettingsOptions } from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { m } from '@/paraglide/messages';
import { LimitsTab } from './limits-tab';
import { OverviewTab } from './overview-tab';
import { TasksTab } from './tasks-tab';
import { TriageEvalTab } from './triage-eval-tab';

const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];

export const AI_TABS = ['overview', 'models', 'limits', 'triage'] as const;
export type AiTab = (typeof AI_TABS)[number];

interface Props {
  tab: AiTab;
  days: number;
}

export function AiAdminPage({ tab, days }: Props) {
  const navigate = useNavigate({ from: '/admin/ai' });
  const settings = useQuery(getAiSettingsOptions());

  return (
    <Page>
      <PageHeader
        eyebrow={m.nav_section_admin()}
        title={m.aiadm_title()}
        description={m.aiadm_description()}
        actions={
          settings.data && (
            <Badge variant={settings.data.enabled ? 'outline' : 'destructive'} className="h-7 px-3">
              {settings.data.enabled ? m.aiadm_key_on() : m.aiadm_key_off()}
            </Badge>
          )
        }
      />
      <Tabs
        value={tab}
        onValueChange={(next) =>
          navigate({ search: (prev) => ({ ...prev, tab: next as AiTab }), replace: true })
        }
        className="gap-6"
      >
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="h-auto w-max min-w-full justify-start border-b">
            <TabsTrigger value="overview" className="h-10 flex-none px-3">
              {m.aiadm_tab_overview()}
            </TabsTrigger>
            <TabsTrigger value="models" className="h-10 flex-none px-3">
              {m.aiadm_tab_models()}
            </TabsTrigger>
            <TabsTrigger value="limits" className="h-10 flex-none px-3">
              {m.aiadm_tab_limits()}
            </TabsTrigger>
            <TabsTrigger value="triage" className="h-10 flex-none px-3">
              {m.aiadm_tab_triage()}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <OverviewTab
            days={days}
            onDaysChange={(next) =>
              navigate({ search: (prev) => ({ ...prev, days: next }), replace: true })
            }
          />
        </TabsContent>
        <TabsContent value="models">
          <WithSettings query={settings}>{(s) => <TasksTab settings={s} />}</WithSettings>
        </TabsContent>
        <TabsContent value="limits">
          <WithSettings query={settings}>{(s) => <LimitsTab settings={s} />}</WithSettings>
        </TabsContent>
        <TabsContent value="triage">
          <TriageEvalTab />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

function WithSettings({
  query,
  children,
}: {
  query: UseQueryResult<AiSettingsOut, unknown>;
  children: (settings: AiSettingsOut) => ReactNode;
}) {
  if (query.isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        <span className="sr-only">{m.common_loading()}</span>
        {SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <>{children(query.data)}</>;
}
