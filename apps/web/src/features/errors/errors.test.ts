import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { describeCopilotError } from '@/features/copilot/copilot-error';
import { applyApiFieldErrors } from '@/lib/form-errors';
import { NAV } from '@/lib/nav';
import { likelySections, searchSections } from './not-found-screen';

const items = NAV.flatMap((s) => s.items).filter(
  (i): i is typeof i & { to: NonNullable<typeof i.to> } => i.to !== undefined,
);

describe('404: pesquisa e sugestões', () => {
  it('encontra secções por nome (sem acentos) e por rota', () => {
    expect(searchSections('cenarios', items).map((i) => i.to)).toContain('/scenarios');
    expect(searchSections('MAPA', items).map((i) => i.to)).toContain('/map');
    expect(searchSections('   ', items)).toEqual([]);
    expect(searchSections('zzzz', items)).toEqual([]);
  });

  it('sugere a secção parecida com o endereço pedido', () => {
    expect(likelySections('/scenario', items).map((i) => i.to)).toContain('/scenarios');
    expect(likelySections('/simulation/x', items).map((i) => i.to)).toContain('/simulator');
    expect(likelySections('/', items)).toEqual([]);
    expect(likelySections('/zz', items)).toEqual([]);
  });
});

describe('erros do copiloto na conversa', () => {
  it('cada código tem texto próprio e diz se Gerar de novo serve', () => {
    expect(describeCopilotError('ai_budget_exceeded')).toMatchObject({ retry: false });
    expect(describeCopilotError('feature_disabled')).toMatchObject({ retry: false });
    expect(describeCopilotError('rate_limited')).toMatchObject({ retry: true });
    expect(describeCopilotError('upstream_error')).toMatchObject({ retry: true });
    expect(describeCopilotError('connection')).toMatchObject({ retry: true });
    expect(describeCopilotError('service_unavailable')).toMatchObject({ retry: true });
    expect(describeCopilotError('session_expired')).toMatchObject({ retry: false, login: true });
  });

  it('códigos diferentes dão títulos diferentes (nada de mensagem genérica única)', () => {
    const titles = new Set(
      ['ai_budget_exceeded', 'rate_limited', 'upstream_error', 'connection', 'internal_error'].map(
        (c) => describeCopilotError(c).title,
      ),
    );
    expect(titles.size).toBe(5);
  });
});

describe('erros de formulário', () => {
  const makeForm = () => {
    const setError = vi.fn();
    const form = {
      getValues: () => ({ name: '', email: '', password: '' }),
      setError,
    } as unknown as UseFormReturn<FieldValues>;
    return { form, setError };
  };

  it('põe o erro de validação da API em cada campo e foca só o primeiro', () => {
    const { form, setError } = makeForm();
    const handled = applyApiFieldErrors(form, {
      code: 'validation_error',
      message: 'x',
      fields: [
        { field: 'body.email', message: 'bad', type: 'value_error' },
        { field: 'password', message: 'short', type: 'string_too_short' },
        { field: 'body.desconhecido', message: '?', type: 'missing' },
      ],
    });
    expect(handled).toBe(true);
    expect(setError).toHaveBeenCalledTimes(2);
    expect(setError).toHaveBeenNthCalledWith(
      1,
      'email',
      { type: 'server', message: 'Valor inválido.' },
      { shouldFocus: true },
    );
    expect(setError).toHaveBeenNthCalledWith(
      2,
      'password',
      { type: 'server', message: 'Demasiado curto.' },
      { shouldFocus: false },
    );
  });

  it('um código que pertence a um campo vai para esse campo', () => {
    const { form, setError } = makeForm();
    const handled = applyApiFieldErrors(
      form,
      { code: 'email_taken', message: 'x' },
      { email_taken: 'email' },
    );
    expect(handled).toBe(true);
    expect(setError).toHaveBeenCalledWith(
      'email',
      { type: 'server', message: 'Já existe uma conta com este email.' },
      { shouldFocus: true },
    );
  });

  it('erros sem campo ficam para o aviso geral', () => {
    const { form, setError } = makeForm();
    expect(applyApiFieldErrors(form, { code: 'internal_error', message: 'x' })).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
