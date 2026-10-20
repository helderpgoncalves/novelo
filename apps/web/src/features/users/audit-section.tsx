import type { UserAdminOut } from '@/client';
import { m } from '@/paraglide/messages';
import { AuditPanel } from './audit-panel';
import { EmailsPanel } from './emails-panel';

export type AuditView = 'actions' | 'emails';

const VIEWS: { id: AuditView; label: () => string }[] = [
  { id: 'actions', label: () => m.users_audit_view_actions() },
  { id: 'emails', label: () => m.users_audit_view_emails() },
];

interface Props {
  users: UserAdminOut[];
  view: AuditView;
  onViewChange: (view: AuditView) => void;
  /** Pesquisa por email na vista de emails (vive na URL). */
  q: string;
  onQChange: (q: string) => void;
  /** Nº de alertas de email ativos (`MeOut.email_alerts`): marca a vista «Emails». */
  alerts: number;
}

/** Separador «Auditoria»: o registo de ações e, ao lado, a vista «Emails» (estado de envio e diagnóstico). */
export function AuditSection({ users, view, onViewChange, q, onQChange, alerts }: Props) {
  return (
    <div className="space-y-4">
      <fieldset aria-label={m.users_audit_views_label()} className="flex gap-2">
        {VIEWS.map((v) => {
          const active = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              aria-pressed={active}
              onClick={() => onViewChange(v.id)}
              className={
                active
                  ? 'inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 font-medium text-primary-foreground text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-9'
                  : 'inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 font-medium text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-9'
              }
            >
              {v.label()}
              {v.id === 'emails' && alerts > 0 && (
                <span
                  className="rounded-full bg-destructive px-1.5 font-semibold text-[10px] text-white tabular-nums"
                  data-testid="emails-alert-count"
                >
                  {alerts}
                  <span className="sr-only"> {m.users_tab_audit_alerts({ count: alerts })}</span>
                </span>
              )}
            </button>
          );
        })}
      </fieldset>
      {view === 'emails' ? (
        <EmailsPanel q={q} onQChange={onQChange} />
      ) : (
        <AuditPanel users={users} />
      )}
    </div>
  );
}
