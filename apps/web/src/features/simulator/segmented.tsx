import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}

/** Controlo segmentado (rádio por baixo): setas mudam a opção, Tab sai do grupo. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: SegmentedProps<T>) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(v) => onChange(v as T)}
      aria-label={label}
      className="grid grid-flow-col auto-cols-fr gap-1 rounded-lg bg-muted p-1"
    >
      {options.map((o) => (
        <RadioGroupPrimitive.Item
          key={o.value}
          value={o.value}
          className={cn(
            'min-h-10 rounded-md px-2 text-center font-medium text-muted-foreground text-sm leading-tight transition-colors',
            'hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1',
            'data-[state=checked]:bg-card data-[state=checked]:text-foreground data-[state=checked]:shadow-sm data-[state=checked]:ring-1 data-[state=checked]:ring-foreground/10',
          )}
        >
          {o.label}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
