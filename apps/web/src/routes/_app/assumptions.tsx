import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  getPlanningParametersOptions,
  getPlanningParametersQueryKey,
  updatePlanningParametersMutation,
} from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { validateParams } from '@/features/assumptions/param-fields';
import { ParametersForm } from '@/features/assumptions/parameters-form';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/assumptions')({
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
        description={m.assumptions_description()}
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
              >
                {save.isPending && <Loader2 className="animate-spin" />}
                {m.common_save()}
              </Button>
            </>
          ) : undefined
        }
      />
      <FormAlert message={save.isError ? getErrorMessage(save.error) : null} />
      {!isAdmin && <FormAlert tone="success" message={m.assumptions_readonly()} />}
      <fieldset disabled={!isAdmin} className="min-w-0">
        <ParametersForm
          value={value}
          onChange={setValue}
          meta={data.meta}
          errors={errors}
          defaultOpen={['general', 'street', 'existing', 'on_demand', 'costs']}
        />
      </fieldset>
      <p className="text-muted-foreground text-xs tabular-nums">
        {m.assumptions_updated({ date: formatDateTime(data.updated_at) })}
      </p>
    </Page>
  );
}
