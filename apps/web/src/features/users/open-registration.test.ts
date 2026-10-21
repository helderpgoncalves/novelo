import { describe, expect, it } from 'vitest';
import type { AuditEntryOut } from '@/client';
import { auditActionLabel, auditDetailRows, auditSummary } from './audit-format';
import { openRegistrationToast } from './open-registration';

describe('registo aberto: aviso depois de mudar', () => {
  it('fechar diz só que fechou', () => {
    expect(
      openRegistrationToast({
        open_registration: false,
        approved_pending: 0,
        skipped_previously_rejected: 0,
      }),
    ).toEqual({
      kind: 'success',
      text: 'Registo fechado: as contas novas voltam a esperar aprovação.',
    });
  });

  it('abrir com pedidos aprovados conta-os', () => {
    const t = openRegistrationToast({
      open_registration: true,
      approved_pending: 3,
      skipped_previously_rejected: 0,
    });
    expect(t.kind).toBe('success');
    expect(t.text).toContain('Registo aberto');
    expect(t.text).toContain('3 pedidos pendentes aprovados');
  });

  it('os que ficaram à espera (email rejeitado antes) dão um aviso', () => {
    const t = openRegistrationToast({
      open_registration: true,
      approved_pending: 1,
      skipped_previously_rejected: 2,
    });
    expect(t.kind).toBe('warning');
    expect(t.text).toContain('2 ficaram à espera');
  });
});

const entry = (action: string, details: Record<string, unknown>): AuditEntryOut =>
  ({
    id: '1',
    action,
    details,
    created_at: '2026-10-21T10:00:00Z',
    actor_id: null,
    target_type: null,
    target_id: null,
    target_label: null,
    ip: null,
    user_agent: null,
  }) as unknown as AuditEntryOut;

describe('registo aberto: auditoria', () => {
  it('a alteração da definição lê-se de/para', () => {
    const e = entry('settings.update', {
      open_registration: { from: false, to: true },
      approve_pending: true,
    });
    expect(auditActionLabel(e.action)).toBe('Definições alteradas');
    expect(auditSummary(e)).toBe('Registo aberto: Desligado → Ligado');
    expect(auditDetailRows(e)).toContainEqual({ label: 'Aprovar pendentes', value: 'Sim' });
  });

  it('a aprovação automática tem nome e diz por onde entrou', () => {
    const e = entry('user.auto_approve', {
      reason: 'open_registration',
      via: 'bulk',
      role: 'operator',
    });
    expect(auditActionLabel(e.action)).toBe('Aprovada pelo registo aberto');
    expect(auditDetailRows(e)).toContainEqual({
      label: 'Entrada',
      value: 'Pedidos pendentes, ao abrir o registo',
    });
  });
});
