import { type ReactNode, useId } from 'react';
import { cn } from '@/lib/utils';

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; ariaLabel?: string }[];
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Ocupa a largura toda, com as opções do mesmo tamanho. */
  fill?: boolean;
}

/**
 * Escolha de uma opção entre poucas (vista, densidade, dia): rádios nativos com aspeto de segmentos.
 * As setas, o foco e o leitor de ecrã vêm do próprio browser.
 */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
  size = 'md',
  fill = false,
}: SegmentedProps<T>) {
  const name = useId();
  return (
    <fieldset
      className={cn(
        'min-w-0 rounded-lg bg-muted p-0.5',
        fill ? 'flex w-full' : 'inline-flex',
        className,
      )}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <label
            key={o.value}
            className={cn(
              'relative flex cursor-pointer items-center justify-center whitespace-nowrap rounded-md font-medium text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-1',
              fill ? 'min-w-0 flex-1 px-1' : 'px-3',
              size === 'lg' ? 'min-h-12 py-1' : size === 'md' ? 'h-8' : 'h-7',
              active
                ? 'bg-background text-foreground shadow-sm ring-1 ring-foreground/10'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={active}
              aria-label={o.ariaLabel}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        );
      })}
    </fieldset>
  );
}
