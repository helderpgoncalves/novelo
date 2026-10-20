import { Section } from '@/components/page';
import { m } from '@/paraglide/messages';
import { EmailDnsPanel } from './email-dns';
import { EmailSummaryPanel } from './email-summary';
import { EmailSuppressions } from './email-suppressions';
import { EmailTable } from './email-table';

/**
 * Vista «Emails» (dentro da Auditoria): resumo e alertas, saúde do DNS, todos os envios e os endereços bloqueados.
 * O administrador sabe aqui se os emails saem, chegam ou falham, e o que fazer.
 */
export function EmailsPanel({ q, onQChange }: { q: string; onQChange: (q: string) => void }) {
  return (
    <div className="space-y-8" data-testid="emails-panel">
      <p className="max-w-3xl text-muted-foreground text-sm leading-relaxed">
        {m.email_panel_intro()}
      </p>
      <Section title={m.email_summary_title()}>
        <EmailSummaryPanel />
      </Section>
      <Section title={m.email_dns_title()}>
        <EmailDnsPanel />
      </Section>
      <Section title={m.email_table_title()}>
        <EmailTable q={q} onQChange={onQChange} />
      </Section>
      <Section title={m.email_sup_title()}>
        <EmailSuppressions />
      </Section>
    </div>
  );
}
