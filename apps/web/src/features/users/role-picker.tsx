import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import type { Role } from './logic';

export const roleLabel = (role: Role): string =>
  role === 'admin'
    ? m.account_role_admin()
    : role === 'guest'
      ? m.account_role_guest()
      : m.account_role_operator();

const roleHelp = (role: Role): string =>
  role === 'admin'
    ? m.users_role_desc_admin()
    : role === 'guest'
      ? m.users_role_desc_guest()
      : m.users_role_desc_operator();

const ROLES: Role[] = ['operator', 'admin', 'guest'];

/** Escolha de perfil com a explicação de cada um; alvos de toque de 48 px. */
export function RolePicker({
  value,
  onChange,
  legend,
  roles = ROLES,
  disabled,
}: {
  value: Role;
  onChange: (role: Role) => void;
  legend: string;
  roles?: Role[];
  disabled?: boolean;
}) {
  const uid = useId();
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="font-medium text-sm">{legend}</legend>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as Role)} className="gap-2">
        {roles.map((role) => {
          const id = `${uid}-${role}`;
          return (
            <Label
              key={role}
              htmlFor={id}
              className={cn(
                'min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal leading-snug transition-colors',
                value === role ? 'border-primary bg-primary/5' : 'hover:bg-accent/50',
              )}
            >
              <RadioGroupItem id={id} value={role} className="mt-0.5" />
              <span className="min-w-0 space-y-0.5">
                <span className="block font-medium">{roleLabel(role)}</span>
                <span className="block text-muted-foreground text-xs">{roleHelp(role)}</span>
              </span>
            </Label>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}
