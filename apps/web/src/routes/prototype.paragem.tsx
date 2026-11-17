// PROTOTIPO (wayfinder #50): ecra de paragem da viatura — chegar -> scan (QR de saco
// ou QR de conta) -> pesar (uma leitura ou partes somadas) -> etiqueta so quando nao
// ha QR -> partir, offline primeiro. Tres variantes estruturais, comutadas por
// `?variant=A|B|C` (setas do teclado ou pilula flutuante); `?cen=` escolhe o cenario.
// Throwaway: nunca vai a main.
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { buildScenario } from '@/features/prototype-paragem/model';
import { PrototypeSwitcher } from '@/features/prototype-paragem/switcher';
import { VariantA } from '@/features/prototype-paragem/variant-a';
import { VariantB } from '@/features/prototype-paragem/variant-b';
import { VariantC } from '@/features/prototype-paragem/variant-c';

const VARIANTS = [
  { key: 'A', name: 'Passo a passo' },
  { key: 'B', name: 'Tudo à vista' },
  { key: 'C', name: 'O scan manda' },
] as const;

const searchSchema = z.object({
  variant: z.enum(['A', 'B', 'C']).catch('A'),
  cen: z.enum(['escola', 'pesado', 'modob', 'pedido', 'off']).optional(),
});

export const Route = createFileRoute('/prototype/paragem')({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
  component: PrototypeParagemRoute,
});

function PrototypeParagemRoute() {
  const { variant, cen } = Route.useSearch();
  const navigate = Route.useNavigate();
  const initial = buildScenario(cen ?? 'escola');

  return (
    <>
      <main className="min-h-dvh bg-background">
        <p className="border-b border-dashed border-border bg-areia/20 px-4 py-2 text-center text-xs text-muted-foreground">
          Protótipo descartável — bilhete #50 «fluxo da viatura na paragem». Balança KERN 6/15 kg,
          impressora Zebra (BLE) e câmara são simuladas. Nada disto é o produto.
        </p>
        {variant === 'A' && <VariantA key={`A-${cen ?? 'escola'}`} initial={initial} />}
        {variant === 'B' && <VariantB key={`B-${cen ?? 'escola'}`} initial={initial} />}
        {variant === 'C' && <VariantC key={`C-${cen ?? 'escola'}`} initial={initial} />}
      </main>
      <PrototypeSwitcher
        variants={[...VARIANTS]}
        current={variant}
        raised={variant !== 'A'}
        onSelect={(key) =>
          void navigate({ search: { variant: key as 'A' | 'B' | 'C', cen }, replace: true })
        }
      />
    </>
  );
}
