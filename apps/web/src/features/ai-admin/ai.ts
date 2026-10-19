import type {
  AiSettingsOut,
  AiSettingsUpdate,
  AiTask,
  EffectiveTask,
  TaskOverride,
} from '@/client';
import { intlTag } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

/** Tarefas configuráveis, pela ordem em que aparecem (a tarefa interna `test` fica de fora). */
export const TASKS = [
  'copilot',
  'whatif',
  'explain',
  'briefing',
  'alert_resolution',
  'triage',
] as const satisfies readonly AiTask[];

export type ConfigurableTask = (typeof TASKS)[number];

export const taskLabel: Record<AiTask, () => string> = {
  copilot: () => m.aiadm_task_copilot(),
  whatif: () => m.aiadm_task_whatif(),
  explain: () => m.aiadm_task_explain(),
  briefing: () => m.aiadm_task_briefing(),
  alert_resolution: () => m.aiadm_task_alert_resolution(),
  triage: () => m.aiadm_task_triage(),
  test: () => m.aiadm_task_test(),
};

export const taskDescription: Record<ConfigurableTask, () => string> = {
  copilot: () => m.aiadm_task_copilot_desc(),
  whatif: () => m.aiadm_task_whatif_desc(),
  explain: () => m.aiadm_task_explain_desc(),
  briefing: () => m.aiadm_task_briefing_desc(),
  alert_resolution: () => m.aiadm_task_alert_resolution_desc(),
  triage: () => m.aiadm_task_triage_desc(),
};

export const labelForTask = (task: string | null): string =>
  task && task in taskLabel ? taskLabel[task as AiTask]() : (task ?? '—');

type Source = EffectiveTask['model_source'];

export const sourceLabel: Record<Source, () => string> = {
  database: () => m.aiadm_source_database(),
  global_default: () => m.aiadm_source_global(),
  env: () => m.aiadm_source_env(),
  code: () => m.aiadm_source_code(),
};

export const effortLabel: Record<'low' | 'medium' | 'high', () => string> = {
  low: () => m.aiadm_effort_low(),
  medium: () => m.aiadm_effort_medium(),
  high: () => m.aiadm_effort_high(),
};

export const capabilityLabel = (capability: string): string => {
  if (capability === 'image') return m.aiadm_cap_image();
  if (capability === 'tools') return m.aiadm_cap_tools();
  if (capability === 'structured_outputs') return m.aiadm_cap_structured();
  return capability;
};

/** Dólares com precisão suficiente para custos de cêntimos por operação. */
export const formatUsd = (value: number, digits?: number): string => {
  const abs = Math.abs(value);
  const d = digits ?? (abs === 0 ? 2 : abs < 0.01 ? 5 : abs < 1 ? 4 : 2);
  return new Intl.NumberFormat(intlTag(), {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Math.min(d, 2),
    maximumFractionDigits: d,
  }).format(value);
};

export const formatMs = (value: number): string =>
  value >= 1000
    ? `${new Intl.NumberFormat(intlTag(), { maximumFractionDigits: 1 }).format(value / 1000)} s`
    : `${new Intl.NumberFormat(intlTag(), { maximumFractionDigits: 0 }).format(value)} ms`;

export const formatSeconds = (value: number): string =>
  `${new Intl.NumberFormat(intlTag(), { maximumFractionDigits: 1 }).format(value)} s`;

export const formatCompact = (value: number): string =>
  new Intl.NumberFormat(intlTag(), { notation: 'compact', maximumFractionDigits: 1 }).format(value);

type SettingsPatch = {
  defaults?: AiSettingsUpdate['defaults'];
  monthly_budget_usd?: number | null;
  /** Substitui os valores próprios de uma tarefa; as outras mantêm-se como estão. */
  task?: { task: AiTask; override: TaskOverride };
};

/** O PUT substitui tudo: reconstrói o corpo a partir do estado atual e aplica só a alteração pedida. */
export function buildSettingsUpdate(
  current: AiSettingsOut,
  patch: SettingsPatch = {},
): AiSettingsUpdate {
  return {
    defaults: patch.defaults ?? current.defaults,
    monthly_budget_usd:
      patch.monthly_budget_usd !== undefined
        ? patch.monthly_budget_usd
        : (current.budget.monthly_budget_usd ?? 0),
    tasks: current.tasks.map((t) => ({
      task: t.task,
      ...(patch.task && patch.task.task === t.task ? patch.task.override : t.override),
    })),
  };
}

/** Unidade a que se refere o custo por operação de cada tarefa. */
export const operationLabel = (operation: string | null): string => {
  switch (operation) {
    case 'per_item_sorted':
      return m.aiadm_op_item();
    case 'per_question':
      return m.aiadm_op_question();
    case 'per_briefing':
      return m.aiadm_op_briefing();
    case 'per_explanation':
      return m.aiadm_op_explanation();
    case 'per_alert':
      return m.aiadm_op_alert();
    default:
      return m.aiadm_op_generic();
  }
};
