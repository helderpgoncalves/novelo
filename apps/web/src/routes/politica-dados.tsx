import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Scale, ShieldCheck } from 'lucide-react';
import { getPublicPrivacyPolicyOptions } from '@/client/@tanstack/react-query.gen';
import { BrandLogo } from '@/components/brand-logo';
import { ErrorState } from '@/components/states';
import { getLocale } from '@/lib/i18n';
import { ogImage, SITE_URL } from '@/lib/seo';

// Strings em pt-PT de propósito: página pública do cidadão, só portuguesa no MVP (decisão da spec #54).

/** Página pública «Política de dados» (#66): a política de privacidade POR FINALIDADES, com prazos
 * por categoria. Não tem texto próprio — desenha EXATAMENTE o que a API devolve
 * (`GET /public/privacy-policy`, UMA fonte em `features/privacy/policy.py`): mudou a política, muda
 * a API e esta página segue. */
export const Route = createFileRoute('/politica-dados')({
  head: () => ({
    meta: [
      { title: 'Política de dados — conta de doador · Novelo' },
      {
        name: 'description',
        content:
          'O que a conta de doador do Novelo guarda, com que base legal e até quando — finalidades e prazos por categoria (RGPD).',
      },
      { property: 'og:title', content: 'Política de dados — conta de doador · Novelo' },
      {
        property: 'og:description',
        content: 'Finalidades, bases legais e prazos de conservação da conta de doador (RGPD).',
      },
      { property: 'og:image', content: ogImage('landing') },
    ],
    links: [
      {
        rel: 'canonical',
        href: `${SITE_URL}/${getLocale() === 'en' ? 'en' : 'pt'}/politica-dados`,
      },
    ],
  }),
  component: PoliticaDadosPage,
});

function PoliticaDadosPage() {
  const { data: policy, isPending, error, refetch } = useQuery(getPublicPrivacyPolicyOptions());

  return (
    <div className="bg-background min-h-dvh pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
        <Link to="/" aria-label="Novelo" className="flex min-h-11 items-center rounded-sm">
          <BrandLogo className="h-7" />
        </Link>
        <Link
          to="/cidadao"
          className="bg-primary text-primary-foreground inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium"
        >
          A minha carteira
        </Link>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 pb-16">
        <section className="space-y-2">
          <p className="text-primary text-xs font-medium tracking-wider uppercase">
            Política de dados
          </p>
          <h1 className="font-serif text-3xl leading-tight text-balance">
            O que guardamos, porquê e até quando
          </h1>
          <p className="text-muted-foreground text-sm">
            A política da conta de doador, por finalidades: cada tratamento com a sua base legal e
            cada categoria de dados com o seu prazo de conservação. Quem é o responsável: a Vitrus —
            a plataforma Novelo é subresponsável, por conta e instruções dela.
          </p>
        </section>

        {isPending ? (
          <div className="space-y-4" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="ring-foreground/10 space-y-2 rounded-2xl bg-card p-5 ring-1">
                <div className="bg-muted/60 h-5 w-1/2 animate-pulse rounded" />
                <div className="bg-muted/60 h-4 w-2/3 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : error || !policy ? (
          <ErrorState error={error ?? new Error('sem política')} onRetry={() => void refetch()} />
        ) : (
          <>
            {policy.purposes.map((purpose) => (
              <section
                key={purpose.id}
                className="ring-foreground/10 space-y-3 rounded-2xl bg-card p-5 ring-1"
              >
                <h2 className="font-semibold">{purpose.title}</h2>
                <p className="text-muted-foreground text-sm">{purpose.description}</p>
                <p className="text-muted-foreground inline-flex items-start gap-1.5 text-xs">
                  <Scale className="text-primary mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {purpose.legal_basis}
                  {purpose.consent_required && (
                    <span className="bg-primary/10 text-primary ml-1 rounded-full px-2 py-0.5 font-medium whitespace-nowrap">
                      só com o teu SIM
                    </span>
                  )}
                </p>
                <ul className="border-foreground/10 space-y-2 border-t pt-3">
                  {purpose.categories.map((category) => (
                    <li
                      key={`${purpose.id}-${category.name}`}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0">{category.name}</span>
                      <span className="bg-muted text-foreground shrink-0 rounded-full px-2.5 py-1 text-xs font-medium">
                        {category.retention}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <section className="ring-foreground/10 space-y-2 rounded-2xl bg-card p-5 text-sm ring-1">
              <h2 className="inline-flex items-center gap-2 font-semibold">
                <ShieldCheck className="text-primary size-4" aria-hidden />
                Os teus direitos
              </h2>
              <ul className="text-muted-foreground space-y-1.5">
                {policy.rights.map((right) => (
                  <li key={right} className="flex gap-2">
                    <span aria-hidden>·</span>
                    <span>{right}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground text-xs">
                Idade mínima da conta: {policy.minimum_age} anos (recusa explícita abaixo disso, sem
                exceções). As decisões de marketing e parcerias ficam registadas com a versão desta
                política — versão em vigor: {policy.version}.
              </p>
            </section>
          </>
        )}

        <p className="text-muted-foreground px-2 text-xs">
          Esta página é pública e lê a política direto da API do Novelo — não há uma segunda cópia.
          Dúvidas ou pedidos: novelo@heldergoncalves.io.
        </p>
      </main>
    </div>
  );
}
