import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CREDIT_MAX, creditProblem, type PhotoChoice } from '@/lib/lot-photos';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

interface PhotoConsentProps {
  choice: PhotoChoice;
  onChange: (choice: PhotoChoice) => void;
  /** `false` quando guardar já está decidido (ex.: «Acrescentar fotografia»): mostra só o consentimento e o crédito. */
  showToggle?: boolean;
  className?: string;
}

const BOX =
  'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 font-normal text-sm leading-snug';

/**
 * Opção «Guardar a fotografia da peça no lote». Desmarcada por omissão; ao marcar, o consentimento é obrigatório
 * e o crédito (para fotos de terceiros) fica recolhido. O mesmo bloco serve a triagem e o detalhe do lote.
 */
export function PhotoConsent({
  choice,
  onChange,
  showToggle = true,
  className,
}: PhotoConsentProps) {
  const id = useId();
  const [creditOpen, setCreditOpen] = useState(choice.credit !== '');
  const problem = creditProblem(choice.credit);
  const active = showToggle ? choice.save : true;

  return (
    <fieldset className={cn('space-y-3', className)}>
      {showToggle && (
        <>
          <Label
            htmlFor={`${id}-save`}
            className={cn(BOX, choice.save && 'border-primary bg-primary/5')}
          >
            <Checkbox
              id={`${id}-save`}
              className="mt-0.5"
              checked={choice.save}
              onCheckedChange={(v) => onChange({ ...choice, save: v === true, confirmed: false })}
            />
            <span className="font-medium">{m.lotphoto_save_label()}</span>
          </Label>
          <p className="text-muted-foreground text-xs leading-relaxed" id={`${id}-hint`}>
            {m.lotphoto_save_hint()}{' '}
            <a
              href="/privacy"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline underline-offset-2"
            >
              {m.lotphoto_privacy_link()}
            </a>
          </p>
        </>
      )}

      {active && (
        <div className="space-y-3">
          <Label htmlFor={`${id}-consent`} className={BOX}>
            <Checkbox
              id={`${id}-consent`}
              className="mt-0.5"
              checked={choice.confirmed}
              onCheckedChange={(v) => onChange({ ...choice, confirmed: v === true })}
              aria-required="true"
            />
            <span>{m.lotphoto_consent()}</span>
          </Label>

          <Collapsible open={creditOpen} onOpenChange={setCreditOpen}>
            <CollapsibleTrigger className="flex min-h-10 items-center gap-1.5 rounded-md font-medium text-muted-foreground text-sm underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
              <ChevronDown
                className={cn('size-4 transition-transform', creditOpen && 'rotate-180')}
                aria-hidden="true"
              />
              {m.lotphoto_credit_toggle()}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 pt-2">
              <Label htmlFor={`${id}-credit`}>{m.lotphoto_credit_label()}</Label>
              <Input
                id={`${id}-credit`}
                value={choice.credit}
                onChange={(e) => onChange({ ...choice, credit: e.target.value })}
                placeholder={m.lotphoto_credit_placeholder()}
                maxLength={CREDIT_MAX}
                className="h-11 text-base"
                aria-invalid={problem !== null}
                aria-describedby={`${id}-credit-hint`}
              />
              <p
                id={`${id}-credit-hint`}
                className={cn('text-xs', problem ? 'text-destructive' : 'text-muted-foreground')}
                role={problem ? 'alert' : undefined}
              >
                {problem === 'html'
                  ? m.lotphoto_credit_html()
                  : m.lotphoto_credit_hint({ max: CREDIT_MAX })}
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </fieldset>
  );
}
