import { type ReactNode, useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export function CountDot({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-primary px-1.5 font-semibold text-[11px] text-primary-foreground tabular-nums">
      {n}
    </span>
  );
}

/** Caixa de seleção com o rótulo todo clicável (alvo de toque grande). */
export function CheckRow({
  checked,
  onChange,
  disabled,
  className,
  trailing,
  children,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  className?: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(on) => onChange(on === true)}
      />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer self-stretch py-1.5">
        {children}
      </label>
      {trailing}
    </div>
  );
}
