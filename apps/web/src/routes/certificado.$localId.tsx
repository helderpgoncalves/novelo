import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import { getPublicLocalCertificateOptions } from '@/client/@tanstack/react-query.gen';
import { BrandLogo } from '@/components/brand-logo';
import { ErrorState } from '@/components/states';
import {
  DestinationBar,
  DestinationLegend,
  type DestinationSplit,
} from '@/features/local-area/destination-bar';
import { getErrorCode } from '@/lib/errors';
import { formatKg } from '@/lib/format';
import { getLocale } from '@/lib/i18n';
import { ogImage, SITE_URL } from '@/lib/seo';

// Página pública do certificado de um local (opt-in): só existe quando o local decide partilhar
// (a API responde 404 `certificate_not_public`). Agregados do sítio: nunca doadores, nunca CO₂.

export const Route = createFileRoute('/certificado/$localId')({
  head: ({ params }) => ({
    meta: [
      { title: 'Certificado de recolha · Novelo' },
      {
        name: 'description',
        content:
          'Certificado público de recolha seletiva de têxtil: kg medidos por destino, sem dados de doadores.',
      },
      { name: 'robots', content: 'noindex, nofollow' }, // opt-in do local; só o próprio link partilha
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'Certificado de recolha · Novelo' },
      {
        property: 'og:description',
        content:
          'kg de têxtil recolhido e pesado à porta, medidos por destino. Sem dados de doadores.',
      },
      { property: 'og:image', content: ogImage('passaporte') },
    ],
    links: [
      {
        rel: 'canonical',
        href: `${SITE_URL}/${getLocale() === 'en' ? 'en' : 'pt'}/certificado/${params.localId}`,
      },
    ],
  }),
  component: CertificatePage,
});

function CertificatePage() {
  const { localId } = Route.useParams();
  const {
    data: cert,
    isPending,
    error,
    refetch,
  } = useQuery(getPublicLocalCertificateOptions({ path: { account_id: localId } }));
  const notPublic = getErrorCode(error) === 'certificate_not_public';

  return (
    <div className="bg-background min-h-dvh pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
        <Link to="/" aria-label="Novelo" className="flex min-h-11 items-center rounded-sm">
          <BrandLogo className="h-7" />
        </Link>
      </header>
      <main className="mx-auto max-w-lg px-4 pb-16">
        {isPending ? (
          <p className="text-muted-foreground py-16 text-center">A carregar o certificado…</p>
        ) : notPublic ? (
          <div className="space-y-4 py-16 text-center">
            <Lock className="text-muted-foreground mx-auto size-8" aria-hidden />
            <h1 className="font-serif text-2xl text-balance">Este certificado não está público</h1>
            <p className="text-muted-foreground text-sm">
              O local decidiu não partilhar, por agora. Só aparece aqui quando quem gere o local
              liga o certificado.
            </p>
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : cert ? (
          <article className="bg-card ring-foreground/10 space-y-5 rounded-2xl border p-6 ring-1">
            <div>
              <p className="text-muted-foreground text-xs tracking-wider uppercase">
                Certificado de recolha · rede Novelo
              </p>
              <h1 className="font-serif mt-1 text-3xl leading-tight text-balance">
                {cert.locality_name}
              </h1>
              {cert.parish_name && (
                <p className="text-muted-foreground mt-1 text-sm">{cert.parish_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-4xl font-semibold tabular-nums">{formatKg(cert.weight_kg)}</p>
              <p className="text-muted-foreground text-sm">
                de têxtil recolhido e pesado à porta, em {cert.stops}{' '}
                {cert.stops === 1 ? 'paragem' : 'paragens'}
              </p>
            </div>
            {cert.stops > 0 && (
              <div className="space-y-3">
                <DestinationBar
                  split={{ reuse: cert.reuse_kg, recycle: cert.recycle_kg, reject: cert.reject_kg }}
                />
                <DestinationLegend
                  split={
                    {
                      reuse: cert.reuse_kg,
                      recycle: cert.recycle_kg,
                      reject: cert.reject_kg,
                    } satisfies DestinationSplit
                  }
                  pct={{
                    reuse: cert.reuse_pct,
                    recycle: cert.recycle_pct,
                    reject: cert.reject_pct,
                  }}
                />
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              Valores medidos na pesagem de cada paragem; os destinos vêm da triagem. Sem dados de
              doadores. Operação da Vitrus · Guimarães.
            </p>
          </article>
        ) : null}
      </main>
    </div>
  );
}
