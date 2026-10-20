import type {
  DnsCheck,
  EmailDeliveryOut,
  EmailSummary,
  EmailWarning,
  InvitationOut,
} from '@/client';
import { m } from '@/paraglide/messages';

/**
 * Lógica pura dos emails (estados, erros, alertas, DNS): sem React, testada à parte.
 * Os textos vêm sempre do Paraglide; os códigos vêm da API (ver docs/engenharia/emails.md).
 */

/** Estado de um envio; `none` = nunca houve tentativa (só aparece em convites e contas). */
export type DeliveryStatus = InvitationOut['delivery_status'];
export type EmailTemplate = EmailDeliveryOut['template'];
export type EmailAlert = EmailSummary['alerts'][number];
export type Tracking = EmailSummary['delivery_tracking'];
export type DnsStatus = DnsCheck['status'];

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type DeliveryIcon =
  | 'clock'
  | 'send'
  | 'check'
  | 'hourglass'
  | 'undo'
  | 'spam'
  | 'x'
  | 'skip'
  | 'minus';

interface Meta {
  tone: Tone;
  icon: DeliveryIcon;
  label: () => string;
  /** O que o estado quer dizer, em linguagem simples (nunca promete mais do que sabemos). */
  hint: () => string;
}

export const DELIVERY_META: Record<DeliveryStatus, Meta> = {
  queued: {
    tone: 'neutral',
    icon: 'clock',
    label: () => m.email_status_queued(),
    hint: () => m.email_status_queued_hint(),
  },
  sent: {
    tone: 'info',
    icon: 'send',
    label: () => m.email_status_sent(),
    hint: () => m.email_status_sent_hint(),
  },
  delivered: {
    tone: 'success',
    icon: 'check',
    label: () => m.email_status_delivered(),
    hint: () => m.email_status_delivered_hint(),
  },
  delayed: {
    tone: 'warning',
    icon: 'hourglass',
    label: () => m.email_status_delayed(),
    hint: () => m.email_status_delayed_hint(),
  },
  bounced: {
    tone: 'danger',
    icon: 'undo',
    label: () => m.email_status_bounced(),
    hint: () => m.email_status_bounced_hint(),
  },
  complained: {
    tone: 'danger',
    icon: 'spam',
    label: () => m.email_status_complained(),
    hint: () => m.email_status_complained_hint(),
  },
  failed: {
    tone: 'danger',
    icon: 'x',
    label: () => m.email_status_failed(),
    hint: () => m.email_status_failed_hint(),
  },
  skipped: {
    tone: 'warning',
    icon: 'skip',
    label: () => m.email_status_skipped(),
    hint: () => m.email_status_skipped_hint(),
  },
  none: {
    tone: 'neutral',
    icon: 'minus',
    label: () => m.email_status_none(),
    hint: () => m.email_status_none_hint(),
  },
};

/** Ordem dos estados nos filtros (do início ao fim do caminho, depois os problemas). */
export const STATUS_ORDER: Exclude<DeliveryStatus, 'none'>[] = [
  'queued',
  'sent',
  'delivered',
  'delayed',
  'bounced',
  'complained',
  'failed',
  'skipped',
];

export const statusLabel = (status: DeliveryStatus): string => DELIVERY_META[status].label();

/** O email saiu do nosso lado (o Resend aceitou, ou está a caminho): não é preciso fazer nada. */
export const wentOut = (status: DeliveryStatus): boolean =>
  status === 'queued' || status === 'sent' || status === 'delivered' || status === 'delayed';

/** O email não chegou a sair, ou voltou: a pessoa pode estar à espera de algo que não vem. */
export const needsAction = (status: DeliveryStatus): boolean =>
  status === 'failed' ||
  status === 'bounced' ||
  status === 'complained' ||
  status === 'skipped' ||
  status === 'none';

/** Reenviar só faz sentido quando houve falha de envio; um endereço devolvido tem de ser corrigido primeiro. */
export const canRetryEmail = (status: DeliveryStatus): boolean =>
  status === 'failed' || status === 'skipped' || status === 'none';

// --- erros ----------------------------------------------------------------------------------------------

const ERRORS: Record<string, () => string> = {
  timeout: () => m.email_err_timeout(),
  network: () => m.email_err_network(),
  provider_down: () => m.email_err_provider_down(),
  provider_5xx: () => m.email_err_provider_down(),
  rate_limited: () => m.email_err_rate_limited(),
  quota_exceeded: () => m.email_err_quota_exceeded(),
  provider_auth: () => m.email_err_provider_auth(),
  domain_not_verified: () => m.email_err_domain_not_verified(),
  invalid_recipient: () => m.email_err_invalid_recipient(),
  provider_4xx: () => m.email_err_provider_4xx(),
  not_configured: () => m.email_err_not_configured(),
  circuit_open: () => m.email_err_circuit_open(),
  suppressed_bounced: () => m.email_err_suppressed_bounced(),
  suppressed_complained: () => m.email_err_suppressed_complained(),
  suppressed_manual: () => m.email_err_suppressed_manual(),
  bounced_permanent: () => m.email_err_bounced_permanent(),
  bounced_transient: () => m.email_err_bounced_transient(),
  complained: () => m.email_err_complained(),
  failed: () => m.email_err_failed(),
  unexpected: () => m.email_err_unexpected(),
  no_recipients: () => m.email_err_no_recipients(),
};

/** Causa e o que fazer, em português, para um código de erro da API. Código desconhecido: diz-se qual é. */
export function errorText(code: string | null | undefined): string {
  if (!code) return '';
  return (ERRORS[code] ?? (() => m.email_err_unknown({ code })))();
}

/** O código de erro é de uma supressão (o endereço não recebe emails até alguém o desbloquear). */
export const isSuppressionCode = (code: string | null | undefined): boolean =>
  typeof code === 'string' && code.startsWith('suppressed_');

// --- modelos --------------------------------------------------------------------------------------------

const TEMPLATES: Record<EmailTemplate, () => string> = {
  magic_link: () => m.email_tpl_magic_link(),
  invitation: () => m.email_tpl_invitation(),
  registration_received: () => m.email_tpl_registration_received(),
  approval_requested: () => m.email_tpl_approval_requested(),
  approval_granted: () => m.email_tpl_approval_granted(),
  approval_rejected: () => m.email_tpl_approval_rejected(),
  verify_email: () => m.email_tpl_verify_email(),
  guest_welcome: () => m.email_tpl_guest_welcome(),
  password_reset: () => m.email_tpl_password_reset(),
  account_unavailable: () => m.email_tpl_account_unavailable(),
  account_not_found: () => m.email_tpl_account_not_found(),
  pending_reminder: () => m.email_tpl_pending_reminder(),
  email_alert: () => m.email_tpl_email_alert(),
  test_email: () => m.email_tpl_test_email(),
};

export const TEMPLATE_ORDER = Object.keys(TEMPLATES) as EmailTemplate[];
export const templateLabel = (template: EmailTemplate | null | undefined): string =>
  template ? TEMPLATES[template]() : '';

// --- alertas --------------------------------------------------------------------------------------------

const ALERTS: Record<EmailAlert, { title: () => string; fix: () => string }> = {
  provider_not_configured: {
    title: () => m.email_alert_provider_not_configured(),
    fix: () => m.email_alert_provider_not_configured_fix(),
  },
  provider_auth_invalid: {
    title: () => m.email_alert_provider_auth_invalid(),
    fix: () => m.email_alert_provider_auth_invalid_fix(),
  },
  domain_not_verified: {
    title: () => m.email_alert_domain_not_verified(),
    fix: () => m.email_alert_domain_not_verified_fix(),
  },
  failures_last_hour: {
    title: () => m.email_alert_failures_last_hour(),
    fix: () => m.email_alert_failures_last_hour_fix(),
  },
  high_failure_rate: {
    title: () => m.email_alert_high_failure_rate(),
    fix: () => m.email_alert_high_failure_rate_fix(),
  },
  webhook_silent: {
    title: () => m.email_alert_webhook_silent(),
    fix: () => m.email_alert_webhook_silent_fix(),
  },
  no_admin_recipients: {
    title: () => m.email_alert_no_admin_recipients(),
    fix: () => m.email_alert_no_admin_recipients_fix(),
  },
};

export const alertCopy = (alert: EmailAlert): { title: string; fix: string } => ({
  title: ALERTS[alert].title(),
  fix: ALERTS[alert].fix(),
});

// --- o que sabemos de cada envio -----------------------------------------------------------------------

const TRACKING: Record<Tracking, { title: () => string; text: () => string; confirmed: boolean }> =
  {
    provider_accepted_only: {
      title: () => m.email_tracking_accepted_only(),
      text: () => m.email_tracking_accepted_only_text(),
      confirmed: false,
    },
    webhook: {
      title: () => m.email_tracking_webhook(),
      text: () => m.email_tracking_webhook_text(),
      confirmed: true,
    },
    api: {
      title: () => m.email_tracking_api(),
      text: () => m.email_tracking_api_text(),
      confirmed: true,
    },
    'api+webhook': {
      title: () => m.email_tracking_both(),
      text: () => m.email_tracking_both_text(),
      confirmed: true,
    },
  };

export const trackingCopy = (
  tracking: Tracking,
): { title: string; text: string; confirmed: boolean } => ({
  title: TRACKING[tracking].title(),
  text: TRACKING[tracking].text(),
  confirmed: TRACKING[tracking].confirmed,
});

/** Percentagem para mostrar (ou `null` sem envios). */
export const successRateText = (pct: number | null): string | null =>
  pct === null
    ? null
    : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(pct)} %`;

/** Atraso médio em linguagem simples: «2 s», «1 min 5 s». */
export function delayText(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${min} min` : `${min} min ${rest} s`;
}

// --- DNS ------------------------------------------------------------------------------------------------

const DNS_KEYS: Record<DnsCheck['key'], () => string> = {
  dkim: () => m.email_dns_dkim(),
  spf: () => m.email_dns_spf(),
  return_path: () => m.email_dns_return_path(),
  dmarc: () => m.email_dns_dmarc(),
};

export const dnsKeyLabel = (key: DnsCheck['key']): string => DNS_KEYS[key]();

export const dnsStatusLabel = (status: DnsStatus): string =>
  status === 'ok'
    ? m.email_dns_ok()
    : status === 'warn'
      ? m.email_dns_warn()
      : status === 'fail'
        ? m.email_dns_fail()
        : m.email_dns_unknown();

export const dnsTone = (status: DnsStatus): Tone =>
  status === 'ok'
    ? 'success'
    : status === 'warn'
      ? 'warning'
      : status === 'fail'
        ? 'danger'
        : 'neutral';

/** O que fazer, em português, a partir da chave e do código da API (a dica da API é em inglês). */
export function dnsHint(
  check: Pick<DnsCheck, 'key' | 'detail' | 'status'>,
  domain: string,
): string {
  const { key, detail } = check;
  if (detail === 'lookup_failed') return m.email_dns_hint_lookup_failed();
  if (check.status === 'ok') return m.email_dns_hint_ok();
  if (key === 'dkim') return m.email_dns_hint_dkim({ domain });
  if (key === 'spf') {
    return detail === 'no_provider'
      ? m.email_dns_hint_spf_no_provider({ domain })
      : m.email_dns_hint_spf_missing({ domain });
  }
  if (key === 'return_path') return m.email_dns_hint_return_path({ domain });
  return detail === 'policy_none'
    ? m.email_dns_hint_dmarc_none()
    : m.email_dns_hint_dmarc_missing({ domain });
}

// --- supressões -----------------------------------------------------------------------------------------

export const suppressionReason = (reason: 'bounced' | 'complained' | 'manual'): string =>
  reason === 'bounced'
    ? m.email_sup_bounced()
    : reason === 'complained'
      ? m.email_sup_complained()
      : m.email_sup_manual();

// --- avisos de ações do administrador ------------------------------------------------------------------

/** Texto do aviso quando aprovar/recusar/reenviar não conseguiu enviar o email à pessoa (a ação ficou feita). */
export function warningText(warning: EmailWarning): string {
  const reason = errorText(warning.error_code);
  const what = templateLabel(warning.template);
  return warning.code === 'email_skipped'
    ? m.email_warning_skipped({ what, reason })
    : m.email_warning_failed({ what, reason });
}

// --- convites -------------------------------------------------------------------------------------------

/** Pode copiar um link novo (o anterior deixa de valer): só convites ainda abertos. */
export const canCopyLink = (inv: Pick<InvitationOut, 'status'>): boolean =>
  inv.status === 'pending' || inv.status === 'expired';

/** Texto do tooltip da entrega: última tentativa e o erro, se o houve. Sem datas inventadas. */
export function deliveryTooltip(
  status: DeliveryStatus,
  lastEmailAt: string | null,
  error: string | null,
  formatDate: (value: string) => string,
): string {
  const parts: string[] = [DELIVERY_META[status].hint()];
  if (lastEmailAt) parts.push(m.email_last_attempt({ when: formatDate(lastEmailAt) }));
  if (error) parts.push(errorText(error));
  return parts.join(' ');
}

// --- contagens do resumo --------------------------------------------------------------------------------

type Counts = EmailSummary['last_24h'];

/** Emails que o Resend aceitou (a caminho ou já entregues): `sent` + `delivered` + `delayed`. */
export const acceptedCount = (c: Counts): number =>
  (c.sent ?? 0) + (c.delivered ?? 0) + (c.delayed ?? 0);

/** Emails que não chegaram: falhados, devolvidos e marcados como spam. */
export const failedCount = (c: Counts): number =>
  (c.failed ?? 0) + (c.bounced ?? 0) + (c.complained ?? 0);

/** Texto do aviso de que o teste evoluiu (ou não) para um estado final. */
export type TestOutcome = 'waiting' | 'ok' | 'sent' | 'bad';

/** O que dizer sobre o email de teste: entregue, aceite (sem como confirmar), ainda a evoluir ou falhado. */
export function testOutcome(status: DeliveryStatus, confirmed: boolean): TestOutcome {
  if (status === 'delivered') return 'ok';
  if (
    status === 'bounced' ||
    status === 'complained' ||
    status === 'failed' ||
    status === 'skipped'
  )
    return 'bad';
  if (status === 'sent' && !confirmed) return 'sent';
  return 'waiting';
}

/** Estados em que o email de teste já não vai mudar (deixa de se consultar). */
export const isFinalStatus = (status: DeliveryStatus, confirmed: boolean): boolean =>
  testOutcome(status, confirmed) !== 'waiting';
