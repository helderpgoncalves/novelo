import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LocalPrototypePage, type VariantKey } from '@/features/local-prototype/local-prototype-page';

// PROTÓTIPO (wayfinder #51) — fluxo do local assistido na futura área /local.
// Três variantes estruturalmente diferentes, comutáveis por ?variant=A|B|C
// (setas ←/→ ou a pílula fixa no fundo). Dados fictícios, sem ligação à API.
// Throwaway: capturar em branch, não promover.
export const Route = createFileRoute('/prototype/local')({
  validateSearch: (search: Record<string, unknown>): { variant: VariantKey } => ({
    variant: search.variant === 'B' || search.variant === 'C' ? search.variant : 'A',
  }),
  head: () => ({ meta: [{ title: 'Protótipo · Área do local' }] }),
  component: LocalPrototypeRoute,
});

function LocalPrototypeRoute() {
  const { variant } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <LocalPrototypePage
      variant={variant}
      onVariantChange={(v) => navigate({ to: '/prototype/local', search: { variant: v }, replace: true })}
    />
  );
}
