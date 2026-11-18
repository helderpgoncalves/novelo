import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Bell, BellOff, CalendarDays, CheckCircle2, HandHeart, Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { StopNoticeOut } from '@/client';
import {
  cancelLocalNoticeMutation,
  createLocalNoticeMutation,
  getActiveLocalNoticeOptions,
  getLocalAccountOptions,
  getLocalReportOptions,
  getPublicLocalCertificateOptions,
  listLocalLotsOptions,
  setLocalCertificateMutation,
} from '@/client/@tanstack/react-query.gen';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  DestinationBar,
  DestinationLegend,
  type DestinationSplit,
} from '@/features/local-area/destination-bar';
import { LocalRequestsSheet } from '@/features/local-area/local-requests-sheet';
import { getErrorCode } from '@/lib/errors';
import { formatKg } from '@/lib/format';
import { weightSourceLabel } from '@/lib/lots';

// Strings em pt-PT de propósito: a área do local é só portuguesa no MVP (decisão da spec #54).

/** A área do local, «Duas portas» (protótipo wayfinder #51): o aviso é o herói; rondas e certificado
 * ficam atrás de dois portões grandes, em folhas inferiores — para quem abre a app duas vezes por mês. */
export function LocalAreaPage() {
  const { data: account } = useSuspenseQuery(getLocalAccountOptions());
  const { data: current } = useSuspenseQuery(getActiveLocalNoticeOptions());
  const [door, setDoor] = useState<'aviso' | 'rondas' | 'certificado' | 'pedido' | null>(null);
  const kindLabel = account.kind === 'b2b' ? 'Produtor B2B' : 'Local assistido';

  return (
    <div className="bg-background min-h-dvh pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <div className="mx-auto max-w-lg space-y-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16">
        <header className="space-y-1">
          <p className="text-muted-foreground text-xs tracking-wider uppercase">Conta de local</p>
          <h1 className="font-serif text-3xl leading-tight text-balance">
            {account.locality_name ?? 'O nosso local'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {kindLabel}
            {account.parish_name ? ` · ${account.parish_name}` : ''}
          </p>
        </header>

        {/* Porta 1 — o herói: a única escrita da conta. */}
        <button
          type="button"
          onClick={() => setDoor('aviso')}
          className="ring-primary/20 flex min-h-28 w-full flex-col items-start justify-between gap-3 rounded-2xl bg-primary p-5 text-left text-primary-foreground ring-4 transition-transform active:scale-[0.99] sm:flex-row sm:items-center"
        >
          <span className="space-y-1">
            <span className="block text-xl font-semibold">
              {current?.notice ? 'Aviso enviado — sacos prontos' : 'Tem sacos prontos?'}
            </span>
            <span className="block text-sm opacity-85">
              {current?.notice
                ? 'A viatura garante paragem. Toque para ver ou anular.'
                : 'Diga-nos — a viatura de têxtil garante a paragem.'}
            </span>
          </span>
          {current?.notice ? (
            <BellOff className="size-8 shrink-0 opacity-90" aria-hidden />
          ) : (
            <Bell className="size-8 shrink-0 opacity-90" aria-hidden />
          )}
        </button>

        {/* Porta 2 — leitura: o que o local entregou. */}
        <button
          type="button"
          onClick={() => setDoor('rondas')}
          className="ring-foreground/10 flex min-h-24 w-full items-center justify-between gap-3 rounded-2xl bg-card p-5 text-left ring-1 transition-transform active:scale-[0.99]"
        >
          <span className="flex items-center gap-4">
            <CalendarDays className="text-muted-foreground size-7 shrink-0" aria-hidden />
            <span className="space-y-0.5">
              <span className="block text-lg font-semibold">As nossas rondas</span>
              <span className="text-muted-foreground block text-sm">
                Lotes por paragem, com o peso medido à porta
              </span>
            </span>
          </span>
        </button>

        {/* Porta 3 — certificado público opt-in. */}
        <button
          type="button"
          onClick={() => setDoor('certificado')}
          className="ring-foreground/10 flex min-h-20 w-full items-center justify-between gap-3 rounded-2xl bg-card p-5 text-left ring-1 transition-transform active:scale-[0.99]"
        >
          <span className="flex items-center gap-4">
            <Share2 className="text-muted-foreground size-6 shrink-0" aria-hidden />
            <span className="space-y-0.5">
              <span className="block font-semibold">Certificado público</span>
              <span className="text-muted-foreground block text-sm">
                {account.certificate_opt_in
                  ? 'A partilhar com a comunidade'
                  : 'Desligado — nada é público'}
              </span>
            </span>
          </span>
        </button>

        {/* Porta 4 — pedir recolha (#60): a morada é a institucional; acima de 20 sacos é recolha especial. */}
        <button
          type="button"
          onClick={() => setDoor('pedido')}
          className="ring-foreground/10 flex min-h-20 w-full items-center justify-between gap-3 rounded-2xl bg-card p-5 text-left ring-1 transition-transform active:scale-[0.99]"
        >
          <span className="flex items-center gap-4">
            <HandHeart className="text-muted-foreground size-6 shrink-0" aria-hidden />
            <span className="space-y-0.5">
              <span className="block font-semibold">Pedir recolha</span>
              <span className="text-muted-foreground block text-sm">
                Marque um dia com a viatura de têxtil (até 20 sacos)
              </span>
            </span>
          </span>
        </button>

        <p className="text-muted-foreground text-sm">
          A conta pertence ao local, nunca a uma pessoa: quem convida e revoga é a equipa Novelo.
        </p>
      </div>

      <Sheet open={door === 'aviso'} onOpenChange={(open) => setDoor(open ? 'aviso' : null)}>
        <SheetContent side="bottom" className="px-4 pb-8">
          <SheetHeader className="text-left">
            <SheetTitle>Avisar sacos prontos</SheetTitle>
            <SheetDescription>
              A única ação de escrita da conta. O aviso garante que a viatura para neste local.
            </SheetDescription>
          </SheetHeader>
          <AvisoForm activeNotice={current?.notice ?? null} onDone={() => setDoor(null)} />
        </SheetContent>
      </Sheet>

      <Sheet open={door === 'rondas'} onOpenChange={(open) => setDoor(open ? 'rondas' : null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto px-4 pb-8">
          <SheetHeader className="text-left">
            <SheetTitle>As nossas rondas</SheetTitle>
            <SheetDescription>
              Cada paragem pesa os sacos à porta; a triagem mede os destinos a jusante.
            </SheetDescription>
          </SheetHeader>
          <RondasSheet />
        </SheetContent>
      </Sheet>

      <Sheet
        open={door === 'certificado'}
        onOpenChange={(open) => setDoor(open ? 'certificado' : null)}
      >
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto px-4 pb-8">
          <SheetHeader className="text-left">
            <SheetTitle>Certificado público</SheetTitle>
            <SheetDescription>
              Opt-in: só é público se o local decidir partilhar. Sem doadores, sem CO₂.
            </SheetDescription>
          </SheetHeader>
          <CertificateSheet optIn={account.certificate_opt_in} accountId={account.id} />
        </SheetContent>
      </Sheet>

      <Sheet open={door === 'pedido'} onOpenChange={(open) => setDoor(open ? 'pedido' : null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto px-4 pb-8">
          <SheetHeader className="text-left">
            <SheetTitle>Pedir recolha</SheetTitle>
            <SheetDescription>
              A morada é a institucional do local. Com 48 horas de margem, o dia fica garantido como
              os avisos.
            </SheetDescription>
          </SheetHeader>
          <LocalRequestsSheet />
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** O aviso: contador de sacos (sinal de procura, não contabilidade — o peso verdadeiro é o da balança),
 * recado opcional para a equipa e o ativo com «Anular». */
function AvisoForm({
  activeNotice,
  onDone,
}: {
  activeNotice: StopNoticeOut | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getActiveLocalNoticeOptions().queryKey });
    void queryClient.invalidateQueries({ queryKey: getLocalAccountOptions().queryKey });
  };
  const create = useMutation({
    ...createLocalNoticeMutation(),
    onSuccess: () => {
      invalidate();
      onDone();
      toast('Aviso enviado — a viatura garante a paragem');
    },
    onError: (error) => toast(`Não foi possível avisar: ${getErrorCode(error) ?? 'erro'}`),
  });
  const cancel = useMutation({
    ...cancelLocalNoticeMutation(),
    onSuccess: () => {
      invalidate();
      onDone();
      toast('Aviso anulado');
    },
    onError: (error) => toast(`Não foi possível anular: ${getErrorCode(error) ?? 'erro'}`),
  });
  const [bags, setBags] = useState(activeNotice?.bag_count ?? 2);
  const [note, setNote] = useState('');

  if (activeNotice) {
    return (
      <div className="mt-4 space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4">
          <CheckCircle2 className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="font-medium">
              Aviso ativo
              {activeNotice.bag_count != null &&
                `: ${activeNotice.bag_count} ${activeNotice.bag_count === 1 ? 'saco pronto' : 'sacos prontos'}`}
            </p>
            {activeNotice.note && <p className="text-sm">{activeNotice.note}</p>}
            <p className="text-muted-foreground text-sm">
              Anular não apaga o histórico; pode avisar outra vez.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="min-h-11 w-full"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate({})}
        >
          {cancel.isPending ? 'A anular…' : 'Anular aviso'}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ body: { bag_count: bags, note: note.trim() || null } });
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="bags" className="text-sm font-medium">
          Sacos prontos
        </Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            aria-label="Menos um saco"
            disabled={bags <= 1}
            onClick={() => setBags((n) => Math.max(1, n - 1))}
          >
            −
          </Button>
          <Input
            id="bags"
            readOnly
            value={bags}
            inputMode="numeric"
            aria-label="Número de sacos"
            className="h-10 w-14 text-center font-semibold tabular-nums"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            aria-label="Mais um saco"
            disabled={bags >= 50}
            onClick={() => setBags((n) => Math.min(50, n + 1))}
          >
            +
          </Button>
        </div>
      </div>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={240}
        rows={2}
        placeholder="Nota para a equipa (opcional) — ex.: sala 12, porta dos fundos"
        className="min-h-11 text-base"
      />
      <Button type="submit" className="min-h-11 w-full" disabled={create.isPending}>
        {create.isPending ? 'A avisar…' : 'Avisar a viatura'}
      </Button>
    </form>
  );
}

/** As rondas: total do relatório + um cartão por lote (paragem), com a etiqueta de peso certo. */
function RondasSheet() {
  const { data: report } = useSuspenseQuery(getLocalReportOptions());
  const { data: lots } = useSuspenseQuery(listLocalLotsOptions());
  const split: DestinationSplit = {
    reuse: report.reuse_kg,
    recycle: report.recycle_kg,
    reject: report.reject_kg,
  };
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl bg-muted/40 p-4">
        <p className="text-2xl font-semibold tabular-nums">{formatKg(report.weight_kg)}</p>
        <p className="text-muted-foreground text-sm">
          em {report.lots} {report.lots === 1 ? 'paragem' : 'paragens'}
          {report.lots_in_triage > 0 &&
            ` · ${report.lots_in_triage} ${report.lots_in_triage === 1 ? 'paragem' : 'paragens'} em triagem`}
          {' · '}
          {report.measured_lots === report.lots
            ? 'tudo medido na balança'
            : `${report.measured_lots} ${report.measured_lots === 1 ? 'paragem medida' : 'paragens medidas'}, resto estimado`}
        </p>
        {report.sorted_lots > 0 ? (
          <>
            <DestinationBar split={split} className="mt-3" />
            <DestinationLegend split={split} className="mt-2" />
          </>
        ) : (
          <p className="text-muted-foreground mt-2 text-xs">
            Destinos medidos pela triagem — nada triado por agora.
          </p>
        )}
      </div>
      {lots.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Ainda não há paragens neste local — a primeira ronda escreve aqui a história.
        </p>
      ) : (
        <ul className="space-y-3">
          {lots.map((lot) => (
            <li key={lot.code} className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
              <div className="flex items-baseline justify-between gap-3">
                <a
                  href={`/passport/${lot.code}`}
                  className="text-primary font-medium hover:underline"
                >
                  {lot.code}
                </a>
                <p className="font-semibold tabular-nums">
                  {formatKg(lot.weight_kg)}
                  <span className="text-muted-foreground ml-2 text-xs font-normal">
                    ({weightSourceLabel[lot.weight_source ?? 'estimated']()})
                  </span>
                </p>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {lot.items} {lot.items === 1 ? 'peça' : 'peças'} · {lot.units}{' '}
                {lot.units === 1 ? 'saco pesado' : 'sacos pesados'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** O certificado: interruptor opt-in, pré-visualização e link público quando ligado. */
function CertificateSheet({ optIn, accountId }: { optIn: boolean; accountId: string }) {
  const queryClient = useQueryClient();
  const [shared, setShared] = useState(optIn);
  const save = useMutation({
    ...setLocalCertificateMutation(),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: getLocalAccountOptions().queryKey }),
    onError: (error) => {
      setShared(optIn);
      toast(`Não foi possível guardar: ${getErrorCode(error) ?? 'erro'}`);
    },
  });
  const url = shared ? `${window.location.origin}/certificado/${accountId}` : null;
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-xl bg-muted/40 p-4">
        <Label htmlFor="cert-toggle" className="text-sm font-medium">
          Publicar o certificado do local
          <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
            {url ?? 'Desligado — nada é público'}
          </span>
        </Label>
        <Switch
          id="cert-toggle"
          checked={shared}
          onCheckedChange={(next) => {
            setShared(next);
            save.mutate({ body: { opt_in: next } });
          }}
          aria-label="Publicar certificado"
        />
      </div>
      {shared ? (
        <>
          <CertificatePreview accountId={accountId} />
          <Button
            variant="outline"
            className="min-h-11 w-full"
            onClick={() => {
              if (url) void navigator.clipboard?.writeText(url);
              toast('Link copiado para partilhar');
            }}
          >
            Copiar link para partilhar
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Ao ligar, aparece uma página pública com os kg medidos por destino neste local.
          Pré-visualize antes de partilhar — pode desligar quando quiser.
        </p>
      )}
    </div>
  );
}

function CertificatePreview({ accountId }: { accountId: string }) {
  const {
    data: cert,
    isPending,
    error,
  } = useQuery(getPublicLocalCertificateOptions({ path: { account_id: accountId } }));
  if (isPending) {
    return <p className="text-muted-foreground text-sm">A preparar a pré-visualização…</p>;
  }
  // Desligado (404 `certificate_not_public`) ou erro: a pré-visualização é o aviso de que nada é público.
  if (error || !cert) {
    return (
      <p className="text-muted-foreground text-sm">
        Desligado — a página pública não existe enquanto o interruptor estiver abaixo.
      </p>
    );
  }
  const split: DestinationSplit = {
    reuse: cert.reuse_kg,
    recycle: cert.recycle_kg,
    reject: cert.reject_kg,
  };
  const pctSplit: DestinationSplit = {
    reuse: cert.reuse_pct,
    recycle: cert.recycle_pct,
    reject: cert.reject_pct,
  };
  return (
    <div className="bg-card ring-foreground/10 space-y-4 rounded-xl border p-5 ring-1">
      <div>
        <p className="text-muted-foreground text-xs tracking-wider uppercase">
          Certificado de recolha · rede Novelo
        </p>
        <p className="font-serif mt-1 text-2xl text-balance">{cert.locality_name}</p>
        {cert.parish_name && <p className="text-muted-foreground text-sm">{cert.parish_name}</p>}
      </div>
      <div className="space-y-2">
        <p className="text-3xl font-semibold tabular-nums">{formatKg(cert.weight_kg)}</p>
        <p className="text-muted-foreground text-sm">
          de têxtil recolhido e pesado à porta, em {cert.stops}{' '}
          {cert.stops === 1 ? 'paragem' : 'paragens'}
        </p>
      </div>
      {cert.stops > 0 && <DestinationBar split={split} />}
      <DestinationLegend split={split} pct={pctSplit} />
      <p className="text-muted-foreground text-xs">
        Valores medidos na pesagem de cada paragem; destinos pela triagem. Sem dados de doadores.
        Operação da Vitrus · Guimarães.
      </p>
    </div>
  );
}
