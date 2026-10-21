import { type ReactNode, useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface NumberFieldProps {
  label: string;
  /** `null` mostra o campo vazio (com o `placeholder`, ex.: «por preencher»). */
  value: number | null;
  onChange: (value: number) => void;
  /** Mostra e edita em percentagem (0 a 100); o valor guardado continua a ser a fração (0 a 1). */
  percent?: boolean;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: ReactNode;
  badge?: ReactNode;
  error?: string;
  placeholder?: string;
  className?: string;
}

/** Campo numérico com unidade, dica, etiqueta de origem e erro. Aceita vírgula ou ponto decimal. */
export function NumberField({
  label,
  value,
  onChange,
  percent,
  unit,
  step = 1,
  min,
  max,
  hint,
  badge,
  error,
  placeholder,
  className,
}: NumberFieldProps) {
  const id = useId();
  // Mostra no máximo 4 casas decimais (ex.: 1,2353 kg em vez de 1,2352834279155773); o valor guardado só muda se for editado.
  const shown =
    value == null
      ? null
      : percent
        ? Math.round(value * 10000) / 100
        : Math.round(value * 10000) / 10000;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {badge}
      </div>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={percent ? 1 : step}
          min={percent && min != null ? min * 100 : min}
          max={percent && max != null ? max * 100 : max}
          value={shown != null && Number.isFinite(shown) ? shown : ''}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn('h-10 tabular-nums', (unit || percent) && 'pr-14')}
          onChange={(e) => {
            const raw = e.target.value.replace(',', '.');
            const parsed = raw === '' ? Number.NaN : Number(raw);
            onChange(percent ? parsed / 100 : parsed);
          }}
        />
        {(unit || percent) && (
          <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 text-muted-foreground text-xs">
            {percent ? '%' : unit}
          </span>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-muted-foreground text-xs">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
