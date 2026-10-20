import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

/** Caixa de confirmação com a área de toque toda no rótulo (≥ 44 px). */
export function ConfirmCheck({
  checked,
  onChange,
  children,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <Label
      htmlFor={id}
      className="min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal leading-snug"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <span className="min-w-0">
        <span className="block">{children}</span>
        {hint && <span className="mt-0.5 block text-muted-foreground text-xs">{hint}</span>}
      </span>
    </Label>
  );
}
