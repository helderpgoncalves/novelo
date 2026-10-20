import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { QUIET_MENU } from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type Theme, useTheme } from '@/lib/theme';
import { m } from '@/paraglide/messages';

const OPTIONS = [
  { value: 'light', Icon: Sun, label: () => m.common_theme_light() },
  { value: 'dark', Icon: Moon, label: () => m.common_theme_dark() },
  { value: 'system', Icon: Monitor, label: () => m.common_theme_system() },
] as const satisfies readonly { value: Theme; Icon: typeof Sun; label: () => string }[];

/**
 * Seletor de tema. `menu` (por omissão): um ícone fino (sol ou lua) que abre um menu; `inline`: os três ícones (claro, escuro,
 * automático) em linha, o ativo marcado por um traço de 2 px (para folhas e painéis onde um menu suspenso não cabe).
 */
export function ThemeToggle({ variant = 'menu' }: { variant?: 'menu' | 'inline' }) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  if (variant === 'inline') {
    return (
      <fieldset className="m-0 min-w-0 border-0 p-0 flex items-center gap-2">
        <legend className="sr-only">{m.theme_toggle()}</legend>
        {OPTIONS.map(({ value, Icon, label }) => (
          <button
            key={value}
            type="button"
            aria-label={label()}
            title={label()}
            aria-pressed={theme === value}
            onClick={() => setTheme(value)}
            className="relative inline-flex size-11 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors after:absolute after:bottom-1.5 after:h-0.5 after:w-5 after:scale-x-0 after:bg-foreground after:transition-transform after:content-[''] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 aria-pressed:text-foreground aria-pressed:after:scale-x-100"
          >
            <Icon className="size-[1.375rem]" strokeWidth={1.5} aria-hidden="true" />
          </button>
        ))}
      </fieldset>
    );
  }

  const Icon = resolvedTheme === 'dark' ? Moon : Sun;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-[8px] text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
          aria-label={m.theme_toggle()}
        >
          <Icon className="size-[1.125rem]" strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={QUIET_MENU}>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          {OPTIONS.map(({ value, Icon: ItemIcon, label }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <ItemIcon strokeWidth={1.5} /> {label()}
              {theme === value && (
                <Check
                  className="ml-auto size-4 text-foreground"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
