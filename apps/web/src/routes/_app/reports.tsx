import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { DownloadReportData, ReportOut } from '@/client';
import {
  createRapReportMutation,
  listReportsOptions,
  listReportsQueryKey,
  listScenariosOptions,
} from '@/client/@tanstack/react-query.gen';
import { client } from '@/client/client.gen';
import { type Column, DataTable } from '@/components/data-table';
import { Page, Panel, Section, SectionTitle } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { WorkingState } from '@/components/working-state';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { formatEur, formatNumber, formatTonnes } from '@/lib/format';
import { formatDateTime, getLocale, LOCALE_LABELS, type Locale, locales } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/reports')({
  staticData: { skeleton: 'form' },
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listScenariosOptions()),
      queryClient.ensureQueryData(listReportsOptions()),
    ]),
  head: () => ({ meta: [{ title: m.title_reports() }] }),
  component: Reports,
});

const MAX_SCENARIOS = 3;

const pdfUrl = (id: string) =>
  client.buildUrl<DownloadReportData>({
    url: '/api/v1/reports/{report_id}/pdf',
    path: { report_id: id },
  });

function Reports() {
  const queryClient = useQueryClient();
  const { data: scenarios } = useSuspenseQuery(listScenariosOptions());
  const { data: reports } = useSuspenseQuery(listReportsOptions());
  const [selected, setSelected] = useState<string[]>(scenarios.slice(0, 2).map((s) => s.id));
  const [locale, setLocale] = useState<Locale>(getLocale());
  const computed = scenarios.filter((s) => s.status === 'computed');

  const generate = useMutation({
    ...createRapReportMutation(),
    onSuccess: async (report) => {
      await queryClient.invalidateQueries({ queryKey: listReportsQueryKey() });
      toast.success(m.reports_generated());
      window.open(pdfUrl(report.id), '_blank', 'noopener');
    },
  });

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_SCENARIOS
          ? prev
          : [...prev, id],
    );

  return (
    <Page>
      <PageHeader
        eyebrow={m.reports_eyebrow()}
        title={m.reports_title()}
        description={m.rw_reports_description()}
      />

      <StatStrip className="lg:grid-cols-3">
        <StatCell
          label={m.rw_reports_stat_scenarios()}
          value={formatNumber(computed.length)}
          hint={m.rw_reports_stat_scenarios_hint()}
        />
        <StatCell
          label={m.rw_reports_stat_selected()}
          value={`${selected.length}/${MAX_SCENARIOS}`}
          tone="primary"
          hint={m.rw_reports_stat_selected_hint()}
        />
        <StatCell
          label={m.rw_reports_stat_generated()}
          value={formatNumber(reports.length)}
          hint={m.rw_reports_stat_generated_hint()}
        />
      </StatStrip>

      {computed.length === 0 ? (
        <EmptyState
          title={m.reports_no_scenarios_title()}
          description={m.reports_no_scenarios_text()}
          action={
            <Button asChild>
              <Link to="/simulator">{m.scenarios_new()}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-6">
          <Section
            title={m.reports_pick()}
            description={m.reports_pick_hint()}
            className="min-w-0 lg:col-span-8"
          >
            <ul className="max-h-[36rem] divide-y divide-border overflow-y-auto rounded-xl bg-card ring-1 ring-foreground/10">
              {computed.map((s) => (
                <li key={s.id}>
                  <Label
                    htmlFor={`sc-${s.id}`}
                    className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3 font-normal hover:bg-muted/40"
                  >
                    <Checkbox
                      id={`sc-${s.id}`}
                      checked={selected.includes(s.id)}
                      onCheckedChange={() => toggle(s.id)}
                      disabled={!selected.includes(s.id) && selected.length >= MAX_SCENARIOS}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.label}</span>
                      <span className="block text-muted-foreground text-xs tabular-nums">
                        {formatTonnes(s.tonnes_year)} ·{' '}
                        {s.eur_per_tonne == null
                          ? m.common_dash()
                          : `${formatNumber(s.eur_per_tonne, 0)} €/t`}{' '}
                        · {formatEur(s.annual_cost_eur)}
                      </span>
                    </span>
                  </Label>
                </li>
              ))}
            </ul>
            {selected.length >= MAX_SCENARIOS && (
              <p className="text-muted-foreground text-xs">{m.reports_max()}</p>
            )}
          </Section>

          <aside className="self-start lg:sticky lg:top-4 lg:col-span-4">
            <Panel className="space-y-5">
              <SectionTitle>{m.rw_reports_step_generate()}</SectionTitle>
              <FormAlert message={generate.isError ? getErrorMessage(generate.error) : null} />
              <fieldset className="space-y-2">
                <legend className="mb-1 font-medium text-sm">{m.reports_language()}</legend>
                <RadioGroup
                  value={locale}
                  onValueChange={(v) => setLocale(v as Locale)}
                  className="gap-1"
                >
                  {locales.map((l) => (
                    <Label
                      key={l}
                      htmlFor={`rl-${l}`}
                      className="flex min-h-10 cursor-pointer items-center gap-2 font-normal text-sm"
                    >
                      <RadioGroupItem id={`rl-${l}`} value={l} />
                      {LOCALE_LABELS[l]}
                    </Label>
                  ))}
                </RadioGroup>
              </fieldset>
              {generate.isPending && (
                <WorkingState
                  title={m.working_reports_title()}
                  subtitle={m.working_reports_hint()}
                  trackElapsed
                />
              )}
              <Button
                className="h-11 w-full gap-2 font-semibold"
                disabled={selected.length === 0 || generate.isPending}
                onClick={() => generate.mutate({ body: { scenario_ids: selected, locale } })}
              >
                <FileText />
                {generate.isPending ? m.reports_generating() : m.reports_generate()}
              </Button>
            </Panel>
          </aside>
        </div>
      )}

      <Section title={m.reports_history()}>
        {reports.length === 0 ? (
          <EmptyState title={m.reports_history_empty()} />
        ) : (
          <DataTable
            id="reports"
            exportName="relatorios"
            controls="auto"
            columns={historyColumns}
            rows={reports}
            getRowId={(r) => r.id}
            caption={m.reports_history()}
          />
        )}
      </Section>
    </Page>
  );
}

const historyColumns: Column<ReportOut>[] = [
  {
    id: 'title',
    header: m.reports_col_title(),
    primary: true,
    label: m.reports_col_title(),
    value: (r) => r.title,
    cell: (r) => (
      <>
        {r.title}{' '}
        <span className="font-normal text-muted-foreground text-xs">
          ({LOCALE_LABELS[r.locale]})
        </span>
      </>
    ),
  },
  {
    id: 'scenarios',
    header: m.reports_col_scenarios(),
    className: 'text-muted-foreground',
    value: (r) => r.scenario_ids.length,
    searchable: false,
    cell: (r) => r.scenario_ids.length,
  },
  {
    id: 'created',
    type: 'datetime',
    header: m.reports_col_created(),
    className: 'text-muted-foreground',
    value: (r) => r.created_at,
    searchable: false,
    cell: (r) => formatDateTime(r.created_at),
  },
  {
    id: 'size',
    header: m.reports_col_size(),
    align: 'right',
    value: (r) => r.size_bytes,
    searchable: false,
    cell: (r) => `${formatNumber(r.size_bytes / 1024, 0)} kB`,
  },
  {
    id: 'open',
    header: <span className="sr-only">{m.reports_open()}</span>,
    align: 'right',
    full: true,
    label: m.reports_open(),
    hideable: false,
    cell: (r) => (
      <Button asChild variant="outline" size="sm" className="w-full md:w-auto">
        <a href={pdfUrl(r.id)} target="_blank" rel="noreferrer">
          {m.reports_open()}
        </a>
      </Button>
    ),
  },
];
