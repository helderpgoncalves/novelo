import { AlertTriangle, ArrowRight, Lightbulb, Wand2 } from 'lucide-react';
import type { AlertSuggestionOut } from '@/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPercent } from '@/lib/format';
import { alertStatusLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

const actionLabel: Record<AlertSuggestionOut['action'], () => string> = {
  confirm_with_vitrus: () => m.quality_suggest_action_confirm_with_vitrus(),
  correct_data: () => m.quality_suggest_action_correct_data(),
  accept_as_is: () => m.quality_suggest_action_accept_as_is(),
  ignore: () => m.quality_suggest_action_ignore(),
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
        {label}
      </dt>
      <dd className="text-sm leading-relaxed">{children}</dd>
    </div>
  );
}

interface Props {
  suggestion: AlertSuggestionOut;
  applying: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

/** Proposta da IA (ou da regra automática) para um alerta. Nada é aplicado sem o botão Aplicar. */
export function SuggestionCard({ suggestion: s, applying, onApply, onDismiss }: Props) {
  const ai = s.source === 'model';
  return (
    <section
      className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4"
      aria-label={ai ? m.quality_suggest_badge_ai() : m.quality_suggest_badge_rule()}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1.5">
          {ai ? (
            <Lightbulb className="size-3" aria-hidden="true" />
          ) : (
            <Wand2 className="size-3" aria-hidden="true" />
          )}
          {ai ? m.quality_suggest_badge_ai() : m.quality_suggest_badge_rule()}
        </Badge>
        {!s.verified && (
          <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
            <AlertTriangle className="size-3" aria-hidden="true" />
            {m.quality_suggest_unverified()}
          </Badge>
        )}
        <span className="ml-auto text-muted-foreground text-xs tabular-nums">
          {m.quality_suggest_confidence()}: {formatPercent(s.confidence * 100, 0)}
        </span>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Row label={m.quality_suggest_action()}>
          <span className="font-medium">{actionLabel[s.action]()}</span>
          <span className="text-muted-foreground">
            {' · '}
            {m.quality_suggest_status()}: {alertStatusLabel[s.suggested_status]()}
          </span>
        </Row>
        <Row label={m.quality_suggest_justification()}>
          <span lang="pt-PT">{s.justification}</span>
        </Row>
        {s.question_for_vitrus && (
          <Row label={m.quality_suggest_question()}>
            <span lang="pt-PT">{s.question_for_vitrus}</span>
          </Row>
        )}
        <Row label={m.quality_suggest_note()}>
          <span lang="pt-PT">{s.resolution_note}</span>
        </Row>
      </dl>
      {s.fields_to_fix && s.fields_to_fix.length > 0 && (
        <div className="space-y-2">
          <p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
            {m.quality_suggest_fields()}
          </p>
          <ul className="grid gap-2 md:grid-cols-2">
            {s.fields_to_fix.map((f) => (
              <li
                key={`${f.field}-${f.current_value}-${f.proposed_value}`}
                className="space-y-1 rounded-lg bg-card p-3 text-sm"
              >
                <p className="font-medium">{f.field}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
                  <span title={m.quality_suggest_field_current()}>
                    {f.current_value ?? m.common_dash()}
                  </span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                  <span
                    className="font-medium text-foreground"
                    title={m.quality_suggest_field_proposed()}
                  >
                    {f.proposed_value ?? m.common_dash()}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button className="h-10" onClick={onApply} disabled={applying}>
          {m.quality_suggest_apply()}
        </Button>
        <Button variant="outline" className="h-10" onClick={onDismiss} disabled={applying}>
          {m.quality_suggest_dismiss()}
        </Button>
      </div>
    </section>
  );
}
