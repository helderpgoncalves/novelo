import { CheckCircle2, ChevronRight, Circle, PackageOpen, QrCode, Truck } from 'lucide-react';
import type { BagActivationOut, CollectionHistoryOut } from '@/client';
import { type agendaByDay, cadenceLabel, channelLabel } from '@/features/citizen/agenda';
import { milestones, onboardingCollapsed } from '@/features/citizen/onboarding';
import { formatKg, formatNumber } from '@/lib/format';
import { weekdayLong } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// Strings em pt-PT de propósito: a área do cidadão é só portuguesa no MVP (decisão da spec #54).

// --- Início ---------------------------------------------------------------------------------------

export function HomeTab({
  bags,
  history,
  agenda,
  balanceValue,
  onShowAccountQr,
  onNewBag,
  onRequest,
  onGoBags,
}: {
  bags: BagActivationOut[];
  history: CollectionHistoryOut[];
  agenda: ReturnType<typeof agendaByDay>;
  balanceValue: number | undefined;
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
            {balanceValue != null ? formatNumber(balanceValue) : '—'}
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
