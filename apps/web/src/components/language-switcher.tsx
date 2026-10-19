import { Languages } from 'lucide-react';
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
import { m } from '@/paraglide/messages';

export function LanguageSwitcher({
  signedIn = false,
  showLabel = false,
}: {
  signedIn?: boolean;
  showLabel?: boolean;
}) {
  const switchLanguage = useSwitchLanguage(signedIn);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={showLabel ? 'sm' : 'icon'}
          className={showLabel ? 'h-9 gap-2' : 'size-9'}
          aria-label={m.language_switch()}
        >
          <Languages className="size-4" />
          {showLabel && <span className="text-sm">{LOCALE_LABELS[getLocale()]}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup
          value={getLocale()}
          onValueChange={(value) => void switchLanguage(value as Locale)}
        >
          {locales.map((locale) => (
            <DropdownMenuRadioItem key={locale} value={locale} lang={locale}>
              {LOCALE_LABELS[locale]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
