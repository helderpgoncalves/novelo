import { Check, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSwitchLanguage } from '@/features/account/use-switch-language';
import { getLocale, LOCALE_LABELS, type Locale, locales } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

/** Menu discreto: hairline de 1 px, raio de 8 px, sem sombra; a opção ativa leva um ✓ à direita. */
export const QUIET_MENU =
  'w-44 rounded-[8px] border-border p-1 shadow-none [&_[data-slot=dropdown-menu-radio-item]]:min-h-10 [&_[data-slot=dropdown-menu-radio-item]]:rounded-[6px] [&_[data-slot=dropdown-menu-radio-item]]:pr-2 [&_[data-slot=dropdown-menu-radio-item]]:pl-2.5 [&_[data-slot=dropdown-menu-radio-item]]:focus:bg-foreground/5 [&_[data-slot=dropdown-menu-radio-item]>span:first-child]:hidden';

/**
 * Seletor de idioma. `menu` (por omissão): código curto («PT») que abre um menu; `inline`: as opções em texto, em linha,
 * a ativa em tinta com um traço de 2 px por baixo (para folhas e painéis onde um menu suspenso não cabe).
 */
export function LanguageSwitcher({
  signedIn = false,
  showLabel = false,
  variant = 'menu',
}: {
  signedIn?: boolean;
  showLabel?: boolean;
  variant?: 'menu' | 'inline';
}) {
  const switchLanguage = useSwitchLanguage(signedIn);
  const current = getLocale();

  if (variant === 'inline') {
    return (
      <fieldset className="m-0 min-w-0 border-0 p-0 flex items-center gap-6">
        <legend className="sr-only">{m.language_switch()}</legend>
        {locales.map((locale) => (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-pressed={current === locale}
            onClick={() => void switchLanguage(locale)}
            className="relative inline-flex min-h-11 items-center rounded-sm text-[1.0625rem] text-muted-foreground outline-none transition-colors after:absolute after:inset-x-0 after:bottom-1.5 after:h-0.5 after:scale-x-0 after:bg-foreground after:transition-transform after:content-[''] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:after:scale-x-100"
          >
            {LOCALE_LABELS[locale]}
          </button>
        ))}
      </fieldset>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={showLabel ? 'sm' : 'icon'}
          className={cn(
            'rounded-[8px] text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent',
            showLabel
              ? 'h-9 gap-2'
              : 'size-9 font-medium font-mono text-[0.8125rem] tracking-wider',
          )}
          aria-label={m.language_switch()}
        >
          {showLabel ? (
            <>
              <Languages className="size-4" strokeWidth={1.5} />
              <span className="text-sm">{LOCALE_LABELS[current]}</span>
            </>
          ) : (
            current.slice(0, 2).toUpperCase()
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={QUIET_MENU}>
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => void switchLanguage(value as Locale)}
        >
          {locales.map((locale) => (
            <DropdownMenuRadioItem key={locale} value={locale} lang={locale}>
              {LOCALE_LABELS[locale]}
              {current === locale && (
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
