import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { PublicShell } from '@/components/public-shell';
import { getLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { GOOGLE_POLICY_URL, type LegalDoc, LIMITED_USE } from './content';

/** Documento jurídico público (Privacidade ou Termos), com índice, e a ligação ao outro documento. */
export function LegalPage({ doc, other }: { doc: LegalDoc; other: 'privacy' | 'terms' }) {
  const locale = getLocale();
  return (
    <PublicShell>
      <main id="content" className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8 sm:px-6 sm:py-12">
        <div className="space-y-3">
          <h1 className="text-balance text-4xl sm:text-5xl">{doc.title}</h1>
          <p className="text-muted-foreground text-sm">{doc.updated}</p>
          <p className="text-pretty leading-relaxed">{doc.intro}</p>
        </div>

        <nav aria-label={m.legal_toc()} className="rounded-lg border border-border bg-card p-4">
          <p className="eyebrow mb-2">{m.legal_toc()}</p>
          <ol className="grid gap-x-6 sm:grid-cols-2">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="inline-flex min-h-10 items-center text-primary text-sm hover:underline"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {doc.sections.map((s) => (
          <section
            key={s.id}
            id={s.id}
            aria-labelledby={`${s.id}-h`}
            className="scroll-mt-20 space-y-3"
          >
            <h2 id={`${s.id}-h`} className="text-2xl">
              {s.title}
            </h2>
            {s.paragraphs?.map((p) =>
              p === LIMITED_USE[locale] ? (
                <p
                  key={p}
                  className="rounded-md border-primary border-l-4 bg-card px-4 py-3 font-medium leading-relaxed"
                >
                  {p}{' '}
                  <a
                    href={GOOGLE_POLICY_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-normal text-primary text-sm underline underline-offset-4"
                  >
                    Google API Services User Data Policy
                  </a>
                </p>
              ) : (
                <p key={p} className="text-pretty leading-relaxed">
                  {p}
                </p>
              ),
            )}
            {s.items && (
              <ul className="list-disc space-y-2 pl-5 marker:text-primary">
                {s.items.map((item) => (
                  <li key={item} className="text-pretty pl-1 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {s.after?.map((p) => (
              <p key={p} className="text-pretty leading-relaxed">
                {p}
              </p>
            ))}
          </section>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3 border-border border-t pt-6">
          <Link
            to="/"
            className="inline-flex h-10 items-center gap-2 text-primary text-sm hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {m.privacy_back()}
          </Link>
          <Link
            to={other === 'privacy' ? '/privacy' : '/terms'}
            className="inline-flex h-10 items-center text-primary text-sm hover:underline"
          >
            {other === 'privacy' ? m.legal_other_privacy() : m.legal_other_terms()}
          </Link>
        </div>
      </main>
    </PublicShell>
  );
}
