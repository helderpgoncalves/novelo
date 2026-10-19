import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FlaskConical, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type {
  AiModelOut,
  AiSettingsOut,
  TaskConfigOut,
  TaskOverride,
  TestModelOut as TestResult,
} from '@/client';
import {
  getAiSettingsQueryKey,
  listAiModelsOptions,
  testAiModelMutation,
  updateAiSettingsMutation,
} from '@/client/@tanstack/react-query.gen';
import { EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import {
  buildSettingsUpdate,
  capabilityLabel,
  effortLabel,
  formatMs,
  formatUsd,
  operationLabel,
  taskLabel,
} from './ai';

type Sort = 'cost' | 'name' | 'price';
const INHERIT = 'inherit';

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

interface ModelPickerProps {
  settings: AiSettingsOut;
  config: TaskConfigOut;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Seletor responsivo (diálogo no desktop, folha no telemóvel) com o catálogo filtrado pela tarefa. */
const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e'];

export function ModelPicker({ settings, config, open, onOpenChange }: ModelPickerProps) {
  const queryClient = useQueryClient();
  const task = config.task;
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [sort, setSort] = useState<Sort>('cost');
  const [selected, setSelected] = useState<string | null>(config.override.model ?? null);
  const [fallback, setFallback] = useState(config.override.fallback_model ?? '');
  const [tokens, setTokens] = useState(
    config.override.max_output_tokens ? String(config.override.max_output_tokens) : '',
  );
  const [effort, setEffort] = useState<string>(config.override.reasoning_effort ?? INHERIT);
  const [tested, setTested] = useState<{ model: string; result: TestResult } | null>(null);

  const models = useQuery(
    listAiModelsOptions({ query: { task, q: q || undefined, sort, limit: 100 } }),
  );
  const test = useMutation({
    ...testAiModelMutation(),
    onSuccess: (result) => setTested({ model: result.model, result }),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const save = useMutation({
    ...updateAiSettingsMutation(),
    onSuccess: async (updated) => {
      queryClient.setQueryData(getAiSettingsQueryKey(), updated);
      await queryClient.invalidateQueries({ queryKey: getAiSettingsQueryKey() });
      toast.success(m.aiadm_saved());
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const tokensNumber = tokens.trim() === '' ? null : Number(tokens);
  const tokensInvalid =
    tokensNumber !== null && (!Number.isInteger(tokensNumber) || tokensNumber < 64);
  const effective = selected ?? config.effective.model;

  const onSave = () => {
    if (tokensInvalid) return;
    const override: TaskOverride = {
      model: selected,
      fallback_model: fallback.trim() || null,
      max_output_tokens: tokensNumber,
      reasoning_effort: effort === INHERIT ? null : (effort as TaskOverride['reasoning_effort']),
    };
    save.mutate({ body: buildSettingsUpdate(settings, { task: { task, override } }) });
  };

  const testResult = tested && tested.model === effective ? tested.result : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" data-testid="ai-model-picker">
        <DialogHeader>
          <DialogTitle>{m.aiadm_picker_title({ task: taskLabel[task]() })}</DialogTitle>
          <DialogDescription>{m.aiadm_picker_desc()}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-muted-foreground">{m.aiadm_card_requirements()}:</span>
          {config.requirements.map((r) => (
            <Badge key={r} variant="outline">
              {capabilityLabel(r)}
            </Badge>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Label htmlFor="ai-model-search" className="sr-only">
              {m.aiadm_picker_search()}
            </Label>
            <Input
              id="ai-model-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={m.aiadm_picker_search()}
              className="h-10 text-base sm:text-sm"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="h-10 w-full sm:w-52" aria-label={m.aiadm_picker_sort()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cost">{m.aiadm_sort_cost()}</SelectItem>
              <SelectItem value="price">{m.aiadm_sort_price()}</SelectItem>
              <SelectItem value="name">{m.aiadm_sort_name()}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          className="max-h-[38dvh] min-h-40 overflow-y-auto rounded-lg border"
          aria-busy={models.isFetching}
        >
          {models.isPending ? (
            <div className="space-y-2 p-3" aria-busy="true">
              <span className="sr-only">{m.common_loading()}</span>
              {SKELETON_KEYS.map((key) => (
                <Skeleton key={key} className="h-16 w-full" />
              ))}
            </div>
          ) : models.isError ? (
            <div className="p-3">
              <ErrorState error={models.error} onRetry={() => models.refetch()} />
            </div>
          ) : models.data.models.length === 0 ? (
            <div className="p-3">
              <EmptyState
                title={m.aiadm_picker_empty_title()}
                description={m.aiadm_picker_empty_desc()}
              />
            </div>
          ) : (
            <>
              {models.data.stale && (
                <p className="border-b bg-areia/20 px-3 py-2 text-xs">{m.aiadm_picker_stale()}</p>
              )}
              <ul className="divide-y" aria-label={m.aiadm_picker_list()}>
                {models.data.models.map((model) => (
                  <ModelRow
                    key={model.id}
                    model={model}
                    operation={models.data.operation}
                    selected={effective === model.id}
                    current={config.effective.model === model.id}
                    onSelect={() => setSelected(model.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-fallback">{m.aiadm_card_fallback()}</Label>
            <Input
              id="ai-fallback"
              value={fallback}
              onChange={(e) => setFallback(e.target.value)}
              placeholder={config.effective.fallback_model ?? m.aiadm_none()}
              className="h-10 font-mono text-base sm:text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-tokens">{m.aiadm_card_tokens()}</Label>
            <Input
              id="ai-tokens"
              inputMode="numeric"
              value={tokens}
              onChange={(e) => setTokens(e.target.value)}
              placeholder={String(config.effective.max_output_tokens)}
              aria-invalid={tokensInvalid}
              className="h-10 text-base sm:text-sm"
            />
            {tokensInvalid && (
              <p className="text-destructive text-xs">{m.aiadm_tokens_invalid()}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-effort">{m.aiadm_card_effort()}</Label>
            <Select value={effort} onValueChange={setEffort}>
              <SelectTrigger id="ai-effort" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={INHERIT}>
                  {m.aiadm_inherit({ value: effortLabel[config.effective.reasoning_effort]() })}
                </SelectItem>
                {(['low', 'medium', 'high'] as const).map((e) => (
                  <SelectItem key={e} value={e}>
                    {effortLabel[e]()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div aria-live="polite">{testResult && <TestResultBox result={testResult} />}</div>

        <DialogFooter className="gap-2 sm:items-center">
          <Button
            type="button"
            variant="ghost"
            className="h-10"
            onClick={() => setSelected(null)}
            disabled={selected === null}
          >
            {m.aiadm_picker_reset()}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={test.isPending}
            onClick={() => test.mutate({ body: { model: effective, task } })}
          >
            {test.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FlaskConical className="size-4" aria-hidden="true" />
            )}
            {m.aiadm_test()}
          </Button>
          <Button
            type="button"
            className="h-10"
            disabled={save.isPending || tokensInvalid}
            onClick={onSave}
            loading={save.isPending}
          >
            {m.common_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestResultBox({ result }: { result: TestResult }) {
  if (result.ok) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-primary">
          <Check className="size-4" aria-hidden="true" />
          {m.aiadm_test_ok()}
        </span>
        <span>{m.aiadm_test_latency({ value: formatMs(result.latency_ms ?? 0) })}</span>
        <span>
          {m.aiadm_test_cost({
            value: result.cost_usd !== null ? formatUsd(result.cost_usd) : '—',
          })}
        </span>
        <span className="text-muted-foreground">
          {m.aiadm_test_tokens({
            input: formatNumber(result.prompt_tokens ?? 0),
            output: formatNumber(result.completion_tokens ?? 0),
          })}
        </span>
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
    >
      <p className="font-medium text-destructive">{m.aiadm_test_failed()}</p>
      {result.missing_capabilities.length > 0 && (
        <p>
          {m.aiadm_test_missing({
            list: result.missing_capabilities.map(capabilityLabel).join(', '),
          })}
        </p>
      )}
      {result.error && <p className="break-words text-muted-foreground">{result.error}</p>}
    </div>
  );
}

function ModelRow({
  model,
  operation,
  selected,
  current,
  onSelect,
}: {
  model: AiModelOut;
  operation: string | null;
  selected: boolean;
  current: boolean;
  onSelect: () => void;
}) {
  const disabled = model.compatible === false;
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={selected}
        onClick={onSelect}
        data-testid="ai-model-row"
        className={cn(
          'flex min-h-14 w-full flex-col gap-2 px-3 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
          selected && 'bg-accent',
        )}
      >
        <span className="min-w-0 space-y-1">
          <span className="flex flex-wrap items-center gap-1.5">
            {selected && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
            <span className="break-words font-medium text-sm">{model.name}</span>
            {model.recommended && (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="size-3" aria-hidden="true" />
                {m.aiadm_recommended()}
              </Badge>
            )}
            {current && <Badge variant="outline">{m.aiadm_in_use()}</Badge>}
            {disabled && <Badge variant="outline">{m.aiadm_incompatible()}</Badge>}
          </span>
          <span className="block break-all font-mono text-[11px] text-muted-foreground">
            {model.id}
          </span>
          <span className="flex flex-wrap gap-1">
            {model.supports_image && (
              <Badge variant="outline" className="gap-1">
                <ImageIcon className="size-3" aria-hidden="true" />
                {capabilityLabel('image')}
              </Badge>
            )}
            {model.supports_tools && <Badge variant="outline">{capabilityLabel('tools')}</Badge>}
            {model.supports_structured_outputs && (
              <Badge variant="outline">{capabilityLabel('structured_outputs')}</Badge>
            )}
          </span>
        </span>
        <span className="shrink-0 space-y-0.5 text-xs sm:text-right">
          <span className="block tabular-nums">
            {model.input_per_m_usd !== null && model.output_per_m_usd !== null
              ? m.aiadm_price_per_m({
                  input: formatUsd(model.input_per_m_usd, 2),
                  output: formatUsd(model.output_per_m_usd, 2),
                })
              : m.aiadm_price_unknown()}
          </span>
          <span className="block text-muted-foreground tabular-nums">
            {model.context_length
              ? m.aiadm_context({ value: formatNumber(model.context_length) })
              : '—'}
          </span>
          {model.cost_per_operation_usd !== null && (
            <span className="block font-medium tabular-nums">
              {m.aiadm_cost_per_op({
                value: formatUsd(model.cost_per_operation_usd),
                operation: operationLabel(operation),
              })}{' '}
              <span className="font-normal text-muted-foreground">
                (
                {model.cost_basis === 'measured'
                  ? m.aiadm_cost_measured({ n: model.cost_samples })
                  : m.aiadm_cost_estimate()}
                )
              </span>
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
