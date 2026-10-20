import { useMediaQuery } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { PanelPicture } from './panel-picture';

/**
 * Painel de marca do ecrã de entrada (a partir de 1024 px, à esquerda, fixo enquanto o formulário rola): a fotografia
 * dither do hero em 3:4, a frase de valor em serif sobre o papel (zona de baixa densidade, contraste ≥ 6,5:1), a etiqueta
 * mono e três factos reais. Só se monta com o ecrã largo: em telemóvel nem pede a imagem. Decorativo (`aria-hidden`) e
 * lazy: nunca atrasa o formulário.
 */
export function AuthPanel({ className }: { className?: string }) {
  const wide = useMediaQuery('(min-width: 1024px)');
  const facts = [
    [m.auth_fact_parishes_value(), m.auth_fact_parishes_label()],
    [m.auth_fact_inhabitants_value(), m.auth_fact_inhabitants_label()],
    [m.auth_fact_deadline_value(), m.auth_fact_deadline_label()],
  ] as const;
  return (
    <aside
      aria-hidden="true"
      className={cn(
        'relative hidden overflow-hidden border-border border-r bg-[var(--dither-ground)] lg:sticky lg:top-0 lg:block lg:h-dvh',
        className,
      )}
    >
      {wide && (
        <>
          <div className="absolute inset-0">
            <PanelPicture />
          </div>
          {/* Véu local só atrás do texto: a cor do papel/tinta do tema, opaca em cima e a dissolver-se por baixo,
              para o texto ter contraste AA sobre qualquer zona da imagem sem lavar o resto. */}
          <div className="relative">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 -bottom-20"
              style={{
                background:
                  'linear-gradient(to bottom, color-mix(in srgb, var(--dither-ground) 94%, transparent) 0%, color-mix(in srgb, var(--dither-ground) 90%, transparent) 62%, transparent 100%)',
              }}
            />
            <div className="relative flex max-w-xl flex-col gap-4 p-10 xl:p-12">
              <p className="font-medium font-mono text-xs text-foreground/85 uppercase tracking-[0.08em]">
                {m.auth_aside_eyebrow()}
              </p>
              <p className="text-balance font-medium font-serif text-[clamp(1.75rem,1.2rem+1.6vw,2.5rem)] text-foreground leading-[1.1] tracking-[-0.02em]">
                {m.auth_panel_quote()}
              </p>
              <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-4">
                {facts.map(([value, label]) => (
                  <div key={label}>
                    <dd className="font-medium font-serif text-2xl text-foreground tabular-nums">
                      {value}
                    </dd>
                    <dt className="font-medium font-mono text-[13px] text-foreground/85">
                      {label}
                    </dt>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
