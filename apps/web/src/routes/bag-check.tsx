import { createFileRoute, Link } from '@tanstack/react-router';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { BagCheckFlow } from '@/features/pre-collection/bag-check-flow';
import { getLocale } from '@/lib/i18n';
import { ogImage, SITE_URL } from '@/lib/seo';
import { m } from '@/paraglide/messages';

// Página pública (sem sessão): para quem prepara o saco de têxteis em casa. O QR do saco aponta para aqui.
export const Route = createFileRoute('/bag-check')({
  head: () => ({
    meta: [
      { title: m.title_bag_check() },
      { name: 'description', content: m.seo_bag_description() },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: m.title_bag_check() },
      { property: 'og:description', content: m.seo_bag_description() },
      { property: 'og:image', content: ogImage('landing') },
      { name: 'twitter:image', content: ogImage('landing') },
    ],
    links: [
      { rel: 'canonical', href: `${SITE_URL}/${getLocale() === 'en' ? 'en' : 'pt'}/bag-check` },
    ],
  }),
  component: BagCheckPage,
});

function BagCheckPage() {
  return (
    <div className="min-h-dvh bg-background pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
        <Link to="/" aria-label="Novelo" className="flex min-h-11 items-center rounded-sm">
          <BrandLogo className="h-7" />
        </Link>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 pb-[max(4rem,env(safe-area-inset-bottom))]">
        <div className="space-y-3">
          <p className="eyebrow">{m.bag_eyebrow()}</p>
          <h1 className="text-4xl tracking-wide sm:text-5xl">{m.bag_title()}</h1>
          <p className="max-w-2xl text-muted-foreground">{m.bag_lead()}</p>
        </div>
        <BagCheckFlow />
      </main>
    </div>
  );
}
