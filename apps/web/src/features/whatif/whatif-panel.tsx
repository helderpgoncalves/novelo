import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Check, MessageSquareQuote, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { ScenarioOut, WhatIfOut } from '@/client';
import {
  applyWhatIfMutation,
  askWhatIfMutation,
  listScenariosQueryKey,
  listWhatIfsOptions,
  listWhatIfsQueryKey,
} from '@/client/@tanstack/react-query.gen';
import { BrandSpinner } from '@/components/brand-logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { formatEur } from '@/lib/format';
import { getLocale } from '@/lib/i18n';
import { modeLabel } from '@/lib/scenario';
import { m } from '@/paraglide/messages';

const EXAMPLES = [
  () => m.whatif_example_1(),
  () => m.whatif_example_2(),
  () => m.whatif_example_3(),
];

/** "E se...?": a IA percebe a pergunta, o utilizador confirma, o otimizador calcula e um verificador valida os números. */
export function WhatIfPanel({ scenario }: { scenario: ScenarioOut }) {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const [proposal, setProposal] = useState<WhatIfOut | null>(null);
  const history = useQuery(listWhatIfsOptions({ query: { scenario_id: scenario.id } }));

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: listWhatIfsQueryKey({ query: { scenario_id: scenario.id } }),
      }),
      queryClient.invalidateQueries({ queryKey: listScenariosQueryKey() }),
    ]);
  const ask = useMutation({
    ...askWhatIfMutation(),
    onSuccess: async (run) => {
      setProposal(run);
      await refresh();
    },
  });
  const apply = useMutation({
    ...applyWhatIfMutation(),
    onSuccess: async (run) => {
      setProposal(run);
      setQuestion('');
      await refresh();
    },
  });

  const aiOff = ask.isError && getErrorCode(ask.error) === 'feature_disabled';
  const busy = ask.isPending || apply.isPending;

  return (
    <div className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim().length >= 5) {
            setProposal(null);
            ask.mutate({
              body: { scenario_id: scenario.id, question: question.trim(), locale: getLocale() },
            });
          }
        }}
      >
        <label htmlFor="whatif" className="flex items-center gap-2 font-medium text-sm">
          <MessageSquareQuote className="size-4 text-primary" aria-hidden="true" />{' '}
          {m.whatif_label()}
        </label>
        <Textarea
          id="whatif"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={m.whatif_placeholder()}
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            className="h-9 font-semibold"
            disabled={busy || question.trim().length < 5}
            loading={ask.isPending}
          >
            {m.whatif_ask()}
          </Button>
          {EXAMPLES.map((example) => (
            <Button
              key={example()}
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 max-w-full text-muted-foreground text-xs"
              onClick={() => setQuestion(example())}
              disabled={busy}
            >
              {example()}
            </Button>
          ))}
        </div>
      </form>

      {aiOff && (
        <Alert>
          <TriangleAlert className="size-4" />
          <AlertTitle>{m.whatif_ai_off_title()}</AlertTitle>
          <AlertDescription>{m.whatif_ai_off_text()}</AlertDescription>
        </Alert>
      )}
      <FormAlert
        message={
          (ask.isError && !aiOff ? getErrorMessage(ask.error) : null) ??
          (apply.isError ? getErrorMessage(apply.error) : null)
        }
      />

      {proposal && (
        <Proposal
          run={proposal}
          busy={apply.isPending}
          onApply={() =>
            apply.mutate({ path: { run_id: proposal.id }, query: { locale: getLocale() } })
          }
        />
      )}

      {history.data && history.data.length > 0 && (
        <details className="group border-border border-t pt-3">
          <summary className="cursor-pointer text-muted-foreground text-sm">
            {m.whatif_history({ count: history.data.length })}
          </summary>
          <ul className="mt-3 space-y-3">
            {history.data.map((run) => (
              <li key={run.id} className="space-y-1 text-sm">
                <p className="font-medium">“{run.question}”</p>
                <p className="text-muted-foreground">{run.understood}</p>
                {run.new_scenario_id && (
                  <Link
                    to="/scenarios/$scenarioId"
                    params={{ scenarioId: run.new_scenario_id }}
                    className="text-primary text-xs hover:underline"
                  >
                    {m.whatif_open_result()}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Proposal({ run, busy, onApply }: { run: WhatIfOut; busy: boolean; onApply: () => void }) {
  if (run.status === 'rejected') {
    return (
      <div
        role="status"
        className="space-y-2 rounded-lg border border-areia/60 bg-areia/10 p-4 text-sm"
      >
        <p className="font-medium">{run.understood}</p>
        {run.clarification && <p>{run.clarification}</p>}
        {run.unknown_parishes.length > 0 && (
          <p>{m.whatif_unknown_parishes({ names: run.unknown_parishes.join(', ') })}</p>
        )}
        {run.suggestions.length > 0 && (
          <p className="text-muted-foreground">
            {m.whatif_suggestions({ names: run.suggestions.join(', ') })}
          </p>
        )}
        {run.unknown_parishes.length === 0 && !run.clarification && (
          <p className="text-muted-foreground">{m.whatif_nothing_to_apply()}</p>
        )}
      </div>
    );
  }
  return (
    <div
      role="status"
      className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm"
    >
      <p className="font-medium">{run.understood}</p>
      <ul className="flex flex-wrap gap-2 text-xs">
        {run.changes.map((c) => (
          <li key={c.parish_code} className="rounded-full bg-background px-2.5 py-1">
            {c.parish_name}: {c.allowed_modes.map((x) => modeLabel[x]()).join(', ')}
          </li>
        ))}
        {run.budget_eur_year != null && (
          <li className="rounded-full bg-background px-2.5 py-1">
            {m.whatif_budget({ value: formatEur(run.budget_eur_year) })}
          </li>
        )}
        {run.target_pct != null && (
          <li className="rounded-full bg-background px-2.5 py-1">
            {m.whatif_target({ value: run.target_pct })}
          </li>
        )}
        {run.capture_scale && (
          <li className="rounded-full bg-background px-2.5 py-1">
            {m.whatif_capture({
              mode: modeLabel[run.capture_scale.mode](),
              factor: run.capture_scale.factor,
            })}
          </li>
        )}
      </ul>
      {run.status === 'proposed' ? (
        <Button className="h-9 gap-2 font-semibold" disabled={busy} onClick={onApply}>
          {busy ? <BrandSpinner tone="mono" /> : <Check />}
          {busy ? m.whatif_running() : m.whatif_confirm()}
        </Button>
      ) : (
        <div className="space-y-2">
          {run.explanation && <p className="leading-relaxed">{run.explanation}</p>}
          <div className="flex flex-wrap items-center gap-3">
            {run.explanation_verified ? (
              <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
                <ShieldCheck className="size-3" /> {m.whatif_verified()}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-areia/70">
                {m.whatif_unverified()}
              </Badge>
            )}
            {run.new_scenario_id && (
              <Button asChild size="sm" className="h-8">
                <Link to="/scenarios/$scenarioId" params={{ scenarioId: run.new_scenario_id }}>
                  {m.whatif_open_result()}
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
