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
 * Seletor de idioma. `menu` (por omissão): código curto («PT») que abre um menu; `inline`: os códigos («PT · EN») como segmentos de
 * texto, o ativo em tinta com um traço de 2 px por baixo (para folhas e painéis onde um menu suspenso não cabe).
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
      <fieldset className="m-0 flex min-w-0 items-center border-0 p-0">
        <legend className="sr-only">{m.language_switch()}</legend>
        {locales.map((locale, i) => (
          <span key={locale} className="inline-flex items-center">
            {i > 0 && (
              <span
                aria-hidden="true"
                className="pointer-events-none -ml-[0.8125rem] mr-[0.8125rem] h-3 w-px bg-border"
              />
            )}
            <button
              type="button"
              lang={locale}
              aria-label={LOCALE_LABELS[locale]}
              aria-pressed={current === locale}
              onClick={() => void switchLanguage(locale)}
              className="group inline-flex h-11 min-w-11 items-center rounded-sm font-medium font-mono text-[0.8125rem] text-muted-foreground uppercase tracking-[0.14em] outline-none transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 aria-pressed:text-foreground"
            >
              <span className="relative inline-flex h-full items-center after:absolute after:inset-x-0 after:bottom-1.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-foreground after:transition-transform after:duration-200 after:content-[''] group-aria-pressed:after:scale-x-100">
                {locale.slice(0, 2)}
              </span>
            </button>
          </span>
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
              : 'size-10 pointer-fine:size-9 font-medium font-mono text-[0.8125rem] tracking-wider',
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
