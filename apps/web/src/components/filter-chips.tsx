import { cn } from '@/lib/utils';

interface FilterChipsProps<T extends string> {
  legend: string;
  value: T | null;
  options: { value: T | null; label: string }[];
  onChange: (value: T | null) => void;
}

/** Filtro por etiquetas (um valor de cada vez), acessível por teclado e leitor de ecrã. */
export function FilterChips<T extends string>({
  legend,
  value,
  options,
  onChange,
}: FilterChipsProps<T>) {
  return (
    <fieldset className="flex flex-wrap gap-1.5">
      <legend className="sr-only">{legend}</legend>
      {options.map((o) => (
        <button
          key={o.value ?? 'all'}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'h-8 rounded-full border px-3 text-xs transition-colors',
            value === o.value
              ? 'border-primary bg-primary/10 font-medium text-primary'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}
