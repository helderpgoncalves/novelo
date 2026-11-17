// PROTOTIPO (wayfinder #48): fluxo do cidadão do primeiro contacto ao crédito.
// Três variantes estruturalmente diferentes, comutadas por `?variant=A|B|C`
// (setas do teclado ou pílula flutuante). Throwaway: nunca vai à main.
//
// Pergunta: como se apresenta e comporta a área do cidadão — chegar → criar
// conta (magic link) → ativar o 1.º saco (QR) → entregar → ver o crédito e o
// histórico — nos termos do MVP decidido em #38?
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { VariantA } from '@/features/prototype-cidadao/variant-a';
import { VariantB } from '@/features/prototype-cidadao/variant-b';
import { VariantC } from '@/features/prototype-cidadao/variant-c';
import { PrototypeSwitcher } from '@/features/prototype-cidadao/variant-switcher';

const VARIANTS = [
  { key: 'A', name: 'Passo a passo' },
  { key: 'B', name: 'Carteira' },
  { key: 'C', name: 'Rede primeiro' },
] as const;

export const Route = createFileRoute('/prototype/cidadao')({
  validateSearch: z.object({ variant: z.enum(['A', 'B', 'C']).catch('A') }),
  component: PrototypeCidadaoRoute,
});

function PrototypeCidadaoRoute() {
  const { variant } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <>
      <div className="min-h-dvh bg-background">
        {variant === 'A' && <VariantA />}
        {variant === 'B' && <VariantB />}
        {variant === 'C' && <VariantC />}
      </div>
      <PrototypeSwitcher
        variants={[...VARIANTS]}
        current={variant}
        raised={variant === 'B'}
        onSelect={(key) =>
          void navigate({ search: { variant: key as 'A' | 'B' | 'C' }, replace: true })
        }
      />
    </>
  );
}
