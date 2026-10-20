import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';

const TYPE_MESSAGES: Record<string, () => string> = {
  missing: () => m.err_field_missing(),
  string_too_short: () => m.err_field_short(),
  string_too_long: () => m.err_field_long(),
};

interface ApiFieldError {
  field: string;
  type: string;
}

const fieldErrorsOf = (error: unknown): ApiFieldError[] => {
  if (typeof error !== 'object' || error === null || !('fields' in error)) return [];
  const fields = (error as { fields: unknown }).fields;
  return Array.isArray(fields) ? (fields as ApiFieldError[]) : [];
};

/**
 * Passa o erro de um pedido para os campos do formulário e põe o foco no primeiro inválido.
 * Aceita a lista `fields` do `validation_error` (a API) e códigos que pertencem a um campo
 * (ex.: `email_taken` -> `email`). Devolve `true` se algum campo recebeu o erro, para o aviso geral não o repetir.
 */
export function applyApiFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
  byCode: Partial<Record<string, FieldPath<T>>> = {},
): boolean {
  const known = new Set(Object.keys(form.getValues()));
  let focused = false;
  const put = (name: FieldPath<T>, message: string) => {
    form.setError(name, { type: 'server', message }, { shouldFocus: !focused });
    focused = true;
  };

  const code = getErrorCode(error);
  const owner = code ? byCode[code] : undefined;
  if (owner) put(owner, getErrorMessage(error));

  for (const f of fieldErrorsOf(error)) {
    const name = f.field.replace(/^body\./, '');
    if (!known.has(name)) continue;
    put(name as FieldPath<T>, (TYPE_MESSAGES[f.type] ?? (() => m.err_field_invalid()))());
  }
  return focused;
}
