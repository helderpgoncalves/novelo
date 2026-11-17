import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { BadgeCheck, Gift, HandHeart, Leaf, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { CatalogItemPublic, RedemptionOut } from '@/client';
import {
  createRedemptionMutation,
  getDonorCatalogOptions,
  listDonorCampaignsOptions,
  listDonorRedemptionsOptions,
} from '@/client/@tanstack/react-query.gen';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  catalogItemKindLabel,
  donationValueNote,
  redeemBlocked,
  redemptionStateLabel,
} from '@/features/cidadao/catalogo';
import { getErrorCode } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { formatDate } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// Strings em pt-PT de propósito: a área do cidadão é só portuguesa no MVP (decisão da spec #54).

const KIND_ICON: Record<CatalogItemPublic['kind'], typeof Gift> = {
  ipss_donation: HandHeart,
  partner_prize: Gift,
  environmental: Leaf,
};

/**
 * O separador «Catálogo» da carteira (#65): três prateleiras, o resgate por código pseudónimo e
 * os meus códigos. A âncora € aparece SÓ como valor do donativo — os pontos nunca valem dinheiro.
 */
export function CatalogoTab({ balance }: { balance: number }) {
  const queryClient = useQueryClient();
  const [redeeming, setRedeeming] = useState<CatalogItemPublic | null>(null);
  const [redemption, setRedemption] = useState<RedemptionOut | null>(null);

  const {
    data: items,
    error: catalogError,
    refetch: refetchCatalog,
  } = useSuspenseQuery(getDonorCatalogOptions());
  // Campanha e códigos são secundários: o catálogo desenha sem eles.
  const { data: campaigns } = useQuery({
    ...listDonorCampaignsOptions(),
    refetchOnWindowFocus: false,
  });
  const {
    data: myCodes,
    isLoading: codesLoading,
    error: codesError,
    refetch: refetchCodes,
  } = useQuery({ ...listDonorRedemptionsOptions(), refetchOnWindowFocus: false });

  const redeem = useMutation({
    ...createRedemptionMutation(),
    onSuccess: (out) => {
      setRedeeming(null);
      setRedemption(out);
      void queryClient.invalidateQueries({ queryKey: getDonorCatalogOptions().queryKey });
      void queryClient.invalidateQueries({ queryKey: listDonorRedemptionsOptions().queryKey });
    },
    onError: (e) => {
      setRedeeming(null);
      const code = getErrorCode(e);
      toast(
        code === 'insufficient_points'
          ? 'O saldo não chega para este resgate.'
          : code === 'donation_cap_reached'
            ? 'O teto de donativos deste mês já foi atingido — cresce com o que pesas na balança.'
            : code === 'out_of_stock'
              ? 'Esgotou-se entretanto — escolhe outro.'
              : code === 'catalog_item_inactive'
                ? 'Este item já não está disponível.'
                : `Não foi possível resgatar (${code ?? 'erro'}).`,
      );
    },
  });

  const campaign = campaigns?.[0];

  return (
    <>
      {campaign && (
        <div className="bg-primary/10 ring-primary/20 space-y-1 rounded-2xl p-4 ring-1">
          <p className="text-primary flex items-center gap-1.5 text-sm font-medium">
            <BadgeCheck className="size-4" aria-hidden />
            Campanha: {campaign.name}
          </p>
          {campaign.description && (
            <p className="text-muted-foreground text-xs">{campaign.description}</p>
          )}
        </div>
      )}

      {catalogError ? (
        <ErrorState error={catalogError} onRetry={() => void refetchCatalog()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="O catálogo está a arrancar"
          description="Donativos a IPSS, prémios de parceiros locais e o teu acumulado ambiental vão aparecer aqui. Vai acumulando pontos por saco recolhido."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            const blocked = redeemBlocked(item, balance);
            const note = donationValueNote(item);
            return (
              <li
                key={item.id}
                className="ring-foreground/10 space-y-3 rounded-2xl bg-card p-5 ring-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] tracking-wide uppercase">
                      <Icon className="size-3.5" aria-hidden />
                      {catalogItemKindLabel(item.kind)}
                      {item.partner_name ? ` · ${item.partner_name}` : ''}
                    </p>
                    <h3 className="font-serif text-lg leading-snug">{item.name}</h3>
                    {item.description && (
                      <p className="text-muted-foreground text-sm">{item.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-serif text-2xl">{formatNumber(item.points_cost)}</p>
                    <p className="text-muted-foreground text-[11px]">pontos</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-muted-foreground text-xs">
                    {note ? (
                      <>
                        Vale um <span className="text-foreground font-medium">{note}</span> — a
                        âncora € é o valor do donativo, nunca o valor dos pontos.
                      </>
                    ) : item.kind === 'partner_prize' ? (
                      'O parceiro valida o código e nunca sabe quem tu és.'
                    ) : (
                      'Conquista verificada, sem dinheiro ao barulho.'
                    )}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11 min-w-24"
                    disabled={blocked !== null || redeem.isPending}
                    onClick={() => setRedeeming(item)}
                  >
                    {blocked ?? 'Resgatar'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Os meus códigos: cada um é um bilhete — pendente até o parceiro o validar. */}
      <section className="space-y-2 pt-2">
        <h2 className="font-serif text-xl">Os meus códigos</h2>
        {codesError ? (
          <ErrorState error={codesError} onRetry={() => void refetchCodes()} />
        ) : codesLoading ? (
          <div className="ring-foreground/10 rounded-2xl bg-card p-8 ring-1" role="status">
            <p className="text-muted-foreground text-center text-sm">A carregar códigos…</p>
          </div>
        ) : !myCodes || myCodes.length === 0 ? (
          <div className="border-foreground/20 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Ainda não tens códigos. Resgata algo do catálogo — o código nasce aqui e é a única coisa
            que o parceiro vê.
          </div>
        ) : (
          <ul className="space-y-2">
            {myCodes.map((r) => (
              <RedemptionRow key={r.id} redemption={r} />
            ))}
          </ul>
        )}
      </section>

      <ConfirmSheet
        item={redeeming}
        balance={balance}
        pending={redeem.isPending}
        onClose={() => setRedeeming(null)}
        onConfirm={() => redeeming && redeem.mutate({ body: { item_id: redeeming.id } })}
      />
      <RedeemedSheet redemption={redemption} onClose={() => setRedemption(null)} />
    </>
  );
}

function RedemptionRow({ redemption: r }: { redemption: RedemptionOut }) {
  const validated = r.state === 'validated';
  return (
    <li className="ring-foreground/10 rounded-xl bg-card p-4 ring-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">{r.item_name}</p>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium',
            validated ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          {redemptionStateLabel(r)}
        </span>
      </div>
      <p className="mt-1 flex items-center gap-2">
        <ScanLine className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <span className="font-mono text-base tracking-wider">{r.code}</span>
        <span className="text-muted-foreground text-xs">
          −{formatNumber(r.points_spent)} pontos
        </span>
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        {formatDate(r.created_at)}
        {validated ? ' · já validado e entregue' : ' · mostra este código ao parceiro ou na IPSS'}
      </p>
    </li>
  );
}

function ConfirmSheet({
  item,
  balance,
  pending,
  onClose,
  onConfirm,
}: {
  item: CatalogItemPublic | null;
  balance: number;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const note = item ? donationValueNote(item) : null;
  return (
    <Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>Resgatar {item?.name}</SheetTitle>
          <SheetDescription>
            Custa {item ? formatNumber(item.points_cost) : ''} pontos e o código nasce já — é a
            única coisa que o parceiro vê. Os pontos mais antigos saem primeiro.
          </SheetDescription>
        </SheetHeader>
        {item && (
          <div className="space-y-4 pt-2">
            <dl className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-muted/60 p-3">
                <dt>Saldo depois</dt>
                <dd className="text-foreground text-sm font-medium">
                  {formatNumber(balance - item.points_cost)} pontos
                </dd>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <dt>{note ? 'Valor do donativo' : 'Recebe'}</dt>
                <dd className="text-foreground text-sm font-medium">
                  {note ??
                    (item.partner_name ? `entrega no ${item.partner_name}` : 'na tua carteira')}
                </dd>
              </div>
            </dl>
            <Button
              type="button"
              className="min-h-11 w-full"
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? 'A resgatar…' : 'Confirmar resgate'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RedeemedSheet({
  redemption: r,
  onClose,
}: {
  redemption: RedemptionOut | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={r !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>Código gerado</SheetTitle>
          <SheetDescription>
            Apresenta este código ao parceiro ou na IPSS. Quem o valida nunca sabe quem tu és — e o
            pagamento só acontece quando o código é apresentado.
          </SheetDescription>
        </SheetHeader>
        {r && (
          <div className="space-y-3 pt-2 text-center">
            <p className="font-mono text-3xl tracking-[0.2em]" aria-live="polite">
              {r.code}
            </p>
            <p className="text-muted-foreground text-sm">
              {r.item_name} · −{formatNumber(r.points_spent)} pontos
            </p>
            <p className="text-muted-foreground rounded-xl bg-muted/60 p-3 text-xs">
              Guarda-o na carteira («Os meus códigos») até ser validado. Validado = entregue e pago,
              uma única vez.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
