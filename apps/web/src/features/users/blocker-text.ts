import { m } from '@/paraglide/messages';
import type { Blocker } from './logic';

/** Texto de "porque não" para cada bloqueio: aparece em diálogos e em tooltips. */
export const blockerText = (blocker: Blocker): string => {
  switch (blocker) {
    case 'self':
      return m.users_blocked_self();
    case 'last_admin':
      return m.users_blocked_last_admin();
    case 'admin':
      return m.users_blocked_admin_impersonate();
    case 'inactive':
      return m.users_blocked_inactive();
    case 'unapproved':
      return m.users_blocked_unapproved();
    case 'nested':
      return m.users_blocked_nested();
  }
};
