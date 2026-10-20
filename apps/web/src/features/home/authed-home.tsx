import type { MeOut } from '@/client';
import { AppFrame } from '@/components/layout/app-frame';
import { HomePage, type HomeSearch } from './home-page';
import type { HomeTab, LayerId } from './tabs';

/**
 * Página inicial para quem tem sessão: a estrutura da app e a sala de decisão. Vive num pacote à parte (`lazy` na
 * rota `/`) para o visitante da landing nunca descarregar a app nem os mapas.
 */
export default function AuthedHome({
  user,
  search,
  onSearch,
}: {
  user: MeOut;
  search: HomeSearch;
  onSearch: (
    patch: Partial<{ tab: HomeTab; layer: LayerId; parish: string | null; budget: number }>,
  ) => void;
}) {
  return (
    <AppFrame user={user}>
      <HomePage role={user.role} search={search} onSearch={onSearch} />
    </AppFrame>
  );
}
