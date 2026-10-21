import { m } from '@/paraglide/messages';

/** Aviso depois de mudar o registo aberto: o que mudou e, se for o caso, quantos pedidos foram aprovados ou ficaram. */
export function openRegistrationToast(r: {
  open_registration: boolean;
  approved_pending: number;
  skipped_previously_rejected: number;
}): { kind: 'success' | 'warning'; text: string } {
  if (!r.open_registration) return { kind: 'success', text: m.open_reg_toast_off() };
  const parts = [m.open_reg_toast_on()];
  if (r.approved_pending > 0) parts.push(m.open_reg_toast_approved({ count: r.approved_pending }));
  if (r.skipped_previously_rejected > 0)
    parts.push(m.open_reg_toast_skipped({ count: r.skipped_previously_rejected }));
  return { kind: r.skipped_previously_rejected > 0 ? 'warning' : 'success', text: parts.join(' ') };
}
