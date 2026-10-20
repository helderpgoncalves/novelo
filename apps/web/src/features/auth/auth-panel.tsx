import { PanelPicture, StripPicture } from '@/components/dither';
import { useMediaQuery } from '@/lib/motion';
import { m } from '@/paraglide/messages';

/**
 * Painel de marca do ecrã de entrada (a partir de 1024 px, à direita, fixo enquanto o formulário rola): a fotografia
 * dither do hero em 3:4, a frase de valor em serif sobre o papel (zona de baixa densidade, contraste ≥ 6,5:1), a etiqueta
 * mono e três factos reais. Só se monta com o ecrã largo: em telemóvel nem pede a imagem. Decorativo (`aria-hidden`) e
 * lazy: nunca atrasa o formulário.
 */
export function AuthPanel() {
  const wide = useMediaQuery('(min-width: 1024px)');
  const facts = [
    [m.auth_fact_parishes_value(), m.auth_fact_parishes_label()],
    [m.auth_fact_inhabitants_value(), m.auth_fact_inhabitants_label()],
    [m.auth_fact_deadline_value(), m.auth_fact_deadline_label()],
  ] as const;
  return (
    <aside
      aria-hidden="true"
      className="relative hidden overflow-hidden border-border border-l bg-[var(--dither-ground)] lg:sticky lg:top-0 lg:block lg:h-dvh"
    >
      {wide && (
        <>
          <div className="absolute inset-0">
            <PanelPicture />
          </div>
          <div className="relative flex max-w-xl flex-col gap-4 p-10 xl:p-12">
            <p className="font-mono text-[11px] text-foreground/80 uppercase tracking-[0.08em]">
              {m.auth_aside_eyebrow()}
            </p>
            <p className="text-balance font-serif font-medium text-[clamp(1.75rem,1.2rem+1.6vw,2.5rem)] leading-[1.1] tracking-[-0.02em]">
              {m.auth_panel_quote()}
            </p>
            <dl className="mt-2 flex gap-8">
              {facts.map(([value, label]) => (
                <div key={label}>
                  <dd className="font-medium font-serif text-2xl tabular-nums">{value}</dd>
                  <dt className="font-mono text-[11px] text-foreground/70">{label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}
    </aside>
  );
}

/**
 * Faixa dither fina no topo do ecrã de entrada em telemóvel e tablet (< 1024 px): 140 px mais a zona segura. Vai no
 * fluxo (não é fixa), por isso o teclado nunca a deixa tapar o formulário; some em ecrãs muito baixos (paisagem,
 * teclado aberto com `resizes-content`).
 */
export function AuthStrip() {
  return (
    <div
      aria-hidden="true"
      className="relative h-[calc(140px+env(safe-area-inset-top))] shrink-0 overflow-hidden border-border border-b bg-[var(--dither-ground)] lg:hidden [@media(max-height:520px)]:hidden"
    >
      <StripPicture />
    </div>
  );
}
