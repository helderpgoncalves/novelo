import type { MentionType } from '@/client';
import { m } from '@/paraglide/messages';

const MENTION_TYPES: Record<MentionType, () => string> = {
  scenario: () => m.chat_mention_scenario(),
  municipal_site: () => m.chat_mention_municipal_site(),
  parish: () => m.chat_mention_parish(),
  circuit: () => m.chat_mention_circuit(),
  locality: () => m.chat_mention_locality(),
  vehicle: () => m.chat_mention_vehicle(),
  lot: () => m.chat_mention_lot(),
  alert: () => m.chat_mention_alert(),
  report: () => m.chat_mention_report(),
  brand: () => m.chat_mention_brand(),
  fibre: () => m.chat_mention_fibre(),
  page: () => m.chat_mention_page(),
  data_source: () => m.chat_mention_data_source(),
};

export const mentionTypeLabel = (type: MentionType): string => MENTION_TYPES[type]();

const COMMAND_LABELS: Record<string, () => string> = {
  'command.compact': () => m.chat_cmd_compact(),
  'command.new': () => m.chat_cmd_new(),
  'command.clear': () => m.chat_cmd_clear(),
  'command.export': () => m.chat_cmd_export(),
  'command.model': () => m.chat_cmd_model(),
  'command.websearch': () => m.chat_cmd_websearch(),
};
const COMMAND_DESCRIPTIONS: Record<string, () => string> = {
  'command.compact.description': () => m.chat_cmd_compact_desc(),
  'command.new.description': () => m.chat_cmd_new_desc(),
  'command.clear.description': () => m.chat_cmd_clear_desc(),
  'command.export.description': () => m.chat_cmd_export_desc(),
  'command.model.description': () => m.chat_cmd_model_desc(),
  'command.websearch.description': () => m.chat_cmd_websearch_desc(),
};

export const commandLabel = (key: string): string => COMMAND_LABELS[key]?.() ?? key;
export const commandDescription = (key: string): string => COMMAND_DESCRIPTIONS[key]?.() ?? '';

const TOOL_LABELS: Record<string, () => string> = {
  get_baseline: () => m.copilot_tool_get_baseline(),
  list_scenarios: () => m.copilot_tool_list_scenarios(),
  run_scenario: () => m.copilot_tool_run_scenario(),
  compare_scenarios: () => m.copilot_tool_compare_scenarios(),
  what_if: () => m.copilot_tool_what_if(),
  get_coverage: () => m.copilot_tool_get_coverage(),
  get_sensitivity: () => m.copilot_tool_get_sensitivity(),
  web_search: () => m.copilot_tool_web_search(),
  list_assumptions: () => m.copilot_tool_list_assumptions(),
  get_data_gaps: () => m.copilot_tool_get_data_gaps(),
  explain_scenario_difference: () => m.copilot_tool_explain_scenario_difference(),
  list_reports: () => m.copilot_tool_list_reports(),
  analyze_result: () => m.copilot_tool_analyze_result(),
  get_user_stats: () => m.copilot_tool_get_user_stats(),
  get_audit_log: () => m.copilot_tool_get_audit_log(),
};

/** Rótulo legível de uma ferramenta; as que não têm rótulo mostram o nome técnico. */
export const toolLabel = (name: string): string => TOOL_LABELS[name]?.() ?? name;
