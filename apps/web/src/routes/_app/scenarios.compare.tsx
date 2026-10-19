import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import {
  getScenarioOptions,
  listScenariosOptions,
  listZonesOptions,
} from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/states';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CompareView } from '@/features/scenarios/compare-view';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/scenarios/compare')({
  validateSearch: z.object({
    a: z.string().uuid().optional().catch(undefined),
    b: z.string().uuid().optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({ a: search.a, b: search.b }),
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([
      queryClient.ensureQueryData(listScenariosOptions()),
      queryClient.ensureQueryData(listZonesOptions()),
      deps.a
        ? queryClient.ensureQueryData(getScenarioOptions({ path: { scenario_id: deps.a } }))
        : Promise.resolve(null),
      deps.b
        ? queryClient.ensureQueryData(getScenarioOptions({ path: { scenario_id: deps.b } }))
        : Promise.resolve(null),
    ]),
  head: () => ({ meta: [{ title: m.title_compare() }] }),
  component: Compare,
});

function Picker({
  label,
  value,
  exclude,
  onChange,
}: {
  label: string;
  value?: string;
  exclude?: string;
  onChange: (id: string) => void;
}) {
  const { data } = useSuspenseQuery(listScenariosOptions());
  return (
    <div className="min-w-56 flex-1 space-y-1.5">
      <p className="font-medium text-sm">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 w-full">
          <SelectValue placeholder={m.compare_pick()} />
        </SelectTrigger>
        <SelectContent>
          {data
            .filter((s) => s.id !== exclude)
            .map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Compare() {
  const { a, b } = Route.useSearch();
  const navigate = useNavigate();
  const { data: zones } = useSuspenseQuery(listZonesOptions());
  const [, , scenarioA, scenarioB] = Route.useLoaderData();

  return (
    <Page>
      <PageHeader
        eyebrow={m.compare_eyebrow()}
        title={m.compare_title()}
        description={m.compare_description()}
      />
      <div className="flex flex-wrap gap-4">
        <Picker
          label={m.compare_scenario_a()}
          value={a}
          exclude={b}
          onChange={(id) => navigate({ to: '/scenarios/compare', search: { a: id, b } })}
        />
        <Picker
          label={m.compare_scenario_b()}
          value={b}
          exclude={a}
          onChange={(id) => navigate({ to: '/scenarios/compare', search: { a, b: id } })}
        />
      </div>
      {scenarioA && scenarioB ? (
        <CompareView a={scenarioA} b={scenarioB} zones={zones} />
      ) : (
        <EmptyState title={m.compare_empty_title()} description={m.compare_empty_text()} />
      )}
    </Page>
  );
}
