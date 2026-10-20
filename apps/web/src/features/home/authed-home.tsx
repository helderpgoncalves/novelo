import type { MeOut } from '@/client';
import { AppFrame } from '@/components/layout/app-frame';
import { HomePage } from './home-page';
import type { HomeTab } from './tabs';

/**
 * Página inicial para quem tem sessão: a estrutura da app e a home com os gráficos. Vive num pacote à parte
 * (`lazy` na rota `/`) para o visitante da landing nunca descarregar a app, o `echarts` nem os mapas.
 */
export default function AuthedHome({
  user,
  tab,
  onTabChange,
}: {
  user: MeOut;
  tab: HomeTab;
  onTabChange: (tab: HomeTab) => void;
}) {
  return (
    <AppFrame user={user}>
      <HomePage tab={tab} onTabChange={onTabChange} />
    </AppFrame>
  );
}
