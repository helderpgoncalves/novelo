import { useQuery } from '@tanstack/react-query';
import type { BagActivationOut } from '@/client';
import { getBagQrOptions, getDonorAccountQrOptions } from '@/client/@tanstack/react-query.gen';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

// Strings em pt-PT de propósito: a área do cidadão é só portuguesa no MVP (decisão da spec #54).

// --- Folhas do QR ---------------------------------------------------------------------------------

export function AccountQrSheet({
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

export function BagQrSheet({
  bag,
  onClose,
}: {
  bag: BagActivationOut | null;
  onClose: () => void;
}) {
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
