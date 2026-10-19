import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export function SearchBox({ value, onChange, label }: SearchBoxProps) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        className="h-10 pl-9"
      />
    </div>
  );
}

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

export const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
