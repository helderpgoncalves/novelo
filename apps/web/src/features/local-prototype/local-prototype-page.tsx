/**
 * PROTOTIPO (wayfinder #51) — página-âncora das variantes do fluxo do local assistido.
 * Chrome do protótipo (aviso + como se entra) + variante ativa + comutador.
 * Throwaway.
 */
import { Mail } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { PrototypeSwitcher, useVariantKeyboard, type VariantDef } from './prototype-switcher';
import { VariantA } from './variant-a';
import { VariantB } from './variant-b';
import { VariantC } from './variant-c';

const VARIANTS: VariantDef[] = [
  { key: 'A', name: 'Caderno de rondas' },
  { key: 'B', name: 'Painel do local' },
  { key: 'C', name: 'Duas portas' },
];

export type VariantKey = 'A' | 'B' | 'C';

export function LocalPrototypePage({
  variant,
  onVariantChange,
}: {
  variant: VariantKey;
  onVariantChange: (v: VariantKey) => void;
}) {
  useVariantKeyboard(VARIANTS, variant, onVariantChange);

  return (
    <div className="bg-background text-foreground min-h-dvh">
      {/* Chrome do protótipo — não faz parte do desenho a avaliar */}
      <div className="border-b border-amber-300 bg-amber-100 text-amber-950">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-2.5 sm:px-6">
          <p className="text-sm font-semibold">
            PROTÓTIPO · área /local · bilhete wayfinder #51 — dados fictícios, nada disto é real
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">
              Como se entra (comum às variantes): convite da equipa
            </summary>
            <div className="mt-2 flex items-start gap-3 rounded-lg bg-white/60 p-3">
              <Mail className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="space-y-1">
                <p className="text-xs text-amber-900/70">
                  de: equipa Novelo &lt;rede@novelo.helder.si&gt; · para: mjferreira@ae-selho.pt
                </p>
                <p className="font-medium">
                  Convite: gerir a conta de «Agrupamento de Escolas de Selho»
                </p>
                <p className="text-amber-900/80">
                  A equipa cria a conta do local e convida pessoas da escola (sem auto-registo).
                  O link abre por magic link — o mesmo mecanismo já existente — e cai na área
                  /local. Quem entra: só leitura + aviso «sacos prontos»; convites e revogações
                  ficam com a equipa.
                </p>
              </div>
            </div>
          </details>
        </div>
      </div>

      <main className="px-4 py-6 sm:px-6">
        <div className="mx-auto mb-6 flex max-w-6xl items-center gap-2">
          <BrandLogo className="size-6" />
          <span className="text-muted-foreground text-sm">Novelo · área do local</span>
        </div>
        {variant === 'A' && <VariantA />}
        {variant === 'B' && <VariantB />}
        {variant === 'C' && <VariantC />}
      </main>

      <PrototypeSwitcher variants={VARIANTS} current={variant} onSelect={onVariantChange} />
    </div>
  );
}
