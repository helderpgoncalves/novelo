import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { listScenariosOptions } from '@/client/@tanstack/react-query.gen';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { ScenarioList } from '@/features/scenarios/scenario-list';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/scenarios/')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listScenariosOptions()),
  head: () => ({ meta: [{ title: m.title_scenarios() }] }),
  component: Scenarios,
});

function Scenarios() {
  const { data } = useSuspenseQuery(listScenariosOptions());
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={m.scenarios_eyebrow()}
        title={m.scenarios_title()}
        description={m.scenarios_description()}
        actions={
          <Button asChild className="h-10 gap-2 font-semibold">
            <Link to="/simulator">
              <Plus /> {m.scenarios_new()}
            </Link>
          </Button>
        }
      />
      {data.length === 0 ? (
        <EmptyState
          title={m.scenarios_empty_title()}
          description={m.scenarios_empty_text()}
          action={
            <Button asChild>
              <Link to="/simulator">{m.scenarios_new()}</Link>
            </Button>
          }
        />
      ) : (
        <ScenarioList scenarios={data} />
      )}
    </div>
  );
}
