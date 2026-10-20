import { describe, expect, it } from 'vitest';
import {
  acceptedCount,
  alertCopy,
  canCopyLink,
  canRetryEmail,
  DELIVERY_META,
  delayText,
  deliveryTooltip,
  dnsHint,
  errorText,
  failedCount,
  isFinalStatus,
  isSuppressionCode,
  needsAction,
  STATUS_ORDER,
  statusLabel,
  TEMPLATE_ORDER,
  templateLabel,
  testOutcome,
  trackingCopy,
  warningText,
  wentOut,
} from './email-logic';

describe('estados de entrega', () => {
  it('cada estado tem texto, dica, ícone e tom (nunca só a cor)', () => {
    for (const [status, meta] of Object.entries(DELIVERY_META)) {
      expect(meta.label(), status).not.toBe('');
      expect(meta.hint(), status).not.toBe('');
      expect(meta.icon).toBeTruthy();
    }
  });

  it('os nomes seguem o pedido: Em fila, Enviado, Entregue, Atrasado, Devolvido, spam, Falhou, Ignorado, Sem envio', () => {
    expect(
      (
        [
          'queued',
          'sent',
          'delivered',
          'delayed',
          'bounced',
          'complained',
          'failed',
          'skipped',
          'none',
        ] as const
      ).map(statusLabel),
    ).toEqual([
      'Em fila',
      'Enviado',
      'Entregue',
      'Atrasado',
      'Devolvido',
      'Marcado como spam',
      'Falhou',
      'Ignorado',
      'Sem envio',
    ]);
  });

  it('separa o que saiu do que pede ação', () => {
    for (const s of ['queued', 'sent', 'delivered', 'delayed'] as const) {
      expect(wentOut(s)).toBe(true);
      expect(needsAction(s)).toBe(false);
    }
    for (const s of ['failed', 'bounced', 'complained', 'skipped', 'none'] as const) {
      expect(wentOut(s)).toBe(false);
      expect(needsAction(s)).toBe(true);
    }
  });

  it('só se reenvia quando o email não chegou a sair; um endereço devolvido não se reenvia às cegas', () => {
    expect(canRetryEmail('failed')).toBe(true);
    expect(canRetryEmail('none')).toBe(true);
    expect(canRetryEmail('skipped')).toBe(true);
    expect(canRetryEmail('bounced')).toBe(false);
    expect(canRetryEmail('complained')).toBe(false);
    expect(canRetryEmail('delivered')).toBe(false);
  });

  it('a ordem dos filtros cobre todos os estados menos «none»', () => {
    expect(STATUS_ORDER).toHaveLength(8);
    expect(STATUS_ORDER).not.toContain('none');
  });
});

describe('erros de envio', () => {
  const documented = [
    'timeout',
    'network',
    'provider_down',
    'rate_limited',
    'quota_exceeded',
    'provider_auth',
    'domain_not_verified',
    'invalid_recipient',
    'provider_4xx',
    'not_configured',
    'circuit_open',
    'suppressed_bounced',
    'suppressed_complained',
    'suppressed_manual',
    'bounced_permanent',
    'bounced_transient',
    'complained',
    'failed',
    'unexpected',
    'no_recipients',
  ];

  it('traduz todos os códigos documentados, sem mostrar o código cru', () => {
    for (const code of documented) {
      const text = errorText(code);
      expect(text, code).not.toBe('');
      expect(text, code).not.toContain(code);
    }
  });

  it('um código novo da API ainda diz qual é', () => {
    expect(errorText('algo_novo')).toContain('algo_novo');
  });

  it('sem código não há texto', () => {
    expect(errorText(null)).toBe('');
    expect(errorText(undefined)).toBe('');
  });

  it('reconhece os códigos de supressão', () => {
    expect(isSuppressionCode('suppressed_manual')).toBe(true);
    expect(isSuppressionCode('timeout')).toBe(false);
    expect(isSuppressionCode(null)).toBe(false);
  });
});

describe('modelos, alertas e rastreio', () => {
  it('todos os modelos têm nome', () => {
    expect(TEMPLATE_ORDER).toHaveLength(14);
    for (const t of TEMPLATE_ORDER) expect(templateLabel(t), t).not.toBe('');
    expect(templateLabel(null)).toBe('');
  });

  it('todos os alertas dizem o problema e como corrigir', () => {
    for (const a of [
      'provider_not_configured',
      'provider_auth_invalid',
      'domain_not_verified',
      'failures_last_hour',
      'high_failure_rate',
      'webhook_silent',
      'no_admin_recipients',
    ] as const) {
      const copy = alertCopy(a);
      expect(copy.title, a).not.toBe('');
      expect(copy.fix, a).not.toBe('');
    }
  });

  it('explica o que se sabe: sem webhook só sabemos que o Resend aceitou', () => {
    expect(trackingCopy('provider_accepted_only').confirmed).toBe(false);
    expect(trackingCopy('provider_accepted_only').title).toContain('aceitou');
    expect(trackingCopy('webhook').title).toContain('webhook');
    expect(trackingCopy('api').confirmed).toBe(true);
    expect(trackingCopy('api+webhook').confirmed).toBe(true);
  });
});

describe('contagens e atraso', () => {
  const c = {
    queued: 1,
    sent: 4,
    delivered: 10,
    delayed: 2,
    bounced: 1,
    complained: 1,
    failed: 3,
    skipped: 5,
    total: 27,
  };
  it('enviados = aceites pelo Resend; falhados = falhou + devolvido + spam', () => {
    expect(acceptedCount(c)).toBe(16);
    expect(failedCount(c)).toBe(5);
  });

  it('formata o atraso em linguagem simples', () => {
    expect(delayText(null)).toBeNull();
    expect(delayText(2.4)).toBe('2 s');
    expect(delayText(60)).toBe('1 min');
    expect(delayText(65)).toBe('1 min 5 s');
    expect(delayText(-1)).toBeNull();
  });
});

describe('DNS', () => {
  it('traduz a dica a partir da chave e do código, com o domínio', () => {
    expect(dnsHint({ key: 'dkim', detail: 'missing', status: 'fail' }, 'novelo.pt')).toContain(
      'resend._domainkey.novelo.pt',
    );
    expect(dnsHint({ key: 'spf', detail: 'no_provider', status: 'fail' }, 'novelo.pt')).toContain(
      'amazonses.com',
    );
    expect(dnsHint({ key: 'dmarc', detail: 'policy_none', status: 'warn' }, 'novelo.pt')).toContain(
      'p=none',
    );
    expect(dnsHint({ key: 'spf', detail: 'lookup_failed', status: 'unknown' }, 'x.pt')).toContain(
      'DNS',
    );
    expect(dnsHint({ key: 'dkim', detail: 'found', status: 'ok' }, 'x.pt')).toBe(
      'Registo encontrado.',
    );
  });
});

describe('convites e avisos', () => {
  it('copiar link só enquanto o convite está aberto', () => {
    expect(canCopyLink({ status: 'pending' })).toBe(true);
    expect(canCopyLink({ status: 'expired' })).toBe(true);
    expect(canCopyLink({ status: 'accepted' })).toBe(false);
    expect(canCopyLink({ status: 'revoked' })).toBe(false);
  });

  it('o tooltip junta o que o estado quer dizer, a data da tentativa e o erro traduzido', () => {
    const text = deliveryTooltip('failed', '2026-10-20T10:00:00Z', 'provider_auth', () => '20 out');
    expect(text).toContain('20 out');
    expect(text).toContain('chave');
    expect(deliveryTooltip('sent', null, null, () => 'x')).not.toContain('Última tentativa');
  });

  it('o aviso de uma ação diz o que não saiu e porquê', () => {
    const failed = warningText({
      code: 'email_failed',
      error_code: 'domain_not_verified',
      template: 'approval_granted',
    });
    expect(failed).toContain('Conta aprovada');
    expect(failed).toContain('domínio');
    const skipped = warningText({
      code: 'email_skipped',
      error_code: 'suppressed_bounced',
      template: 'approval_rejected',
    });
    expect(skipped).toContain('não foi enviado');
  });
});

describe('email de teste', () => {
  it('entregue = funciona; aceite sem como confirmar = verifica a caixa; falhas = má notícia', () => {
    expect(testOutcome('delivered', true)).toBe('ok');
    expect(testOutcome('sent', false)).toBe('sent');
    expect(testOutcome('sent', true)).toBe('waiting');
    expect(testOutcome('queued', true)).toBe('waiting');
    expect(testOutcome('delayed', true)).toBe('waiting');
    for (const s of ['failed', 'bounced', 'complained', 'skipped'] as const) {
      expect(testOutcome(s, true)).toBe('bad');
    }
  });

  it('deixa de consultar quando o estado já não muda', () => {
    expect(isFinalStatus('delivered', true)).toBe(true);
    expect(isFinalStatus('sent', false)).toBe(true);
    expect(isFinalStatus('sent', true)).toBe(false);
  });
});
