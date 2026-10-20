import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CopilotSettings, CopilotSettingsOut } from '@/client';
import {
  getCopilotSettingsOptions,
  getCopilotSettingsQueryKey,
  updateCopilotSettingsMutation,
} from '@/client/@tanstack/react-query.gen';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';

/** O `PUT` das definições substitui tudo: enviamos sempre o objeto completo, sem os campos só de leitura. */
export function toBody(s: CopilotSettingsOut): CopilotSettings {
  return {
    auto_approve_low_risk: s.auto_approve_low_risk,
    auto_compact_pct: s.auto_compact_pct,
    background_review: s.background_review,
    confirm_writes: s.confirm_writes,
    emoji: s.emoji,
    follow_up_suggestions: s.follow_up_suggestions,
    formality: s.formality,
    memory_enabled: s.memory_enabled,
    memory_notifications: s.memory_notifications,
    persona: s.persona,
    persona_text: s.persona_text,
    preferred_language: s.preferred_language,
    retention_days: s.retention_days,
    save_history: s.save_history,
    show_tool_steps: s.show_tool_steps,
    user_profile_enabled: s.user_profile_enabled,
    verbosity: s.verbosity,
    write_approval: s.write_approval,
  };
}

export function useCopilotSettings() {
  const qc = useQueryClient();
  const query = useQuery(getCopilotSettingsOptions());
  const mutation = useMutation({
    ...updateCopilotSettingsMutation(),
    onSuccess: (data) => {
      qc.setQueryData(getCopilotSettingsQueryKey(), data);
      toast.success(m.chat_settings_saved());
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const save = (patch: Partial<CopilotSettings>) => {
    if (!query.data) return;
    // Otimista: o interruptor responde já; se o servidor recusar, a consulta volta ao valor guardado.
    qc.setQueryData(getCopilotSettingsQueryKey(), { ...query.data, ...patch });
    mutation.mutate(
      { body: { ...toBody(query.data), ...patch } },
      { onError: () => void qc.invalidateQueries({ queryKey: getCopilotSettingsQueryKey() }) },
    );
  };
  return { query, save, saving: mutation.isPending };
}
