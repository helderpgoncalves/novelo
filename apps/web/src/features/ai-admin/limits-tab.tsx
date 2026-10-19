import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { AiSettingsOut } from '@/client';
import {
  getAiSettingsQueryKey,
  getAiUsageQueryKey,
  updateAiSettingsMutation,
} from '@/client/@tanstack/react-query.gen';
import { Section } from '@/components/page';
import { StickyActions } from '@/components/sticky-actions';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { buildSettingsUpdate, effortLabel, formatUsd } from './ai';

const INHERIT = 'inherit';

const optionalNumber = (kind: 'money' | 'int') =>
  z.string().refine(
    (v) => {
      const t = v.trim().replace(',', '.');
      if (t === '') return true;
      const n = Number(t);
      return Number.isFinite(n) && n >= 0 && (kind === 'money' || (Number.isInteger(n) && n >= 64));
    },
    { error: () => (kind === 'money' ? m.aiadm_budget_invalid() : m.aiadm_tokens_invalid()) },
  );

const schema = z.object({
  budget: optionalNumber('money'),
  tokens: optionalNumber('int'),
  effort: z.enum([INHERIT, 'low', 'medium', 'high']),
  text_model: z.string(),
  vision_model: z.string(),
  fallback_model: z.string(),
});
type Values = z.infer<typeof schema>;

const toNumber = (v: string): number | null =>
  v.trim() === '' ? null : Number(v.trim().replace(',', '.'));
const toText = (v: string): string | null => v.trim() || null;

function fromSettings(s: AiSettingsOut): Values {
  return {
    budget: s.budget.monthly_budget_usd === null ? '' : String(s.budget.monthly_budget_usd),
    tokens: s.defaults.max_output_tokens ? String(s.defaults.max_output_tokens) : '',
    effort: s.defaults.reasoning_effort ?? INHERIT,
    text_model: s.defaults.text_model ?? '',
    vision_model: s.defaults.vision_model ?? '',
    fallback_model: s.defaults.fallback_model ?? '',
  };
}

export function LimitsTab({ settings }: { settings: AiSettingsOut }) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: fromSettings(settings),
  });
  const save = useMutation({
    ...updateAiSettingsMutation(),
    onSuccess: async (updated) => {
      queryClient.setQueryData(getAiSettingsQueryKey(), updated);
      form.reset(fromSettings(updated));
      await queryClient.invalidateQueries({ queryKey: getAiUsageQueryKey() });
      toast.success(m.aiadm_saved());
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const onSubmit = (v: Values) =>
    save.mutate({
      body: buildSettingsUpdate(settings, {
        monthly_budget_usd: toNumber(v.budget),
        defaults: {
          max_output_tokens: toNumber(v.tokens),
          reasoning_effort: v.effort === INHERIT ? null : v.effort,
          text_model: toText(v.text_model),
          vision_model: toText(v.vision_model),
          fallback_model: toText(v.fallback_model),
        },
      }),
    });

  const env = settings.env;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <FormAlert message={save.isError ? getErrorMessage(save.error) : null} />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <Section
            className="lg:col-span-5"
            title={m.aiadm_limits_budget_title()}
            description={m.aiadm_limits_budget_desc()}
          >
            <div className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.aiadm_limits_budget_label()}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="decimal"
                        placeholder={m.aiadm_limits_budget_placeholder()}
                        className="h-10 text-base sm:text-sm"
                      />
                    </FormControl>
                    <FormDescription>
                      {m.aiadm_limits_budget_hint({ spent: formatUsd(settings.budget.spent_usd) })}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Section>

          <Section
            className="lg:col-span-7"
            title={m.aiadm_limits_defaults_title()}
            description={m.aiadm_limits_defaults_desc()}
          >
            <div className="grid grid-cols-1 gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="tokens"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.aiadm_card_tokens()}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="numeric"
                        placeholder={
                          env.max_output_tokens ? formatNumber(env.max_output_tokens) : ''
                        }
                        className="h-10 text-base sm:text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="effort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.aiadm_card_effort()}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={INHERIT}>
                          {env.reasoning_effort
                            ? m.aiadm_inherit_env({ value: effortLabel[env.reasoning_effort]() })
                            : m.aiadm_inherit_plain()}
                        </SelectItem>
                        {(['low', 'medium', 'high'] as const).map((e) => (
                          <SelectItem key={e} value={e}>
                            {effortLabel[e]()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ModelField
                form={form}
                name="text_model"
                label={m.aiadm_limits_text_model()}
                placeholder={env.text_model}
              />
              <ModelField
                form={form}
                name="vision_model"
                label={m.aiadm_limits_vision_model()}
                placeholder={env.vision_model}
              />
              <div className="sm:col-span-2">
                <ModelField
                  form={form}
                  name="fallback_model"
                  label={m.aiadm_card_fallback()}
                  placeholder={env.fallback_model}
                  hint={m.aiadm_limits_fallback_hint()}
                />
              </div>
            </div>
          </Section>
        </div>

        <StickyActions className="flex flex-wrap gap-2">
          <Button
            type="submit"
            className="h-10 flex-1 sm:flex-none"
            disabled={save.isPending}
            loading={save.isPending}
          >
            {m.common_save()}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={!form.formState.isDirty || save.isPending}
            onClick={() => form.reset(fromSettings(settings))}
          >
            {m.aiadm_limits_discard()}
          </Button>
        </StickyActions>
      </form>
    </Form>
  );
}

function ModelField({
  form,
  name,
  label,
  placeholder,
  hint,
}: {
  form: ReturnType<typeof useForm<Values>>;
  name: 'text_model' | 'vision_model' | 'fallback_model';
  label: string;
  placeholder?: string | null;
  hint?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder={placeholder ?? m.aiadm_none()}
              autoCapitalize="none"
              spellCheck={false}
              className="h-10 font-mono text-base sm:text-xs"
            />
          </FormControl>
          {hint && <FormDescription>{hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
