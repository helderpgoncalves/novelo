import type { MentionType } from '@/client';
import { m } from '@/paraglide/messages';

const MENTION_TYPES: Record<MentionType, () => string> = {
  scenario: () => m.chat_mention_scenario(),
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
};
const COMMAND_DESCRIPTIONS: Record<string, () => string> = {
  'command.compact.description': () => m.chat_cmd_compact_desc(),
  'command.new.description': () => m.chat_cmd_new_desc(),
  'command.clear.description': () => m.chat_cmd_clear_desc(),
  'command.export.description': () => m.chat_cmd_export_desc(),
  'command.model.description': () => m.chat_cmd_model_desc(),
};

export const commandLabel = (key: string): string => COMMAND_LABELS[key]?.() ?? key;
export const commandDescription = (key: string): string => COMMAND_DESCRIPTIONS[key]?.() ?? '';
