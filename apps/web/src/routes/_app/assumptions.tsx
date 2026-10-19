import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ParamSource } from '@/client';
import {
  getPlanningParametersOptions,
  getPlanningParametersQueryKey,
  updatePlanningParametersMutation,
} from '@/client/@tanstack/react-query.gen';
import { FilterChips } from '@/components/filter-chips';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { Button } from '@/components/ui/button';
import { validateParams } from '@/features/assumptions/param-fields';
import { ParametersForm } from '@/features/assumptions/parameters-form';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/assumptions')({
  staticData: { skeleton: 'table' },
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(getPlanningParametersOptions()),
  head: () => ({ meta: [{ title: m.title_assumptions() }] }),
  component: Assumptions,
});

function Assumptions() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(getPlanningParametersOptions());
  const [value, setValue] = useState(data.values);
  const [origin, setOrigin] = useState<ParamSource | null>(null);
  const countBy = (source: ParamSource) => data.meta.filter((x) => x.source === source).length;
  const errors = validateParams(value);
  const isAdmin = user.role === 'admin';
  const dirty = JSON.stringify(value) !== JSON.stringify(data.values);

  const save = useMutation({
    ...updatePlanningParametersMutation(),
    onSuccess: async (saved) => {
      queryClient.setQueryData(getPlanningParametersQueryKey(), saved);
      setValue(saved.values);
      toast.success(m.assumptions_saved());
    },
  });

  return (
    <Page>
      <PageHeader
        eyebrow={m.assumptions_eyebrow({ version: data.version })}
        title={m.assumptions_title()}
        description={m.rw_assumptions_description()}
        actions={
          isAdmin ? (
            <>
              <Button
                variant="outline"
                className="h-10"
                disabled={!dirty}
                onClick={() => setValue(data.values)}
              >
                {m.common_cancel()}
              </Button>
              <Button
                className="h-10 font-semibold"
                disabled={!dirty || Object.keys(errors).length > 0 || save.isPending}
                onClick={() => save.mutate({ body: value })}
                loading={save.isPending}
              >
                {m.common_save()}
              </Button>
            </>
          ) : undefined
        }
      />
      <StatStrip>
        <StatCell
          label={m.rw_assumptions_stat_total()}
          value={formatNumber(data.meta.length)}
          hint={m.rw_assumptions_stat_total_hint({ version: data.version })}
        />
        <StatCell
          label={m.param_source_vitrus_data()}
          value={formatNumber(countBy('vitrus_data'))}
          hint={m.rw_assumptions_stat_data_hint()}
          tone="primary"
        />
        <StatCell
          label={m.param_source_plan()}
          value={formatNumber(countBy('plan'))}
          hint={m.rw_assumptions_stat_plan_hint()}
        />
        <StatCell
          label={m.param_source_assumption()}
          value={formatNumber(countBy('assumption'))}
          hint={m.rw_assumptions_stat_assumption_hint()}
        />
      </StatStrip>
      <FormAlert message={save.isError ? getErrorMessage(save.error) : null} />
      {!isAdmin && <FormAlert tone="success" message={m.assumptions_readonly()} />}
      <div className="space-y-4">
        <FilterChips
          legend={m.rw_assumptions_filter()}
          value={origin}
          onChange={setOrigin}
          options={[
            { value: null, label: m.rw_assumptions_filter_all() },
            { value: 'vitrus_data', label: m.param_source_vitrus_data() },
            { value: 'plan', label: m.param_source_plan() },
            { value: 'assumption', label: m.param_source_assumption() },
          ]}
        />
        <fieldset disabled={!isAdmin} className="min-w-0">
          <ParametersForm
            wide
            value={value}
            onChange={setValue}
            meta={data.meta}
            errors={errors}
            sourceFilter={origin}
            defaultOpen={['general', 'street', 'existing', 'on_demand', 'costs']}
          />
        </fieldset>
      </div>
      <p className="text-muted-foreground text-xs tabular-nums">
        {m.assumptions_updated({ date: formatDateTime(data.updated_at) })}
      </p>
    </Page>
  );
}
