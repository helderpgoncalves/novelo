import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: m.title_privacy() }] }),
  component: Privacy,
});

// Pública e curta: é o que o convidado lê antes de aceitar. Os textos vivem em messages/.
function Privacy() {
  const sections = [
    [m.privacy_what_title(), m.privacy_what_text()],
    [m.privacy_why_title(), m.privacy_why_text()],
    [m.privacy_how_long_title(), m.privacy_how_long_text()],
    [m.privacy_rights_title(), m.privacy_rights_text()],
    [m.privacy_who_title(), m.privacy_who_text()],
  ] as const;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <BrandLogo className="h-8" />
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 space-y-8 py-10">
        <div className="space-y-3">
          <h1 className="text-4xl">{m.privacy_title()}</h1>
          <p className="text-muted-foreground leading-relaxed">{m.privacy_intro()}</p>
        </div>
        {sections.map(([title, text]) => (
          <section key={title} className="space-y-2">
            <h2 className="text-2xl">{title}</h2>
            <p className="leading-relaxed">{text}</p>
          </section>
        ))}
      </main>
      <Link
        to="/"
        className="inline-flex h-10 items-center gap-2 self-start text-primary text-sm hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {m.privacy_back()}
      </Link>
    </div>
  );
}
