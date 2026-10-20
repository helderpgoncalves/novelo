import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { CopilotSettingsOut, PersonaPreviewIn } from '@/client';
import { previewCopilotPersonaMutation } from '@/client/@tanstack/react-query.gen';
import { Panel } from '@/components/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/errors';
import { getLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { ThinkingLine } from '../thinking';
import { SELECT_CLASS, SettingRow, ToggleRow } from './setting-row';
import { useCopilotSettings } from './use-settings';

type Persona = NonNullable<CopilotSettingsOut['persona']>;

function PersonaPreview({ s }: { s: CopilotSettingsOut }) {
  const [sample, setSample] = useState('');
  const preview = useMutation({
    ...previewCopilotPersonaMutation(),
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const run = () => {
    const body: PersonaPreviewIn = {
      persona: s.persona ?? 'default',
      persona_text: s.persona_text ?? '',
      verbosity: s.verbosity,
      formality: s.formality,
      emoji: s.emoji,
      language: getLocale(),
      ...(sample.trim() ? { sample: sample.trim() } : {}),
    };
    preview.mutate({ body });
  };
  return (
    <div className="space-y-3 border-t pt-4" data-testid="copilot-persona-preview">
      <p className="font-medium text-sm">{m.chat_persona_preview_title()}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          maxLength={200}
          aria-label={m.chat_persona_sample()}
          placeholder={m.chat_persona_sample_placeholder()}
          className="h-11 text-base md:text-base"
        />
        <Button
          className="h-11 shrink-0"
          variant="outline"
          loading={preview.isPending}
          onClick={run}
        >
          {m.chat_persona_preview()}
        </Button>
      </div>
      {preview.isPending && (
        <ThinkingLine status={{ phase: 'writing', labelKey: 'status.writing', detail: null }} />
      )}
      {preview.data && !preview.isPending && (
        <blockquote
          aria-live="polite"
          className="whitespace-pre-wrap rounded-lg border-l-2 border-primary bg-muted/50 p-3 text-sm leading-relaxed"
        >
          {preview.data.text}
        </blockquote>
      )}
    </div>
  );
}

/** Personalidade: escolhe o estilo do copiloto (nunca as regras) e vê como responderia antes de guardar. */
export function PersonaSection() {
  const { query, save } = useCopilotSettings();
  const s = query.data;
  const [text, setText] = useState(s?.persona_text ?? '');
  useEffect(() => setText(s?.persona_text ?? ''), [s?.persona_text]);
  if (!s) return null;
  const persona: Persona = s.persona ?? 'default';
  const label = (p: CopilotSettingsOut['personas'][number]) =>
    getLocale() === 'en' ? p.label_en : p.label_pt;

  return (
    <div className="space-y-5">
      <Panel title={m.chat_persona_title()} description={m.chat_persona_description()}>
        <RadioGroup
          value={persona}
          onValueChange={(v) => save({ persona: v as Persona })}
          className="grid gap-2 sm:grid-cols-2"
          aria-label={m.chat_persona_title()}
        >
          {s.personas.map((p) => (
            <label
              key={p.key}
              htmlFor={`persona-${p.key}`}
              className={cn(
                'flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50',
                persona === p.key && 'border-primary bg-primary/5',
              )}
            >
              <RadioGroupItem id={`persona-${p.key}`} value={p.key} className="mt-0.5" />
              <span className="min-w-0 space-y-0.5">
                <span className="block font-medium text-sm">
                  {label(p)}
                  {p.key === s.default_persona && p.key !== 'default'
                    ? ` · ${m.chat_persona_default_tag()}`
                    : ''}
                </span>
                <span className="block text-muted-foreground text-xs leading-relaxed">
                  {p.description}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>

        {persona === 'custom' && (
          <div className="space-y-2">
            <label htmlFor="persona-text" className="font-medium text-sm">
              {m.chat_persona_custom()}
            </label>
            <Textarea
              id="persona-text"
              value={text}
              maxLength={1500}
              onChange={(e) => setText(e.target.value)}
              className="min-h-28 text-base md:text-base"
              placeholder={m.chat_persona_custom_placeholder()}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs tabular-nums">{text.length}/1500</p>
              <Button
                className="h-10"
                disabled={text === (s.persona_text ?? '')}
                onClick={() => save({ persona_text: text })}
              >
                {m.common_save()}
              </Button>
            </div>
          </div>
        )}

        <div className="divide-y">
          <SettingRow label={m.chat_set_verbosity()} htmlFor="set-verbosity">
            <select
              id="set-verbosity"
              className={SELECT_CLASS}
              value={s.verbosity ?? 'balanced'}
              onChange={(e) =>
                save({ verbosity: e.target.value as 'short' | 'balanced' | 'detailed' })
              }
            >
              <option value="short">{m.chat_verbosity_short()}</option>
              <option value="balanced">{m.chat_verbosity_balanced()}</option>
              <option value="detailed">{m.chat_verbosity_detailed()}</option>
            </select>
          </SettingRow>
          <SettingRow label={m.chat_set_formality()} htmlFor="set-formality">
            <select
              id="set-formality"
              className={SELECT_CLASS}
              value={s.formality ?? 'neutral'}
              onChange={(e) =>
                save({ formality: e.target.value as 'informal' | 'neutral' | 'formal' })
              }
            >
              <option value="informal">{m.chat_formality_informal()}</option>
              <option value="neutral">{m.chat_formality_neutral()}</option>
              <option value="formal">{m.chat_formality_formal()}</option>
            </select>
          </SettingRow>
          <SettingRow label={m.chat_set_language()} htmlFor="set-language">
            <select
              id="set-language"
              className={SELECT_CLASS}
              value={s.preferred_language ?? 'auto'}
              onChange={(e) =>
                save({ preferred_language: e.target.value as 'auto' | 'pt-PT' | 'en' })
              }
            >
              <option value="auto">{m.chat_language_auto()}</option>
              <option value="pt-PT">Português</option>
              <option value="en">English</option>
            </select>
          </SettingRow>
          <ToggleRow
            id="set-emoji"
            label={m.chat_set_emoji()}
            checked={s.emoji ?? false}
            onChange={(v) => save({ emoji: v })}
          />
        </div>
        <PersonaPreview s={s} />
      </Panel>
    </div>
  );
}
