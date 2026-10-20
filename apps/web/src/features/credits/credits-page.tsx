import { Link } from '@tanstack/react-router';
import { ArrowLeft, Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import { PublicShell } from '@/components/public-shell';
import '../landing/landing-assets.generated.css';
import { HERO_WIDE } from '@/features/landing/landing-assets.generated';
import { CONTACT_EMAIL } from '@/features/legal/content';
import { useTheme } from '@/lib/theme';
import { m } from '@/paraglide/messages';
import { HackathonCover } from '../landing/hackathon-cover';
import {
  API_SOFTWARE,
  DATA_CREDITS,
  FONT_CREDITS,
  FONT_LICENSE,
  HACKATHON_URL,
  PHOTO_CREDITS,
  type PhotoCredit,
  type SoftwareCredit,
  WEB_SOFTWARE,
} from '../landing/photo-credits';

/** Ligação externa: abre noutro separador e diz-o a quem usa leitor de ecrã. */
function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="lp-cr-link">
      {children}
      <span className="sr-only"> ({m.credits_external()})</span>
    </a>
  );
}

function SectionHead({ id, title, lead }: { id: string; title: string; lead?: string }) {
  return (
    <header className="flex flex-col gap-3">
      <h2
        id={`${id}-title`}
        className="font-medium font-serif text-[1.75rem] leading-tight tracking-[-0.015em] sm:text-[2.125rem]"
      >
        {title}
      </h2>
      {lead && (
        <p className="max-w-2xl text-pretty text-muted-foreground leading-relaxed">{lead}</p>
      )}
    </header>
  );
}

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-24 flex-col gap-6">
      <SectionHead id={id} title={title} lead={lead} />
      {children}
    </section>
  );
}

/** Miniatura do derivado em meio-tom: a Penha é uma imagem do hero (por tema); as outras são os fundos da landing. */
function Thumb({ id }: { id: PhotoCredit['id'] }) {
  const tone = useTheme().resolvedTheme;
  if (id === 'penha') {
    const src = HERO_WIDE[tone].avif[0]?.src;
    return (
      <div className="lp-cr-thumb">
        <img
          src={`/landing/${src}`}
          alt=""
          width={960}
          height={600}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }
  return <div aria-hidden="true" className={`lp-cr-thumb photo-bg photo-${id}`} />;
}

function PhotoRow({ photo }: { photo: PhotoCredit }) {
  return (
    <li className="lp-cr-row">
      <Thumb id={photo.id} />
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-medium font-serif text-xl leading-snug">{photo.label()}</h3>
          <p className="break-words text-muted-foreground text-sm">«{photo.title}»</p>
        </div>
        <dl className="lp-cr-dl">
          <dt>{m.credits_photo_author()}</dt>
          <dd>{photo.author}</dd>
          <dt>{m.credits_photo_license()}</dt>
          <dd>
            <Ext href={photo.licenseUrl}>{photo.license}</Ext>
          </dd>
          <dt>{m.credits_photo_source()}</dt>
          <dd>
            <Ext href={photo.page}>{m.credits_photo_source_link()}</Ext>
          </dd>
          <dt>{m.credits_photo_used()}</dt>
          <dd>{photo.usedIn()}</dd>
        </dl>
      </div>
    </li>
  );
}

function SoftwareList({ title, items }: { title: string; items: readonly SoftwareCredit[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="lp-kicker">{title}</h3>
      <ul className="divide-y divide-border border-border border-y">
        {items.map((s) => (
          <li key={s.name} className="flex min-h-11 items-center justify-between gap-4 py-2">
            <Ext href={s.url}>{s.name}</Ext>
            <span className="shrink-0 font-mono text-muted-foreground text-xs">{s.license}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * «Créditos e licenças» (pública, indexável): fotografias, dados, tipos de letra, software, hackathon e pedido de correção.
 * Os dados vêm de `features/landing/photo-credits.ts` (fonte única). O rodapé da landing e o das páginas públicas ligam aqui:
 * é onde se cumpre a atribuição das licenças CC BY e CC BY-SA.
 */
export function CreditsPage() {
  const toc = [
    ['fotografias', m.credits_photos_title()],
    ['dados', m.credits_data_title()],
    ['tipos-de-letra', m.credits_fonts_title()],
    ['software', m.credits_software_title()],
    ['hackathon', m.credits_hackathon_title()],
    ['correcoes', m.credits_fix_title()],
  ] as const;
  return (
    <PublicShell width="max-w-5xl">
      <main
        id="content"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl px-4 py-10 outline-none sm:px-6 sm:py-14 lg:px-8"
      >
        <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
          <aside>
            <nav aria-label={m.credits_toc()} className="lg:sticky lg:top-24">
              <p className="lp-kicker pb-2">{m.credits_toc()}</p>
              <ul className="lp-cr-toc">
                {toc.map(([id, label]) => (
                  <li key={id}>
                    <a href={`#${id}`}>{label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <div className="flex min-w-0 flex-col gap-14 sm:gap-16">
            <header className="flex flex-col gap-4">
              <p className="lp-kicker text-primary">{m.credits_eyebrow()}</p>
              <h1 className="text-balance font-medium font-serif text-[2.5rem] leading-[1.05] tracking-[-0.025em] sm:text-[3.25rem]">
                {m.credits_title()}
              </h1>
              <p className="max-w-2xl text-pretty text-lg text-muted-foreground leading-relaxed">
                {m.credits_lead()}
              </p>
            </header>

            <Section
              id="fotografias"
              title={m.credits_photos_title()}
              lead={m.credits_photos_lead()}
            >
              <ul className="divide-y divide-border border-border border-y">
                {PHOTO_CREDITS.map((p) => (
                  <PhotoRow key={p.id} photo={p} />
                ))}
              </ul>
              <div className="lp-cr-note">
                <h3 className="font-medium">{m.credits_derivatives_title()}</h3>
                <p>{m.credits_derivatives_text()}</p>
              </div>
            </Section>

            <Section id="dados" title={m.credits_data_title()} lead={m.credits_data_lead()}>
              <ul className="divide-y divide-border border-border border-y">
                {DATA_CREDITS.map((d) => (
                  <li key={d.id} className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
                    <h3 className="font-medium">
                      {d.url ? <Ext href={d.url}>{d.name}</Ext> : d.name}
                    </h3>
                    <p className="text-pretty text-muted-foreground leading-relaxed">
                      {d.text()}
                      {d.license && (
                        <>
                          {' '}
                          <Ext href={d.license.url}>{d.license.name}</Ext>
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              id="tipos-de-letra"
              title={m.credits_fonts_title()}
              lead={m.credits_fonts_lead()}
            >
              <ul className="divide-y divide-border border-border border-y">
                {FONT_CREDITS.map((f) => (
                  <li key={f.name} className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
                    <h3 className="font-medium font-serif text-xl">
                      <Ext href={f.url}>{f.name}</Ext>
                    </h3>
                    <p className="text-pretty text-muted-foreground leading-relaxed">
                      {f.use()} © {f.holder}. <Ext href={FONT_LICENSE.url}>{FONT_LICENSE.name}</Ext>
                    </p>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              id="software"
              title={m.credits_software_title()}
              lead={m.credits_software_lead()}
            >
              <div className="grid gap-8 sm:grid-cols-2">
                <SoftwareList title={m.credits_software_web()} items={WEB_SOFTWARE} />
                <SoftwareList title={m.credits_software_api()} items={API_SOFTWARE} />
              </div>
            </Section>

            <Section id="hackathon" title={m.credits_hackathon_title()}>
              <div className="lp-cr-hack">
                <div className="lp-ft-media">
                  <HackathonCover
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 40vw, 100vw"
                    className="lp-ft-cover"
                  />
                </div>
                <div className="flex flex-col justify-center gap-3">
                  <p className="text-pretty leading-relaxed">{m.credits_hackathon_text()}</p>
                  <p className="text-pretty text-muted-foreground text-sm leading-relaxed">
                    {m.credits_hackathon_rights()}
                  </p>
                  <p>
                    <Ext href={HACKATHON_URL}>{m.credits_hackathon_link()}</Ext>
                  </p>
                </div>
              </div>
            </Section>

            <Section id="correcoes" title={m.credits_fix_title()}>
              <div className="lp-cr-note">
                <p>{m.credits_fix_text()}</p>
                <p>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="lp-cr-button">
                    <Mail className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    {m.credits_fix_cta()}
                    <span className="sr-only">: {CONTACT_EMAIL}</span>
                  </a>
                </p>
              </div>
            </Section>

            <div className="border-border border-t pt-6">
              <Link to="/" className="lp-cr-link inline-flex min-h-11 items-center gap-2">
                <ArrowLeft className="size-4" aria-hidden="true" />
                {m.privacy_back()}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
