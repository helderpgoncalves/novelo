import type { AuditEntryOut } from '@/client';
import { formatDateTime, LOCALE_LABELS, type Locale } from '@/lib/i18n';
import type { Person } from '@/lib/person';
import { m } from '@/paraglide/messages';
import { originLabel } from './badges';
import { auditActor, auditDetailPairs, auditKey, auditOnBehalf, type Role } from './logic';
import { roleLabel } from './role-picker';

type Msg = () => string;

const ACTION_LABELS: Record<string, Msg> = {
  user_approve: () => m.audit_action_user_approve(),
  user_auto_approve: () => m.audit_action_user_auto_approve(),
  user_reject: () => m.audit_action_user_reject(),
  user_role_change: () => m.audit_action_user_role_change(),
  user_activate: () => m.audit_action_user_activate(),
  user_deactivate: () => m.audit_action_user_deactivate(),
  user_delete: () => m.audit_action_user_delete(),
  invitation_create: () => m.audit_action_invitation_create(),
  invitation_resend: () => m.audit_action_invitation_resend(),
  invitation_revoke: () => m.audit_action_invitation_revoke(),
  invitation_accept: () => m.audit_action_invitation_accept(),
  impersonation_start: () => m.audit_action_impersonation_start(),
  impersonation_stop: () => m.audit_action_impersonation_stop(),
  impersonation_write: () => m.audit_action_impersonation_write(),
  settings_update: () => m.audit_action_settings_update(),
};

/** Ações conhecidas, agrupadas como o filtro as mostra (o prefixo com ponto filtra o grupo todo). */
export const AUDIT_GROUPS: { prefix: string; label: Msg; all: Msg; actions: string[] }[] = [
  {
    prefix: 'user.',
    label: () => m.audit_group_user(),
    all: () => m.audit_prefix_user(),
    actions: [
      'user.approve',
      'user.auto_approve',
      'user.reject',
      'user.role_change',
      'user.activate',
      'user.deactivate',
      'user.delete',
    ],
  },
  {
    prefix: 'invitation.',
    label: () => m.audit_group_invitation(),
    all: () => m.audit_prefix_invitation(),
    actions: ['invitation.create', 'invitation.resend', 'invitation.revoke', 'invitation.accept'],
  },
  {
    prefix: 'impersonation.',
    label: () => m.audit_group_impersonation(),
    all: () => m.audit_prefix_impersonation(),
    actions: ['impersonation.start', 'impersonation.stop', 'impersonation.write'],
  },
  {
    prefix: 'settings.',
    label: () => m.audit_group_settings(),
    all: () => m.audit_prefix_settings(),
    actions: ['settings.update'],
  },
];

/** Nome legível da ação; uma ação nova da API aparece com o código até haver tradução. */
export const auditActionLabel = (action: string): string =>
  ACTION_LABELS[auditKey(action)]?.() ?? action;

const DETAIL_LABELS: Record<string, Msg> = {
  role: () => m.audit_detail_role(),
  from: () => m.audit_detail_from(),
  to: () => m.audit_detail_to(),
  reason: () => m.audit_detail_reason(),
  notified: () => m.audit_detail_notified(),
  has_reason: () => m.audit_detail_has_reason(),
  has_message: () => m.audit_detail_has_message(),
  locale: () => m.audit_detail_locale(),
  method: () => m.audit_detail_method(),
  path: () => m.audit_detail_path(),
  expires_at: () => m.audit_detail_expires_at(),
  target_role: () => m.audit_detail_target_role(),
  joined_via: () => m.audit_detail_joined_via(),
  was_active: () => m.audit_detail_was_active(),
  had_password: () => m.audit_detail_had_password(),
  google_linked: () => m.audit_detail_google_linked(),
  with_password: () => m.audit_detail_with_password(),
  approve_pending: () => m.audit_detail_approve_pending(),
  via: () => m.audit_detail_via(),
  note: () => m.audit_detail_note(),
};

const ROLES = new Set(['admin', 'operator', 'guest']);

function detailValue(key: string, value: string | number | boolean): string {
  if (typeof value === 'boolean') return value ? m.audit_yes() : m.audit_no();
  if (typeof value === 'number') return String(value);
  if (['role', 'from', 'to', 'target_role'].includes(key) && ROLES.has(value))
    return roleLabel(value as Role);
  if (key === 'via' && value === 'bulk') return m.audit_via_bulk();
  if (key === 'joined_via' || key === 'via')
    return originLabel(value as Parameters<typeof originLabel>[0]);
  if (key === 'locale' && value in LOCALE_LABELS) return LOCALE_LABELS[value as Locale];
  if (key === 'expires_at' && !Number.isNaN(Date.parse(value))) return formatDateTime(value);
  return value;
}

export interface DetailRow {
  label: string;
  value: string;
}

/** Pares "etiqueta: valor" legíveis; o contexto técnico (IP, dispositivo) vem à parte. */
export function auditDetailRows(entry: AuditEntryOut): DetailRow[] {
  const rows = auditDetailPairs(entry.details).map(([key, value]) => ({
    label: DETAIL_LABELS[key]?.() ?? key,
    value: detailValue(key, value),
  }));
  if (entry.ip) rows.push({ label: m.audit_detail_ip(), value: entry.ip });
  if (entry.user_agent) rows.push({ label: m.audit_detail_device(), value: entry.user_agent });
  return rows;
}

/** Resumo numa linha para a tabela: o que mais importa de cada ação. */
export function auditSummary(entry: AuditEntryOut): string {
  const d = entry.details;
  const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : null);
  if (entry.action === 'impersonation.start' && str('reason')) return str('reason') ?? '';
  if (entry.action === 'user.role_change' && str('from') && str('to')) {
    return `${detailValue('from', str('from') ?? '')} → ${detailValue('to', str('to') ?? '')}`;
  }
  if (entry.action === 'settings.update') {
    const change = d.open_registration as { from?: unknown; to?: unknown } | undefined;
    if (typeof change?.from === 'boolean' && typeof change.to === 'boolean') {
      const state = (on: boolean) => (on ? m.open_reg_on() : m.open_reg_off());
      return m.audit_summary_open_registration({ from: state(change.from), to: state(change.to) });
    }
  }
  if (entry.action === 'user.auto_approve' && str('role'))
    return detailValue('role', str('role') ?? '');
  if (entry.action === 'user.approve' && str('role')) return detailValue('role', str('role') ?? '');
  if (entry.action.startsWith('invitation.') && str('role'))
    return detailValue('role', str('role') ?? '');
  if (entry.action === 'impersonation.write' && str('method') && str('path')) {
    return `${str('method')} ${str('path')}`;
  }
  return '';
}

export interface ActorText {
  name: string;
  onBehalf: string | null;
}

export function auditActorText(entry: AuditEntryOut): ActorText {
  const behalf = auditOnBehalf(entry);
  return {
    name: auditActor(entry) ?? m.audit_actor_deleted(),
    onBehalf: behalf ? m.audit_on_behalf({ name: behalf }) : null,
  };
}

export const auditTargetText = (entry: AuditEntryOut): string =>
  entry.target_label ?? (entry.target_type ? m.audit_target_deleted() : m.audit_target_none());

const PERSON_TARGETS = new Set(['user', 'invitation', 'email']);

/** O alvo como pessoa (conta, convite ou destinatário de email), para o avatar; `null` se não for uma pessoa. */
export function auditTargetPerson(
  entry: Pick<AuditEntryOut, 'target_id' | 'target_type' | 'target_label'>,
  users: ReadonlyMap<string, Person>,
): Person | null {
  if (!entry.target_type || !PERSON_TARGETS.has(entry.target_type)) return null;
  const known = entry.target_id ? users.get(entry.target_id) : undefined;
  if (known) return known;
  const label = entry.target_label?.trim();
  if (!label) return null;
  return label.includes('@') ? { email: label } : { name: label };
}
