import { Panel } from '@/components/panel';
import { Slider } from '@/components/ui/slider';
import { m } from '@/paraglide/messages';
import { SELECT_CLASS, SettingRow, ToggleRow } from './setting-row';
import { useCopilotSettings } from './use-settings';

/** Comportamento: confirmações, passos, sugestões, resumo automático e retenção do histórico. */
export function BehaviourSection() {
  const { query, save } = useCopilotSettings();
  const s = query.data;
  if (!s) return null;
  const compact = s.auto_compact_pct ?? 65;
  const retention =
    s.retention_days === null || s.retention_days === undefined ? 'none' : String(s.retention_days);
  return (
    <div className="space-y-5">
      <Panel title={m.chat_behaviour_title()} description={m.chat_behaviour_description()}>
        <div className="divide-y">
          <ToggleRow
            id="set-confirm-writes"
            label={m.chat_set_confirm_writes()}
            hint={m.chat_set_confirm_writes_hint()}
            checked={s.confirm_writes ?? true}
            onChange={(v) => save({ confirm_writes: v })}
          />
          <ToggleRow
            id="set-auto-low"
            label={m.chat_set_auto_low()}
            hint={m.chat_set_auto_low_hint()}
            checked={s.auto_approve_low_risk ?? false}
            onChange={(v) => save({ auto_approve_low_risk: v })}
          />
          <ToggleRow
            id="set-steps"
            label={m.chat_set_steps()}
            hint={m.chat_set_steps_hint()}
            checked={s.show_tool_steps ?? true}
            onChange={(v) => save({ show_tool_steps: v })}
          />
          <ToggleRow
            id="set-suggestions"
            label={m.chat_set_suggestions()}
            hint={m.chat_set_suggestions_hint()}
            checked={s.follow_up_suggestions ?? true}
            onChange={(v) => save({ follow_up_suggestions: v })}
          />
          <div className="space-y-3 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="set-compact" className="font-medium text-sm">
                {m.chat_set_compact()}
              </label>
              <span className="text-sm tabular-nums">{compact}%</span>
            </div>
            <Slider
              id="set-compact"
              min={50}
              max={90}
              step={5}
              value={[compact]}
              onValueChange={([v]) => v !== undefined && save({ auto_compact_pct: v })}
              aria-label={m.chat_set_compact()}
            />
            <p className="text-muted-foreground text-xs">{m.chat_set_compact_hint()}</p>
          </div>
        </div>
      </Panel>
      <Panel title={m.chat_retention_title()} description={m.chat_retention_description()}>
        <div className="divide-y">
          <ToggleRow
            id="set-history"
            label={m.chat_set_history()}
            hint={m.chat_set_history_hint()}
            checked={s.save_history ?? true}
            onChange={(v) => save({ save_history: v })}
          />
          <SettingRow
            label={m.chat_set_retention()}
            hint={m.chat_set_retention_hint({ days: s.effective_retention_days ?? 0 })}
            htmlFor="set-retention"
          >
            <select
              id="set-retention"
              className={SELECT_CLASS}
              value={retention}
              onChange={(e) =>
                save({
                  retention_days:
                    e.target.value === 'none' ? null : (Number(e.target.value) as 30 | 90 | 365),
                })
              }
            >
              <option value="30">{m.chat_retention_days({ days: 30 })}</option>
              <option value="90">{m.chat_retention_days({ days: 90 })}</option>
              <option value="365">{m.chat_retention_days({ days: 365 })}</option>
              <option value="none">{m.chat_retention_none()}</option>
            </select>
          </SettingRow>
        </div>
      </Panel>
    </div>
  );
}
