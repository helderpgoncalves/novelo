import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Download, ExternalLink, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ConsentStateOut, DeletionPreviewOut } from '@/client';
import {
  deleteDonorAccountMutation,
  exportDonorAccountOptions,
  getDonorConsentsOptions,
  getDonorDeletionPreviewOptions,
  getPublicPrivacyPolicyOptions,
  setDonorConsentMutation,
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
import { losses, timelineRows } from '@/features/citizen/privacy';
import { getErrorCode } from '@/lib/errors';
import { formatNumber } from '@/lib/format';

// Strings em pt-PT de propósito: a área do cidadão é só portuguesa no MVP (decisão da spec #54).

/** O separador «Privacidade» da carteira (#66): consentimentos em duas camadas, política, exportação
 * e apagamento da conta — com as três proteções do ADR antes de confirmar. */
export function PrivacyTab() {
  const policy = useQuery({ ...getPublicPrivacyPolicyOptions(), staleTime: 5 * 60_000 });

  return (
    <>
      <section className="ring-foreground/10 space-y-3 rounded-2xl bg-card p-5 ring-1">
        <h2 className="inline-flex items-center gap-2 font-serif text-xl">
          <ShieldCheck className="text-primary size-5" aria-hidden />A tua privacidade
        </h2>
        <p className="text-muted-foreground text-sm">
          O essencial da conta é contrato (o crédito por saco não precisa de consentimento). O que
          depende de SIM teu está aqui, desligado por defeito: podes dar e retirar quando quiseres —
          é tão fácil retirar como dar, e cada decisão fica registada (com a versão da política que
          viste).
        </p>
        <ConsentRow purpose="marketing" />
        <ConsentRow purpose="partnerships" />
        {policy.data && (
          <p className="text-muted-foreground text-xs">
            Política em vigor: versão {policy.data.version} · responsável pelo tratamento: a Vitrus.
          </p>
        )}
      </section>

      <Link
        to="/politica-dados"
        className="ring-foreground/10 flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-card p-4 text-sm ring-1"
      >
        <span>
          <span className="block font-medium">Política de privacidade por finalidades</span>
          <span className="text-muted-foreground block text-xs">
            O que guardamos, porquê e até quando — prazos por categoria
          </span>
        </span>
        <ExternalLink className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </Link>

      <ExportCard />
      <DeleteAccountCard />
    </>
  );
}

// --- consentimentos: duas camadas separadas, registo auditável --------------------------------------

const CONSENT_COPY: Record<ConsentStateOut['purpose'], { title: string; hint: string }> = {
  marketing: {
    title: 'Novidades da Vitrus (marketing)',
    hint: 'Emails sobre a rede de recolha e a tua carteira. Nunca dentro dos termos; retirar é um toque.',
  },
  partnerships: {
    title: 'Ofertas de parceiros',
    hint: 'Prémios do catálogo de comerciantes locais. Zero partilha por defeito: o parceiro nunca recebe os teus dados — só vê o código do resgate.',
  },
};

function ConsentRow({ purpose }: { purpose: ConsentStateOut['purpose'] }) {
  const queryClient = useQueryClient();
  const copy = CONSENT_COPY[purpose];
  const { data, isPending, error, refetch } = useQuery(getDonorConsentsOptions());
  const save = useMutation({
    ...setDonorConsentMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getDonorConsentsOptions().queryKey });
      toast('Decisão registada — fica no teu histórico de consentimentos.');
    },
    onError: (e) => toast(`Não foi possível registar: ${getErrorCode(e) ?? 'erro'}`),
  });

  if (error) return <ConsentRowError onRetry={() => void refetch()} />;
  const mine = data?.items.find((c) => c.purpose === purpose);
  const granted = mine?.granted ?? false;

  return (
    <div className="border-foreground/10 flex items-start justify-between gap-4 border-t pt-3 first:border-0 first:pt-0">
      <div className="min-w-0">
        <Label htmlFor={`consent-${purpose}`} className="text-sm font-medium">
          {copy.title}
        </Label>
        <p className="text-muted-foreground mt-1 text-xs">{copy.hint}</p>
        {mine?.updated_at && (
          <p className="text-muted-foreground mt-1 text-[11px]">
            Última decisão: {granted ? 'dado' : 'retirado'} · versão {mine.policy_version}
          </p>
        )}
      </div>
      <Switch
        id={`consent-${purpose}`}
        checked={granted}
        disabled={isPending || save.isPending}
        onCheckedChange={(next) => save.mutate({ body: { purpose, granted: next } })}
        className="mt-1 shrink-0"
        aria-label={copy.title}
      />
    </div>
  );
}

function ConsentRowError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-muted-foreground border-foreground/10 border-t pt-3 text-sm first:border-0 first:pt-0">
      Não foi possível ler os teus consentimentos.{' '}
      <button type="button" onClick={onRetry} className="text-primary underline">
        Tentar outra vez
      </button>
    </div>
  );
}

// --- exportação (portabilidade) ---------------------------------------------------------------------

function ExportCard() {
  const { refetch, isFetching, error } = useQuery({
    ...exportDonorAccountOptions(),
    enabled: false, // só descarrega a pedido: é um botão, não um dado do ecrã
    refetchOnWindowFocus: false,
  });

  const download = async () => {
    try {
      const result = await refetch();
      if (!result.data) throw new Error('sem dados');
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'novelo-dados.json';
      a.click();
      URL.revokeObjectURL(url);
      toast('Exportação descarregada (JSON).');
    } catch {
      toast('Não foi possível exportar agora.');
    }
  };

  return (
    <section className="ring-foreground/10 space-y-2 rounded-2xl bg-card p-5 ring-1">
      <h2 className="inline-flex items-center gap-2 text-base font-semibold">
        <Download className="text-primary size-4" aria-hidden />
        Os meus dados (portabilidade)
      </h2>
      <p className="text-muted-foreground text-sm">
        Descarrega tudo o que nos deste e tudo o que o serviço observou, num ficheiro JSON legível
        por máquina: perfil, sacos, pedidos, livro de pontos e decisões de consentimento.
      </p>
      <Button
        type="button"
        variant="secondary"
        className="min-h-11"
        onClick={() => void download()}
      >
        {error && !isFetching
          ? 'Tentar outra vez'
          : isFetching
            ? 'A preparar…'
            : 'Descarregar os meus dados'}
      </Button>
    </section>
  );
}

// --- apagar a conta: as três proteções, depois a trava ----------------------------------------------

function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section className="border-destructive/30 space-y-2 rounded-2xl border border-dashed p-5">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold">
          <Trash2 className="text-destructive size-4" aria-hidden />
          Apagar a conta
        </h2>
        <p className="text-muted-foreground text-sm">
          A tua conta, o email e o saldo desaparecem. Lotes, passaportes e as estatísticas da rede
          ficam (nunca tiveram o teu nome). Podes exportar os teus dados antes.
        </p>
        <Button type="button" variant="ghost" className="min-h-11" onClick={() => setOpen(true)}>
          Quero apagar a minha conta
        </Button>
      </section>
      <DeleteAccountSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

function DeleteAccountSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const {
    data: preview,
    isPending,
    error,
    refetch,
  } = useQuery({
    ...getDonorDeletionPreviewOptions(),
    enabled: open, // o pré-aviso vive só dentro da folha
  });
  const [confirmEmail, setConfirmEmail] = useState('');
  const deleteAccount = useMutation({
    ...deleteDonorAccountMutation(),
    onSuccess: () => {
      onOpenChange(false);
      toast('Conta apagada. Obrigado por teres recolhido connosco.');
      void navigate({ to: '/' });
    },
    onError: (e) => {
      if (getErrorCode(e) === 'confirmation_mismatch') {
        toast('O email escrito não coincide com a tua conta.');
      } else {
        toast(`Não foi possível apagar: ${getErrorCode(e) ?? 'erro'}`);
      }
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>Apagar a conta</SheetTitle>
          <SheetDescription>
            Antes de avançar, três avisos decididos na política: o que perdes, o que ainda podes
            fazer e o que os pontos NÃO são.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pt-2">
          {isPending ? (
            <div className="space-y-2" aria-busy>
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-muted/60 h-5 w-full animate-pulse rounded" />
              ))}
            </div>
          ) : error || !preview ? (
            <div className="text-muted-foreground text-sm">
              Não foi possível carregar o resumo.{' '}
              <button
                type="button"
                onClick={() => void refetch()}
                className="text-primary underline"
              >
                Tentar outra vez
              </button>
            </div>
          ) : (
            <DeletePreview preview={preview} />
          )}

          {preview && preview.balance.balance > 0 && (
            <div className="bg-primary/10 text-primary rounded-xl p-3 text-sm">
              <p className="font-medium">
                Ainda tens {formatNumber(preview.balance.balance)} pontos.
              </p>
              <p className="mt-0.5 text-xs">
                Podes usá-los antes de apagar — o resgate continua possível até confirmares.{' '}
                <Link to="/cidadao" search={{ tab: 'saldo' }} className="underline">
                  Ver o meu saldo
                </Link>
              </p>
            </div>
          )}

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              deleteAccount.mutate({ body: { confirm_email: confirmEmail } });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm-email">
                Escreve o teu email para confirmar (irreversível)
              </Label>
              <Input
                id="delete-confirm-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder="o email desta conta"
                className="text-base"
              />
            </div>
            <Button
              type="submit"
              variant="destructive"
              className="min-h-11 w-full"
              disabled={deleteAccount.isPending || isPending || !preview || confirmEmail.length < 3}
            >
              {deleteAccount.isPending ? 'A apagar…' : 'Apagar a minha conta para sempre'}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DeletePreview({ preview }: { preview: DeletionPreviewOut }) {
  const rows = timelineRows(preview.timeline);
  return (
    <div className="space-y-3 text-sm">
      <ul className="text-muted-foreground space-y-1.5">
        {losses(preview).map((row) => (
          <li key={row} className="flex gap-2">
            <span aria-hidden>·</span>
            <span>{row}</span>
          </li>
        ))}
      </ul>
      {rows.length > 0 && (
        <div className="ring-foreground/10 rounded-xl p-3 ring-1">
          <p className="font-medium">Quando cada ponto expiraria (se continuasses)</p>
          <ul className="text-muted-foreground mt-1.5 space-y-1 text-xs">
            {rows.map((row) => (
              <li key={row.when} className="flex justify-between gap-3">
                <span>até {row.when}</span>
                <span className="tabular-nums">{formatNumber(row.amount)} pontos</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Os pontos não são dinheiro nem conversíveis: apagados com a conta, sem pagamento nem troca.
      </p>
    </div>
  );
}
