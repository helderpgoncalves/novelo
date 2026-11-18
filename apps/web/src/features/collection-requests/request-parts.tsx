import type { CollectionRequestState, RequestExceptionReason, RequestSubject } from '@/client';
import { Badge } from '@/components/ui/badge';
import { m } from '@/paraglide/messages';

// Só pt-PT no MVP (decisão da spec #54): os rótulos vivem nas mensagens, os valores vêm da API.

export const REQUEST_STATES: CollectionRequestState[] = [
  'scheduled',
  'exception',
  'rejected',
  'collected',
  'expired',
  'cancelled',
];

export const requestStateLabel = (state: CollectionRequestState): string => {
  switch (state) {
    case 'scheduled':
      return m.collection_requests_state_scheduled();
    case 'exception':
      return m.collection_requests_state_exception();
    case 'rejected':
      return m.collection_requests_state_rejected();
    case 'collected':
      return m.collection_requests_state_collected();
    case 'expired':
      return m.collection_requests_state_expired();
    case 'cancelled':
      return m.collection_requests_state_cancelled();
  }
};

export function RequestStateBadge({ state }: { state: CollectionRequestState }) {
  const variant = (() => {
    switch (state) {
      case 'scheduled':
        return 'default' as const;
      case 'exception':
        return 'destructive' as const;
      case 'collected':
        return 'outline' as const;
      default:
        return 'secondary' as const;
    }
  })();
  return <Badge variant={variant}>{requestStateLabel(state)}</Badge>;
}

export const requestSubjectLabel = (subject: RequestSubject): string =>
  subject === 'local'
    ? m.collection_requests_subject_local()
    : m.collection_requests_subject_citizen();

export const exceptionReasonLabel = (reason: RequestExceptionReason): string => {
  switch (reason) {
    case 'out_of_round':
      return m.collection_requests_reason_out_of_round();
    case 'cutoff':
      return m.collection_requests_reason_cutoff();
    case 'special_volume':
      return m.collection_requests_reason_special_volume();
    case 'urgency':
      return m.collection_requests_reason_urgency();
  }
};

/** Onde vai parar: morada escrita do cidadão (com a freguesia) ou o local institucional. */
export const requestPlaceLabel = (row: {
  subject_kind: RequestSubject;
  address?: string | null;
  parish_name?: string | null;
  locality_name?: string | null;
}): string => {
  if (row.subject_kind === 'local') return row.locality_name ?? '—';
  const place = row.address ?? '—';
  return row.parish_name ? `${place} · ${row.parish_name}` : place;
};
