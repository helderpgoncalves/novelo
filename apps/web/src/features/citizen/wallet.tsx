import type { UseQueryResult } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Gift,
  History,
  Home,
  PackageOpen,
  Pencil,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type {
  BagActivationOut,
  CollectionHistoryOut,
  GetDonorPointsBalanceError,
  PointEntryOut,
  PointsBalanceOut,
} from '@/client';
import {
  activateBagMutation,
  createBagActivationMutation,
  deactivateBagMutation,
  getBagQrOptions,
  getCollectionHistoryOptions,
  getDonorAccountOptions,
  getDonorAccountQrOptions,
  getDonorPointsBalanceOptions,
  getPublicCollectionAgendaOptions,
  listBagActivationsOptions,
  listDonorPointsOptions,
  updateBagActivationMutation,
} from '@/client/@tanstack/react-query.gen';
import { BrandLogo } from '@/components/brand-logo';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { agendaByDay, cadenceLabel, channelLabel } from '@/features/citizen/agenda';
import { CatalogTab } from '@/features/citizen/catalog-tab';
import { bagsAtHome, milestones, onboardingCollapsed } from '@/features/citizen/onboarding';
import { PrivacyTab } from '@/features/citizen/privacy-tab';
import { RequestSheet } from '@/features/citizen/request-sheet';
import { getErrorCode } from '@/lib/errors';
import { formatKg, formatNumber } from '@/lib/format';
import { formatDate, weekdayLong } from '@/lib/i18n';
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

/** A «Carteira» do doador: barra de separadores em baixo (telemóvel primeiro), seis ecrãs densos. */
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
              <InicioTab
                bags={bags}
                history={history}
                agenda={agendaByDay(agendaData?.agenda ?? null)}
                saldoBalance={balanceQuery.data?.balance}
                onShowAccountQr={() => setAccountQrOpen(true)}
                onNewBag={() => changeTab('sacos')}
                onRequest={() => setRequesting(true)}
                onGoBags={() => changeTab('sacos')}
              />
            )}
            {tab === 'sacos' && (
              <SacosTab
                bags={bags}
                error={bagsError}
                refetch={refetchBags}
                onShowQr={setQrBag}
                onChanged={invalidate}
              />
            )}
            {tab === 'saldo' && <BalanceTab balanceQuery={balanceQuery} />}
            {tab === 'catalogo' && <CatalogTab balance={balanceQuery.data?.balance ?? 0} />}
            {tab === 'historico' && <HistoricoTab history={history} />}
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

// --- Início ---------------------------------------------------------------------------------------

function InicioTab({
  bags,
  history,
  agenda,
  saldoBalance,
  onShowAccountQr,
  onNewBag,
  onRequest,
  onGoBags,
}: {
  bags: BagActivationOut[];
  history: CollectionHistoryOut[];
  agenda: ReturnType<typeof agendaByDay>;
  saldoBalance: number | undefined;
  onShowAccountQr: () => void;
  onNewBag: () => void;
  onRequest: () => void;
  onGoBags: () => void;
}) {
  const collapsed = onboardingCollapsed(history);
  const active = bags.filter((b) => b.active);
  const nextDay = agenda[0];
  const totalKg = history.reduce((sum, h) => sum + (h.weight_kg ?? 0), 0);

  return (
    <>
      {/* Saldo e QR de conta, lado a lado — o par que o protótipo «Carteira» põe em primeiro plano. */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="ring-foreground/10 space-y-1 rounded-xl bg-card p-4 text-left ring-1"
          aria-label="Saldo de pontos (só leitura)"
        >
          <p className="text-muted-foreground text-xs">Saldo (estimativa)</p>
          <p className="font-serif text-3xl">
            {saldoBalance != null ? formatNumber(saldoBalance) : '—'}
          </p>
          <p className="text-muted-foreground text-[11px]">pontos · só leitura</p>
        </button>
        <button
          type="button"
          onClick={onShowAccountQr}
          className="ring-primary/20 bg-primary/10 grid place-items-center gap-1 rounded-xl p-4 text-center ring-1"
        >
          <QrCode className="mb-1 size-6" aria-hidden />
          <span className="text-sm font-medium">QR da conta</span>
          <span className="text-muted-foreground text-[11px]">entrega mão a mão</span>
        </button>
      </div>

      {/* Onboarding de marcos: colapsa após a 1.ª recolha (decisão do bilhete #63). */}
      {!collapsed && (
        <section className="ring-foreground/10 space-y-3 rounded-2xl bg-card p-5 ring-1">
          <h2 className="font-serif text-xl">Começa por aqui</h2>
          <ol className="space-y-3">
            {milestones(bags, history).map((m) => (
              <li key={m.id} className="flex gap-3">
                {m.done ? (
                  <CheckCircle2
                    className="text-primary mt-0.5 size-5 shrink-0"
                    aria-label="Feito"
                  />
                ) : (
                  <Circle className="text-muted-foreground/50 mt-0.5 size-5 shrink-0" aria-hidden />
                )}
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      m.done && 'text-muted-foreground line-through',
                    )}
                  >
                    {m.title}
                  </p>
                  {!m.done && <p className="text-muted-foreground text-xs">{m.hint}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {active.length === 0 && (
        <button
          type="button"
          onClick={onNewBag}
          className="ring-primary/20 flex min-h-24 w-full items-center justify-between gap-3 rounded-2xl bg-primary p-5 text-left text-primary-foreground ring-4"
        >
          <span className="space-y-1">
            <span className="block text-lg font-semibold">Ativa o teu primeiro saco</span>
            <span className="block text-sm opacity-85">
              Nasce com QR próprio e apelido privado.
            </span>
          </span>
          <PackageOpen className="size-7 shrink-0 opacity-90" aria-hidden />
        </button>
      )}

      {nextDay && (
        <section className="ring-foreground/10 space-y-2 rounded-2xl bg-card p-5 ring-1">
          <h2 className="text-sm font-medium">Próxima ronda publicada</h2>
          <p className="text-muted-foreground text-sm">
            {weekdayLong(nextDay.weekday)} — {nextDay.entries.map((e) => e.parish_name).join(', ')}
            {nextDay.entries[0]
              ? ` (${channelLabel(nextDay.entries[0].channel)}, ${cadenceLabel(nextDay.entries[0].every_weeks)}).`
              : '.'}
          </p>
          <button
            type="button"
            onClick={onRequest}
            className="text-primary inline-flex min-h-11 items-center gap-1.5 text-sm font-medium"
          >
            <Truck className="size-4" aria-hidden />
            Fora do dia da tua freguesia? Pede a recolha
          </button>
        </section>
      )}

      <section className="ring-foreground/10 space-y-1 rounded-2xl bg-card p-5 ring-1">
        <h2 className="text-sm font-medium">O teu acumulado ambiental</h2>
        <p className="text-muted-foreground text-sm">
          {formatKg(totalKg)} entregues e pesados na viatura · {active.length}{' '}
          {active.length === 1 ? 'saco ativo' : 'sacos ativos'}. Sempre visível, verificado na
          balança.
        </p>
        <button
          type="button"
          onClick={onGoBags}
          className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-medium"
        >
          Ver os meus sacos
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </section>
    </>
  );
}

// --- Os meus sacos --------------------------------------------------------------------------------

const DECLARATIONS: Array<{ value: 'reuse' | 'recycle'; label: string; hint: string }> = [
  {
    value: 'reuse',
    label: 'Vai tudo bom — vestir de novo',
    hint: 'Roupa limpa e seca que serve para alguém',
  },
  {
    value: 'recycle',
    label: 'Vai têxtil gasto — dar a vida',
    hint: 'Esventrado ou velho, mas limpo e seco',
  },
];

function SacosTab({
  bags,
  error,
  refetch,
  onShowQr,
  onChanged,
}: {
  bags: BagActivationOut[];
  error: unknown;
  refetch: () => unknown;
  onShowQr: (bag: BagActivationOut) => void;
  onChanged: () => void;
}) {
  const [activating, setActivating] = useState(false);
  const [editing, setEditing] = useState<BagActivationOut | null>(null);

  const activate = useMutation({
    ...createBagActivationMutation(),
    onSuccess: (bag) => {
      onChanged();
      setActivating(false);
      toast(`Saco ${bag.code} ativado — cola o código no saco.`);
    },
    onError: (e) => toast(`Não foi possível ativar: ${getErrorCode(e) ?? 'erro'}`),
  });
  const update = useMutation({
    ...updateBagActivationMutation(),
    onSuccess: () => {
      onChanged();
      setEditing(null);
      toast('Saco atualizado');
    },
    onError: (e) =>
      toast(
        getErrorCode(e) === 'bag_inactive'
          ? 'O saco está desativado: reativa primeiro.'
          : 'Não foi possível guardar.',
      ),
  });
  const activateState = useMutation({
    ...activateBagMutation(),
    onSuccess: () => onChanged(),
    onError: (e) =>
      toast(
        getErrorCode(e) === 'bag_limit_reached'
          ? 'Já tens o máximo de sacos ativos.'
          : 'Não foi possível reativar.',
      ),
  });
  const deactivateState = useMutation({
    ...deactivateBagMutation(),
    onSuccess: () => onChanged(),
    onError: (e) => toast(`Não foi possível desativar: ${getErrorCode(e) ?? 'erro'}`),
  });

  if (error && bags.length === 0)
    return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-xl">Os meus sacos</h2>
        <Button type="button" onClick={() => setActivating(true)} className="min-h-11">
          <ShoppingBag aria-hidden /> Ativar saco
        </Button>
      </div>

      {activating && (
        <form
          className="ring-foreground/10 space-y-3 rounded-2xl bg-card p-5 ring-1"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            activate.mutate({
              body: {
                nickname: (data.get('nickname') as string).trim() || null,
                declaration: (data.get('declaration') as 'reuse' | 'recycle' | '') || null,
              },
            });
          }}
        >
          <p className="eyebrow text-muted-foreground text-xs tracking-wider uppercase">
            Novo saco
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="bag-nickname">Apelido (opcional, só teu)</Label>
            <Input
              id="bag-nickname"
              name="nickname"
              maxLength={80}
              placeholder="Ex.: Saco da cozinha"
              className="text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bag-declaration">«Vai no saco?» (opcional)</Label>
            <select
              id="bag-declaration"
              name="declaration"
              defaultValue=""
              className="border-input bg-background h-11 w-full rounded-md border px-3 text-base"
            >
              <option value="">Não sei ainda</option>
              {DECLARATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              Quem declara e é confirmado na triagem ganha o bónus de conformidade quando os pontos
              chegarem.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="min-h-11 flex-1" disabled={activate.isPending}>
              {activate.isPending ? 'A ativar…' : 'Ativar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => setActivating(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {bags.length === 0 ? (
        <div className="border-foreground/20 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Ainda não tens sacos. Ativa o primeiro — o QR nasce aqui na carteira e cola-se ao saco
          físico.
        </div>
      ) : (
        <ul className="space-y-3">
          {bags.map((bag) => (
            <li key={bag.id} className="ring-foreground/10 space-y-3 rounded-xl bg-card p-4 ring-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-sm">{bag.code}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    {bag.nickname ?? 'sem apelido'}
                    {bag.declaration ? ' · conteúdo declarado' : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium',
                    bag.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {bag.active ? 'ativo' : 'desativado'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="min-h-10 flex-1"
                  onClick={() => onShowQr(bag)}
                >
                  <QrCode aria-hidden /> QR
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-10 flex-1"
                  onClick={() => setEditing(bag)}
                  disabled={!bag.active}
                >
                  <Pencil aria-hidden /> Editar
                </Button>
                {bag.active ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-10 flex-1"
                    onClick={() => deactivateState.mutate({ path: { bag_id: bag.id } })}
                    disabled={deactivateState.isPending}
                  >
                    Desativar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-10 flex-1"
                    onClick={() => activateState.mutate({ path: { bag_id: bag.id } })}
                    disabled={activateState.isPending}
                  >
                    Reativar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Editar apelido/declaração: folha inferior (telemóvel primeiro). */}
      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent side="bottom" className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Editar {editing?.code}</SheetTitle>
            <SheetDescription>O apelido é privado: só tu o vês. Nunca sai daqui.</SheetDescription>
          </SheetHeader>
          {editing && (
            <form
              className="space-y-4 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                update.mutate({
                  path: { bag_id: editing.id },
                  body: {
                    nickname: (data.get('nickname') as string).trim() || null,
                    declaration: (data.get('declaration') as 'reuse' | 'recycle' | '') || null,
                  },
                });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="edit-nickname">Apelido</Label>
                <Input
                  id="edit-nickname"
                  name="nickname"
                  maxLength={80}
                  defaultValue={editing.nickname ?? ''}
                  className="text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-declaration">«Vai no saco?»</Label>
                <select
                  id="edit-declaration"
                  name="declaration"
                  defaultValue={editing.declaration ?? ''}
                  className="border-input bg-background h-11 w-full rounded-md border px-3 text-base"
                >
                  <option value="">Não sei ainda</option>
                  {DECLARATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label} — {d.hint}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="min-h-11 w-full" disabled={update.isPending}>
                Guardar
              </Button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// --- Saldo (só leitura): derivado do livro-razão, com histórico paginado ---------------------------

/** Etiqueta pt-PT de cada lançamento do livro-razão. `redemption` é reservado ao #65 — traduzido por
 * defesa, nunca deve aparecer antes de lá chegar. */
const POINT_KIND_LABEL: Record<PointEntryOut['kind'], string> = {
  gain_flat: 'Saco recolhido',
  gain_bonus: 'Bónus de conformidade',
  annulment: 'Anulação',
  redemption: 'Resgate',
};

function BalanceTab({
  balanceQuery,
}: {
  balanceQuery: UseQueryResult<PointsBalanceOut, GetDonorPointsBalanceError>;
}) {
  const { data: balance, error: balanceError, refetch: refetchBalance } = balanceQuery;
  // O histórico de pontos: dez recentes chegam ao ecrã (a lista completa é o livro-razão paginado).
  const {
    data: pontos,
    isLoading: pontosLoading,
    error: pontosError,
    refetch: refetchPontos,
  } = useQuery({
    ...listDonorPointsOptions({ query: { limit: 10, offset: 0 } }),
    refetchOnWindowFocus: false,
  });

  if (balanceError) {
    return <ErrorState error={balanceError} onRetry={() => void refetchBalance()} />;
  }
  const capShare =
    balance && balance.monthly_cap > 0
      ? Math.min(100, Math.round((balance.credited_this_month / balance.monthly_cap) * 100))
      : null;

  return (
    <>
      <div className="ring-foreground/10 space-y-2 rounded-2xl bg-card p-6 text-center ring-1">
        <p className="text-muted-foreground text-xs">
          Saldo{' '}
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px]">estimativa</span>
        </p>
        <p className="font-serif text-5xl" aria-live="polite">
          {balance ? formatNumber(balance.balance) : '…'}
        </p>
        <p className="text-muted-foreground text-sm">
          pontos · só leitura — nunca são dinheiro nem conversíveis
        </p>
        {balance && (
          <dl className="text-muted-foreground grid grid-cols-2 gap-2 pt-2 text-xs">
            <div className="rounded-xl bg-muted/60 p-2">
              <dt className="sr-only">De ganhos flat</dt>
              <dd>
                <span className="font-medium text-foreground">{formatNumber(balance.flat)}</span>{' '}
                por sacos
              </dd>
            </div>
            <div className="rounded-xl bg-muted/60 p-2">
              <dt className="sr-only">De bónus de conformidade</dt>
              <dd>
                <span className="font-medium text-foreground">{formatNumber(balance.bonus)}</span>{' '}
                de bónus
              </dd>
            </div>
          </dl>
        )}
        {balance && balance.expiring_soon > 0 && (
          <p className="rounded-xl bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
            {formatNumber(balance.expiring_soon)} pontos expiram nos próximos 30 dias (os mais
            antigos primeiro).
          </p>
        )}
        {balance && balance.expired > 0 && (
          <p className="text-muted-foreground text-xs">
            {formatNumber(balance.expired)} pontos já expiraram (12 meses por ganho).
          </p>
        )}
      </div>

      {/* Teto mensal (configurável, estimativa): o que transborda é recusado — nunca adiado. */}
      {balance && (
        <div className="ring-foreground/10 space-y-2 rounded-2xl bg-card p-5 text-sm ring-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-medium">Teto deste mês</p>
            <p className="text-muted-foreground text-xs">
              {formatNumber(balance.credited_this_month)}
              {balance.monthly_cap > 0 ? ` de ${formatNumber(balance.monthly_cap)}` : ''}{' '}
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px]">estimativa</span>
            </p>
          </div>
          {capShare != null && (
            <div
              role="progressbar"
              aria-valuenow={capShare}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Ganhos do mês em relação ao teto mensal"
              className="bg-muted h-2 rounded-full"
            >
              <div className="bg-primary h-2 rounded-full" style={{ width: `${capShare}%` }} />
            </div>
          )}
          {balance.monthly_cap === 0 && (
            <p className="text-muted-foreground text-xs">Este mês não tem teto de ganhos.</p>
          )}
        </div>
      )}

      <div className="ring-foreground/10 space-y-2 rounded-2xl bg-card p-5 text-sm ring-1">
        <p className="font-medium">Como se ganha</p>
        <ul className="text-muted-foreground space-y-1.5">
          {balance && (
            <>
              <li>
                +{formatNumber(balance.gain_flat_points)} por saco ativado, recolhido e pesado (nunca
                por kg — estimativa)
              </li>
              <li>
                +{formatNumber(balance.bonus_conformity_points)} de bónus quando a triagem confirma a
                tua declaração (estimativa)
              </li>
            </>
          )}
          <li>
            1 000 pontos ≈ 5 € <span className="text-foreground">de donativo</span> a IPSS — a
            âncora € é o valor do donativo, nunca o valor dos pontos (estimativa)
          </li>
        </ul>
        <Link
          to="/cidadao"
          search={{ tab: 'catalogo' }}
          className="text-primary inline-flex min-h-11 items-center gap-1.5 text-sm font-medium"
        >
          <Gift className="size-4" aria-hidden />
          Ver o catálogo e resgatar
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>

      {/* Histórico de pontos: o livro-razão do próprio, o mais recente primeiro. */}
      <section className="space-y-2">
        <h2 className="font-serif text-xl">Movimentos</h2>
        {pontosError ? (
          <ErrorState error={pontosError} onRetry={() => void refetchPontos()} />
        ) : pontosLoading ? (
          <div className="ring-foreground/10 rounded-2xl bg-card p-8 ring-1" role="status">
            <p className="text-muted-foreground text-center text-sm">A carregar movimentos…</p>
          </div>
        ) : !pontos || pontos.items.length === 0 ? (
          <EmptyState
            title="Ainda sem movimentos"
            description="Quando a viatura pesar um saco teu, o ganho aparece aqui — e o bónus quando a triagem confirma a declaração."
          />
        ) : (
          <ul className="space-y-2">
            {pontos.items.map((row) => (
              <PointEntryRow key={row.id} row={row} />
            ))}
          </ul>
        )}
        {pontos && pontos.total > pontos.items.length && (
          <p className="text-muted-foreground px-2 text-xs">
            A mostrar {pontos.items.length} de {formatNumber(pontos.total)} movimentos.
          </p>
        )}
      </section>

      <p className="text-muted-foreground px-2 text-xs">
        Os pontos expiram 12 meses por ganho, os mais antigos primeiro. Apagar a conta perde o saldo
        — lotes e passaportes ficam (nunca tiveram doador).
      </p>
    </>
  );
}

function PointEntryRow({ row }: { row: PointEntryOut }) {
  const gain = row.amount > 0;
  return (
    <li className="ring-foreground/10 rounded-xl bg-card p-4 ring-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{POINT_KIND_LABEL[row.kind]}</p>
        <p
          className={cn(
            'font-mono text-sm',
            gain ? 'text-primary font-medium' : 'text-destructive',
          )}
        >
          {gain ? '+' : ''}
          {formatNumber(row.amount)}
        </p>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        {formatDate(row.created_at)}
        {row.bag_code ? ` · saco ${row.bag_code}` : ''}
        {row.lot_code ? (
          <>
            {' · '}
            <Link
              to="/passport/$code"
              params={{ code: row.lot_code }}
              className="text-primary underline-offset-2 hover:underline"
            >
              lote {row.lot_code}
            </Link>
          </>
        ) : null}
        {row.expires_at ? ` · expira ${formatDate(row.expires_at)}` : ''}
      </p>
      {row.reason && (
        <p className="text-muted-foreground mt-1 text-xs italic">Motivo: {row.reason}</p>
      )}
    </li>
  );
}

// --- Histórico ------------------------------------------------------------------------------------

function HistoricoTab({ history }: { history: CollectionHistoryOut[] }) {
  if (history.length === 0) {
    return (
      <div className="border-foreground/20 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Ainda sem recolhas. Quando a viatura levar um saco teu, ele aparece aqui ligado ao
        passaporte público.
      </div>
    );
  }
  return (
    <>
      <h2 className="font-serif text-xl">Histórico</h2>
      <ul className="space-y-2">
        {history.map((row) => (
          <li key={row.bag_id} className="ring-foreground/10 rounded-xl bg-card p-4 ring-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-mono text-sm">{row.bag_code}</p>
              {row.lot_code ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary font-medium">
                  recolhido
                </span>
              ) : (
                <span className="text-muted-foreground rounded-full bg-muted px-2.5 py-1 text-[11px]">
                  em casa
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {row.nickname ? `«${row.nickname}» · ` : ''}
              {row.declaration === 'reuse'
                ? 'vestir de novo'
                : row.declaration === 'recycle'
                  ? 'dar a vida'
                  : 'sem declaração'}
              {row.weight_kg != null ? ` · ${formatKg(row.weight_kg)}` : ''}
            </p>
            {row.lot_code && (
              <Link
                to="/passport/$code"
                params={{ code: row.lot_code }}
                className="text-primary mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-medium"
              >
                <History className="size-4" aria-hidden />
                Passaporte do lote {row.lot_code}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

// --- Folhas do QR ---------------------------------------------------------------------------------

function AccountQrSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qr = useQuery({ ...getDonorAccountQrOptions(), enabled: open });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>QR da conta</SheetTitle>
          <SheetDescription>
            Mostra à viatura para entregar à mão: o scan credita na tua conta sem saco da
            plataforma. O QR é só teu — quem o tem, credita em ti; nunca dá entrada na conta.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 pt-2 text-center">
          {qr.isPending ? (
            <p className="text-muted-foreground py-8">A gerar o QR…</p>
          ) : qr.data ? (
            <>
              <div
                className="mx-auto w-48 [&>svg]:h-auto [&>svg]:w-full"
                role="img"
                aria-label={`QR da conta ${qr.data.code}`}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG do QR gerado pela nossa API (segno), nunca conteúdo de utilizador
                dangerouslySetInnerHTML={{ __html: qr.data.svg }}
              />
              <p className="font-mono text-sm">{qr.data.code}</p>
            </>
          ) : (
            <p className="text-muted-foreground py-8 text-sm">Não foi possível gerar o QR.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BagQrSheet({ bag, onClose }: { bag: BagActivationOut | null; onClose: () => void }) {
  const qr = useQuery({
    ...getBagQrOptions({ path: { bag_id: bag?.id ?? '' } }),
    enabled: bag !== null,
  });
  return (
    <Sheet open={bag !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>QR do saco {bag?.code}</SheetTitle>
          <SheetDescription>
            Cola o código no saco físico ou mostra este QR à viatura: é ele que liga o saco ao teu
            histórico e ao crédito. O apelido nunca sai daqui.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 pt-2 text-center">
          {qr.isPending ? (
            <p className="text-muted-foreground py-8">A gerar o QR…</p>
          ) : qr.data ? (
            <>
              <div
                className="mx-auto w-48 [&>svg]:h-auto [&>svg]:w-full"
                role="img"
                aria-label={`QR do saco ${qr.data.code}`}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG do QR gerado pela nossa API (segno), nunca conteúdo de utilizador
                dangerouslySetInnerHTML={{ __html: qr.data.svg }}
              />
              <p className="font-mono text-sm">{qr.data.code}</p>
            </>
          ) : (
            <p className="text-muted-foreground py-8 text-sm">Não foi possível gerar o QR.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
