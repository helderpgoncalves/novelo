import { type KeyboardEvent, type ReactNode, useId, useState } from 'react';
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

/** Número como o campo o mostra: vírgula decimal pt-PT, sem separador de milhares, no máximo 4 casas. */
export function formatFieldNumber(value: number): string {
  return value.toLocaleString('pt-PT', { maximumFractionDigits: 4, useGrouping: false });
}

/** Lê o texto escrito: aceita vírgula ou ponto decimal e ignora espaços; vazio ou inválido dá `NaN`. */
export function parseFieldNumber(text: string): number {
  const raw = text.replace(/\s/g, '').replace(',', '.');
  if (raw === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(raw)) return Number.NaN;
  return Number(raw);
}

/**
 * Campo numérico com unidade, dica, etiqueta de origem e erro. Aceita vírgula ou ponto decimal e mostra sempre
 * vírgula (pt-PT): um `<input type="number">` mostraria «1.2353» conforme a língua do browser. As setas ↑/↓ somam ou
 * subtraem o passo, como num campo numérico nativo.
 */
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
  // Texto enquanto a pessoa escreve (ex.: «1,» ou «0,0»): só se reformata ao sair do campo.
  const [draft, setDraft] = useState<string | null>(null);
  // Mostra no máximo 4 casas decimais (ex.: 1,2353 kg em vez de 1,2352834279155773); o valor guardado só muda se for editado.
  const shown =
    value == null
      ? null
      : percent
        ? Math.round(value * 10000) / 100
        : Math.round(value * 10000) / 10000;
  const shownMin = percent && min != null ? min * 100 : min;
  const shownMax = percent && max != null ? max * 100 : max;
  const shownStep = percent ? 1 : step;
  const text = draft ?? (shown != null && Number.isFinite(shown) ? formatFieldNumber(shown) : '');

  const emit = (n: number) => onChange(percent ? n / 100 : n);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const current = parseFieldNumber(text);
    const origin = shownMin ?? 0;
    // Como o campo nativo: encaixa na grelha do passo (0,95 ↓ dá 0,9, ↑ dá 1) e arredonda às casas do passo para
    // não acumular erros de vírgula flutuante (0,1 + 0,2).
    const decimals = (String(shownStep).split('.')[1] ?? '').length;
    const steps = Number.isFinite(current) ? (current - origin) / shownStep : 0;
    const index = e.key === 'ArrowUp' ? Math.floor(steps + 1e-9) + 1 : Math.ceil(steps - 1e-9) - 1;
    let next = Number((origin + index * shownStep).toFixed(decimals));
    if (shownMin != null) next = Math.max(shownMin, next);
    if (shownMax != null) next = Math.min(shownMax, next);
    setDraft(null);
    emit(next);
  };

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
          type="text"
          role="spinbutton"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-valuenow={shown != null && Number.isFinite(shown) ? shown : undefined}
          aria-valuemin={shownMin}
          aria-valuemax={shownMax}
          value={text}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn('h-10 tabular-nums', (unit || percent) && 'pr-14')}
          onChange={(e) => {
            setDraft(e.target.value);
            emit(parseFieldNumber(e.target.value));
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={onKeyDown}
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
