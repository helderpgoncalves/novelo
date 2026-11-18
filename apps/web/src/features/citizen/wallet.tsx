import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Gift, History, Home, ShieldCheck, ShoppingBag, Wallet as WalletIcon } from 'lucide-react';
import { useState } from 'react';
import type { BagActivationOut } from '@/client';
import {
  getCollectionHistoryOptions,
  getDonorAccountOptions,
  getDonorPointsBalanceOptions,
  getPublicCollectionAgendaOptions,
  listBagActivationsOptions,
} from '@/client/@tanstack/react-query.gen';
import { BrandLogo } from '@/components/brand-logo';
import { ErrorState } from '@/components/states';
import { agendaByDay } from '@/features/citizen/agenda';
import { BagsTab } from '@/features/citizen/bags-tab';
import { BalanceTab } from '@/features/citizen/balance-tab';
import { CatalogTab } from '@/features/citizen/catalog-tab';
import { HistoryTab } from '@/features/citizen/history-tab';
import { HomeTab } from '@/features/citizen/inicio-tab';
import { bagsAtHome } from '@/features/citizen/onboarding';
import { PrivacyTab } from '@/features/citizen/privacy-tab';
import { AccountQrSheet, BagQrSheet } from '@/features/citizen/qr-sheets';
import { RequestSheet } from '@/features/citizen/request-sheet';
import { cn } from '@/lib/utils';

// Strings em pt-PT de propósito: a área do cidadão é só portuguesa no MVP (decisão da spec #54).

type WalletTabId = 'inicio' | 'sacos' | 'saldo' | 'catalogo' | 'historico' | 'privacidade';

const TABS: Array<{ id: WalletTabId; label: string; icon: typeof Home }> = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'sacos', label: 'Sacos', icon: ShoppingBag },
  { id: 'saldo', label: 'Saldo', icon: WalletIcon },
  { id: 'catalogo', label: 'Catálogo', icon: Gift },
  { id: 'historico', label: 'Histórico', icon: History },
  { id: 'privacidade', label: 'Privacidade', icon: ShieldCheck },
];

/** A «Carteira» do doador: barra de separadores em baixo (telemóvel primeiro), seis ecrãs densos.
 * Cada separador vive no seu ficheiro (`inicio-tab`, `bags-tab`, `balance-tab`, `catalog-tab`,
 * `history-tab`, `privacy-tab`); aqui fica só a casca comum. */
export function Wallet({ tab }: { tab: WalletTabId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [accountQrOpen, setAccountQrOpen] = useState(false);
  const [qrBag, setQrBag] = useState<BagActivationOut | null>(null);
  const [requesting, setRequesting] = useState(false);

  const {
    data: account,
    error: accountError,
    refetch: refetchAccount,
  } = useSuspenseQuery(getDonorAccountOptions());
  const {
    data: bags,
    error: bagsError,
    refetch: refetchBags,
  } = useSuspenseQuery(listBagActivationsOptions());
  const { data: history } = useSuspenseQuery(getCollectionHistoryOptions());
  // A agenda é secundária: a carteira desenha sem ela (a página pública é quem manda nela).
  const { data: agendaData } = useQuery(getPublicCollectionAgendaOptions());
  // O saldo real (#64): derivado do livro-razão; o Início mostra-o em resumo, o Saldo por inteiro.
  const balanceQuery = useQuery({ ...getDonorPointsBalanceOptions(), refetchOnWindowFocus: false });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: listBagActivationsOptions().queryKey });
    void queryClient.invalidateQueries({ queryKey: getCollectionHistoryOptions().queryKey });
  };
  const changeTab = (next: WalletTabId) =>
    void navigate({ to: '/cidadao', search: { tab: next }, replace: true });
  const error = accountError ?? bagsError;

  return (
    <div className="bg-background min-h-dvh pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header className="bg-background/95 border-border/60 sticky top-0 z-10 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <BrandLogo className="h-6" />
          <span className="text-muted-foreground max-w-44 truncate text-xs">{account.email}</span>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-5 px-4 pt-5 pb-28">
        {error ? (
          <ErrorState
            error={error}
            onRetry={() => {
              void refetchAccount();
              void refetchBags();
            }}
          />
        ) : (
          <>
            {tab === 'inicio' && (
              <HomeTab
                bags={bags}
                history={history}
                agenda={agendaByDay(agendaData?.agenda ?? null)}
                balanceValue={balanceQuery.data?.balance}
                onShowAccountQr={() => setAccountQrOpen(true)}
                onNewBag={() => changeTab('sacos')}
                onRequest={() => setRequesting(true)}
                onGoBags={() => changeTab('sacos')}
              />
            )}
            {tab === 'sacos' && (
              <BagsTab
                bags={bags}
                error={bagsError}
                refetch={refetchBags}
                onShowQr={setQrBag}
                onChanged={invalidate}
              />
            )}
            {tab === 'saldo' && <BalanceTab balanceQuery={balanceQuery} />}
            {tab === 'catalogo' && <CatalogTab balance={balanceQuery.data?.balance ?? 0} />}
            {tab === 'historico' && <HistoryTab history={history} />}
            {tab === 'privacidade' && <PrivacyTab />}
          </>
        )}
      </main>

      {/* Barra de separadores em baixo: alvos ≥ 40 px, safe-area incluída. */}
      <nav
        aria-label="Áreas da carteira"
        className="border-border/60 bg-background/95 fixed inset-x-0 bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto flex max-w-lg">
          {TABS.map(({ id, label, icon: Icon }) => (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => changeTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium',
                  tab === id ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* O QR de conta: o segundo portador (entrega mão a mão, sem saco da plataforma). */}
      <AccountQrSheet open={accountQrOpen} onOpenChange={setAccountQrOpen} />
      <BagQrSheet bag={qrBag} onClose={() => setQrBag(null)} />
      <RequestSheet
        open={requesting}
        onOpenChange={setRequesting}
        bagsAtHome={bagsAtHome(bags, history).length}
      />
    </div>
  );
}
