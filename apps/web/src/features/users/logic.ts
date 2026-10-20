import type { AuditEntryOut, InvitationOut, UserAdminOut } from '@/client';

/** Lógica pura da administração de contas: sem React, testada à parte. As regras finais vivem sempre na API. */

export type Role = UserAdminOut['role'];
export type Approval = UserAdminOut['approval_status'];

export const IMPERSONATION_REASON_MIN = 10;
export const IMPERSONATION_REASON_MAX = 300;
export const REJECT_REASON_MAX = 300;
export const INVITE_MESSAGE_MAX = 500;

/** Mesma normalização da API ao comparar emails: espaços colapsados e minúsculas. */
export const normalizeText = (value: string): string => value.trim().split(/\s+/).join(' ');
const normalizeEmail = (value: string): string => normalizeText(value).toLowerCase();

/** O email escrito coincide com o da conta (o botão destrutivo só ativa quando isto é verdade). */
export const emailMatches = (typed: string, email: string): boolean =>
  email.length > 0 && normalizeEmail(typed) === normalizeEmail(email);

/** O motivo conta depois de colapsar espaços (a API também o faz) e tem de chegar ao mínimo. */
export const reasonLength = (reason: string): number => normalizeText(reason).length;
export const isReasonValid = (reason: string): boolean =>
  reasonLength(reason) >= IMPERSONATION_REASON_MIN &&
  reasonLength(reason) <= IMPERSONATION_REASON_MAX;

/** Administradores ativos e aprovados: é com este número que se decide o "último administrador". */
export const activeAdmins = (users: UserAdminOut[]): UserAdminOut[] =>
  users.filter((u) => u.role === 'admin' && u.is_active && u.approval_status === 'approved');

export type Blocker = 'self' | 'last_admin' | 'admin' | 'inactive' | 'unapproved' | 'nested';

const isLastAdmin = (target: UserAdminOut, users: UserAdminOut[]): boolean => {
  const admins = activeAdmins(users);
  return target.role === 'admin' && admins.length === 1 && admins[0]?.id === target.id;
};

/** Porque não se pode eliminar a conta (ou `null` se pode). */
export function deleteBlocker(
  target: UserAdminOut,
  users: UserAdminOut[],
  selfId: string,
): Blocker | null {
  if (target.id === selfId) return 'self';
  if (isLastAdmin(target, users)) return 'last_admin';
  return null;
}

/** Porque não se pode mudar o perfil ou desativar a conta. */
export function updateBlocker(
  target: UserAdminOut,
  users: UserAdminOut[],
  selfId: string,
): Blocker | null {
  return deleteBlocker(target, users, selfId);
}

/** Porque não se pode ver como esta pessoa. */
export function impersonateBlocker(
  target: UserAdminOut,
  selfId: string,
  alreadyImpersonating: boolean,
): Blocker | null {
  if (alreadyImpersonating) return 'nested';
  if (target.id === selfId) return 'self';
  if (target.role === 'admin') return 'admin';
  if (!target.is_active) return 'inactive';
  if (target.approval_status !== 'approved') return 'unapproved';
  return null;
}

export const displayName = (user: { name: string | null; email: string }): string =>
  user.name ?? user.email;

/** Ordem em que os pedidos pendentes aparecem: os mais antigos primeiro (esperam há mais tempo). */
export const byOldestFirst = (a: UserAdminOut, b: UserAdminOut): number =>
  a.created_at.localeCompare(b.created_at);

// --- convites -------------------------------------------------------------------------------------------

export const needsAdminConfirm = (role: Role): boolean => role === 'admin';

/** Convites cujo último envio o fornecedor de email não aceitou (a lista avisa e oferece "Reenviar"). */
export const undelivered = (items: InvitationOut[]): InvitationOut[] =>
  items.filter((i) => i.status === 'pending' && !i.email_delivered);

export const canResend = (inv: InvitationOut): boolean =>
  inv.status === 'pending' || inv.status === 'expired';
export const canRevoke = (inv: InvitationOut): boolean =>
  inv.status === 'pending' || inv.status === 'expired';

// --- auditoria ------------------------------------------------------------------------------------------

/** Ação da API (`user.role_change`) para uma chave segura de mensagem (`user_role_change`). */
export const auditKey = (action: string): string =>
  action.replace(/[^a-z0-9]+/gi, '_').toLowerCase();

export const auditActionGroup = (action: string): string => action.split('.')[0] ?? action;

/** Nome mostrado para quem fez a ação: o email se não há nome; `null` se a conta já foi eliminada. */
export function auditActor(
  entry: Pick<AuditEntryOut, 'actor_name' | 'actor_email'>,
): string | null {
  return entry.actor_name ?? entry.actor_email;
}

/** Só em impersonação a pessoa efetiva difere da real. */
export function auditOnBehalf(
  entry: Pick<
    AuditEntryOut,
    'actor_id' | 'effective_actor_id' | 'effective_actor_name' | 'effective_actor_email'
  >,
): string | null {
  if (!entry.effective_actor_id || entry.effective_actor_id === entry.actor_id) return null;
  return entry.effective_actor_name ?? entry.effective_actor_email;
}

/** Valores simples de um `details` (a API nunca envia segredos; objetos e listas são ignorados por segurança). */
export function auditDetailPairs(
  details: Record<string, unknown>,
): [string, string | number | boolean][] {
  const out: [string, string | number | boolean][] = [];
  for (const [key, value] of Object.entries(details)) {
    if (key === 'session_id' || key.endsWith('_id')) continue; // identificadores técnicos não ajudam a ler
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out.push([key, value]);
    }
  }
  return out;
}

/** Filtros do servidor para a auditoria: só inclui o que está preenchido. */
export function auditQuery(filters: {
  action: string;
  actorId: string;
  targetId: string;
  from: string;
  to: string;
  limit: number;
}) {
  return {
    limit: filters.limit,
    action: filters.action || undefined,
    actor_id: filters.actorId || undefined,
    target_id: filters.targetId || undefined,
    date_from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : undefined,
    date_to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
  };
}
