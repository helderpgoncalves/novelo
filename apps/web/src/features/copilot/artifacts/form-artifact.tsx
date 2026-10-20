import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ActionOut, ActionType, FormField, FormSpec } from '@/client';
import {
  listScenariosOptions,
  proposeCopilotActionMutation,
} from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/errors';
import { getLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { ActionCard } from '../action-card';

type Value = string | number | boolean | null;

const SELECT_CLASS =
  'h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30';

function ScenarioSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { data } = useQuery(listScenariosOptions());
  return (
    <select
      id={id}
      className={SELECT_CLASS}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{m.chat_form_choose()}</option>
      {data?.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

function Field({
  field,
  id,
  value,
  onChange,
}: {
  field: FormField;
  id: string;
  value: Value;
  onChange: (v: Value) => void;
}) {
  switch (field.type) {
    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={id}
            checked={value === true}
            onCheckedChange={(c) => onChange(c === true)}
          />
          <Label htmlFor={id}>{field.label}</Label>
        </div>
      );
    case 'select':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}</Label>
          <select
            id={id}
            className={SELECT_CLASS}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{m.chat_form_choose()}</option>
            {field.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      );
    case 'scenario':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}</Label>
          <ScenarioSelect id={id} value={String(value ?? '')} onChange={onChange} />
        </div>
      );
    case 'textarea':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}</Label>
          <Textarea
            id={id}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="text-base"
          />
        </div>
      );
    default:
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}</Label>
          <Input
            id={id}
            type={field.type === 'number' ? 'number' : 'text'}
            inputMode={field.type === 'number' ? 'decimal' : undefined}
            value={String(value ?? '')}
            onChange={(e) =>
              onChange(
                field.type === 'number' && e.target.value !== ''
                  ? Number(e.target.value)
                  : e.target.value,
              )
            }
            className="h-11 text-base md:text-base"
          />
        </div>
      );
  }
}

/** Formulário gerado pelo copiloto quando falta um parâmetro: a submissão só propõe a ação, quem a confirma é a pessoa. */
export function FormArtifactView({ spec }: { spec: FormSpec }) {
  const [values, setValues] = useState<Record<string, Value>>(() =>
    Object.fromEntries(
      spec.fields.map((f) => [f.name, f.default ?? (f.type === 'boolean' ? false : '')]),
    ),
  );
  const [action, setAction] = useState<ActionOut | null>(null);
  const propose = useMutation({
    ...proposeCopilotActionMutation(),
    onSuccess: setAction,
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (action) return <ActionCard action={action} onChange={setAction} />;

  const missing = spec.fields.some(
    (f) => f.required && (values[f.name] === '' || values[f.name] === null),
  );
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        propose.mutate({
          body: {
            type: spec.action_type as ActionType,
            params: Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '')),
            locale: getLocale(),
          },
        });
      }}
    >
      {spec.fields.map((f) => (
        <Field
          key={f.name}
          field={f}
          id={`form-${spec.action_type}-${f.name}`}
          value={values[f.name] ?? null}
          onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
        />
      ))}
      <Button type="submit" className="h-10" disabled={missing || propose.isPending}>
        {propose.isPending ? m.chat_form_proposing() : m.chat_form_propose()}
      </Button>
    </form>
  );
}
