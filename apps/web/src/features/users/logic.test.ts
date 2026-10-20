import { describe, expect, it } from 'vitest';
import type { AuditEntryOut, InvitationOut, UserAdminOut } from '@/client';
import {
  activeAdmins,
  auditActionGroup,
  auditActor,
  auditDetailPairs,
  auditKey,
  auditOnBehalf,
  auditQuery,
  byOldestFirst,
  canResend,
  canRevoke,
  deleteBlocker,
  emailMatches,
  impersonateBlocker,
  isReasonValid,
  needsAdminConfirm,
  normalizeText,
  reasonLength,
  undelivered,
  updateBlocker,
} from './logic';

const user = (over: Partial<UserAdminOut> = {}): UserAdminOut => ({
  id: 'u1',
  email: 'ana@example.pt',
  name: 'Ana',
  role: 'operator',
  is_active: true,
  approval_status: 'approved',
  approved_at: null,
  rejected_reason: null,
  email_verified: true,
  google_linked: false,
  joined_via: 'password',
  created_at: '2026-10-20T10:00:00Z',
  last_login_at: null,
  ...over,
});

describe('emailMatches', () => {
  it('compara sem maiúsculas nem espaços a mais (como a API)', () => {
    expect(emailMatches('  ANA@Example.PT ', 'ana@example.pt')).toBe(true);
    expect(emailMatches('ana@example.pt', 'ana@example.pt')).toBe(true);
  });
  it('recusa emails diferentes ou vazios', () => {
    expect(emailMatches('ana@example.p', 'ana@example.pt')).toBe(false);
    expect(emailMatches('', '')).toBe(false);
    expect(emailMatches('ana @example.pt', 'ana@example.pt')).toBe(false);
  });
});

describe('motivo da impersonação', () => {
  it('conta caracteres depois de colapsar espaços', () => {
    expect(normalizeText('  olá   mundo  ')).toBe('olá mundo');
    expect(reasonLength('a          b')).toBe(3);
  });
  it('exige pelo menos 10 caracteres reais e no máximo 300', () => {
    expect(isReasonValid('curto')).toBe(false);
    expect(isReasonValid('1234567890')).toBe(true);
    expect(isReasonValid('         123456789         ')).toBe(false);
    expect(isReasonValid('x'.repeat(301))).toBe(false);
  });
});

describe('bloqueios', () => {
  const admin = user({ id: 'a1', role: 'admin', email: 'admin@example.pt' });
  const other = user({ id: 'a2', role: 'admin', email: 'outro@example.pt' });

  it('não deixa mexer na própria conta', () => {
    expect(deleteBlocker(user({ id: 'me' }), [user({ id: 'me' })], 'me')).toBe('self');
    expect(updateBlocker(admin, [admin, other], 'a1')).toBe('self');
  });

  it('o último administrador ativo não se elimina nem se despromove', () => {
    expect(deleteBlocker(admin, [admin, user()], 'x')).toBe('last_admin');
    expect(updateBlocker(admin, [admin, user()], 'x')).toBe('last_admin');
  });

  it('com outro administrador ativo já se pode', () => {
    expect(deleteBlocker(admin, [admin, other], 'x')).toBeNull();
  });

  it('um administrador desativado ou por aprovar não conta como "outro"', () => {
    const inactive = user({ id: 'a3', role: 'admin', is_active: false });
    const pending = user({ id: 'a4', role: 'admin', approval_status: 'pending' });
    expect(activeAdmins([admin, inactive, pending])).toEqual([admin]);
    expect(deleteBlocker(admin, [admin, inactive, pending], 'x')).toBe('last_admin');
  });

  it('impersonar: só contas ativas, aprovadas, não admin, nunca a própria nem aninhada', () => {
    expect(impersonateBlocker(user(), 'me', false)).toBeNull();
    expect(impersonateBlocker(user(), 'me', true)).toBe('nested');
    expect(impersonateBlocker(user({ id: 'me' }), 'me', false)).toBe('self');
    expect(impersonateBlocker(admin, 'me', false)).toBe('admin');
    expect(impersonateBlocker(user({ is_active: false }), 'me', false)).toBe('inactive');
    expect(impersonateBlocker(user({ approval_status: 'pending' }), 'me', false)).toBe(
      'unapproved',
    );
  });
});

describe('pedidos pendentes', () => {
  it('os mais antigos primeiro', () => {
    const a = user({ id: 'a', created_at: '2026-10-20T09:00:00Z' });
    const b = user({ id: 'b', created_at: '2026-10-19T09:00:00Z' });
    expect([a, b].sort(byOldestFirst).map((u) => u.id)).toEqual(['b', 'a']);
  });
  it('promover a administrador exige confirmação', () => {
    expect(needsAdminConfirm('admin')).toBe(true);
    expect(needsAdminConfirm('operator')).toBe(false);
    expect(needsAdminConfirm('guest')).toBe(false);
  });
});

describe('convites', () => {
  const inv = (over: Partial<InvitationOut>): InvitationOut => ({
    id: 'i',
    email: 'x@example.pt',
    name: null,
    role: 'operator',
    locale: 'pt-PT',
    message: null,
    status: 'pending',
    invited_by_id: null,
    invited_by_name: null,
    created_at: '2026-10-20T10:00:00Z',
    expires_at: '2026-10-27T10:00:00Z',
    accepted_at: null,
    revoked_at: null,
    last_sent_at: null,
    send_count: 1,
    email_delivered: true,
    delivery_status: 'sent',
    last_email_at: null,
    delivery_error: null,
    ...over,
  });

  it('só os pendentes com o email por entregar pedem atenção', () => {
    const items = [
      inv({ id: '1', email_delivered: false }),
      inv({ id: '2', email_delivered: false, status: 'revoked' }),
      inv({ id: '3' }),
    ];
    expect(undelivered(items).map((i) => i.id)).toEqual(['1']);
  });

  it('reenviar e revogar só fazem sentido enquanto o convite está por aceitar', () => {
    expect(canResend(inv({}))).toBe(true);
    expect(canResend(inv({ status: 'expired' }))).toBe(true);
    expect(canResend(inv({ status: 'accepted' }))).toBe(false);
    expect(canResend(inv({ status: 'revoked' }))).toBe(false);
    expect(canRevoke(inv({ status: 'pending' }))).toBe(true);
    expect(canRevoke(inv({ status: 'accepted' }))).toBe(false);
  });
});

describe('auditoria', () => {
  const entry = (over: Partial<AuditEntryOut>): AuditEntryOut => ({
    id: 'e',
    action: 'user.delete',
    actor_id: 'a',
    actor_name: 'Admin',
    actor_email: 'admin@example.pt',
    effective_actor_id: 'a',
    effective_actor_name: 'Admin',
    effective_actor_email: 'admin@example.pt',
    target_id: null,
    target_label: null,
    target_type: null,
    details: {},
    ip: null,
    user_agent: null,
    created_at: '2026-10-20T10:00:00Z',
    ...over,
  });

  it('transforma a ação numa chave de mensagem e num grupo', () => {
    expect(auditKey('user.role_change')).toBe('user_role_change');
    expect(auditKey('Impersonation.Start')).toBe('impersonation_start');
    expect(auditActionGroup('invitation.create')).toBe('invitation');
  });

  it('quem agiu: nome, senão email, senão nada (conta eliminada)', () => {
    expect(auditActor(entry({}))).toBe('Admin');
    expect(auditActor(entry({ actor_name: null }))).toBe('admin@example.pt');
    expect(auditActor(entry({ actor_name: null, actor_email: null }))).toBeNull();
  });

  it('em nome de outra pessoa só quando a efetiva difere da real', () => {
    expect(auditOnBehalf(entry({}))).toBeNull();
    expect(auditOnBehalf(entry({ effective_actor_id: 'b', effective_actor_name: 'Vera' }))).toBe(
      'Vera',
    );
    expect(auditOnBehalf(entry({ effective_actor_id: null }))).toBeNull();
  });

  it('detalhes: só valores simples e legíveis, sem identificadores técnicos nem objetos', () => {
    expect(
      auditDetailPairs({
        role: 'admin',
        notified: true,
        count: 2,
        session_id: 'abc',
        invited_by_id: 'x',
        nested: { a: 1 },
        list: [1, 2],
        nothing: null,
      }),
    ).toEqual([
      ['role', 'admin'],
      ['notified', true],
      ['count', 2],
    ]);
  });

  it('filtros do servidor: omite o que está vazio e converte as datas para o dia inteiro', () => {
    const q = auditQuery({
      action: 'user.',
      actorId: '',
      targetId: '',
      from: '2026-10-01',
      to: '2026-10-02',
      limit: 50,
    });
    expect(q.action).toBe('user.');
    expect(q.actor_id).toBeUndefined();
    expect(q.target_id).toBeUndefined();
    expect(new Date(q.date_from ?? '').getTime()).toBe(new Date('2026-10-01T00:00:00').getTime());
    expect(new Date(q.date_to ?? '').getTime()).toBe(new Date('2026-10-02T23:59:59.999').getTime());
    expect(
      auditQuery({ action: '', actorId: '', targetId: '', from: '', to: '', limit: 10 }),
    ).toEqual({
      limit: 10,
      action: undefined,
      actor_id: undefined,
      target_id: undefined,
      date_from: undefined,
      date_to: undefined,
    });
  });
});
