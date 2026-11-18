import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  createCollectionRequestMutation,
  listCollectionRequestsOptions,
  listZonesOptions,
} from '@/client/@tanstack/react-query.gen';
import { StickyActions } from '@/components/sticky-actions';
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
import { getErrorCode } from '@/lib/errors';

// Strings em pt-PT de propósito: a área do cidadão é só portuguesa no MVP (decisão da spec #54).

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000; // o corte de 48 h é regra da API (#60)

/** O pedido de recolha do doador (história 6): 1–5 sacos, morada escrita (nunca GPS), freguesia e dia.
 * Fora da ronda ou do prazo cai na fila de exceções da Vitrus — o aviso é o mesmo contrato do local. */
export function RequestSheet({
  open,
  onOpenChange,
  bagsAtHome,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bagsAtHome: number;
}) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: listCollectionRequestsOptions().queryKey });
  const create = useMutation({
    ...createCollectionRequestMutation(),
    onSuccess: (request) => {
      invalidate();
      onOpenChange(false);
      toast(
        request.state === 'scheduled'
          ? 'Pedido agendado — a viatura passa no dia escolhido.'
          : 'Pedido enviado — a equipa da Vitrus confirma em breve.',
      );
    },
    onError: (error) => {
      const code = getErrorCode(error);
      toast(
        code === 'address_request_active'
          ? 'Já tens um pedido ativo nesta morada.'
          : code === 'citizen_parish_required'
            ? 'Escolhe a freguesia.'
            : `Não foi possível pedir: ${code ?? 'erro'}`,
      );
    },
  });

  const [bags, setBags] = useState(1);
  const [parishCode, setParishCode] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState(() =>
    new Date(Date.now() + TWO_DAYS_MS).toISOString().slice(0, 10),
  );
  const [note, setNote] = useState('');
  const minDate = new Date(Date.now() + TWO_DAYS_MS).toISOString().slice(0, 10);
  // As freguesias vêm dos dados da rede (o zoneamento CAOP já carregado); é uma escolha, nunca GPS.
  const zones = useQuery({ ...listZonesOptions(), enabled: open });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>Pedir a recolha</SheetTitle>
          <SheetDescription>
            Até 5 sacos à porta num dia à escolha, com o corte de 48 horas. Fora da ronda da tua
            freguesia, a equipa da Vitrus avalia o pedido. Tens {bagsAtHome}{' '}
            {bagsAtHome === 1 ? 'saco em casa' : 'sacos em casa'}.
          </SheetDescription>
        </SheetHeader>
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!parishCode || !address.trim()) return;
            create.mutate({
              body: {
                bag_count: bags,
                requested_date: date,
                address: address.trim(),
                parish_code: parishCode,
                note: note.trim() || undefined,
              },
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="req-parish">Freguesia</Label>
            <select
              id="req-parish"
              value={parishCode}
              onChange={(e) => setParishCode(e.target.value)}
              className="border-input bg-background h-11 w-full rounded-md border px-3 text-base"
            >
              <option value="">Escolhe a freguesia</option>
              {(zones.data ?? []).map((zone) => (
                <option key={zone.code} value={zone.code}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-address">Morada</Label>
            <Input
              id="req-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={300}
              placeholder="Rua, número, andar"
              autoComplete="street-address"
              className="text-base"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="req-bags">Quantos sacos (1–5)</Label>
              <Input
                id="req-bags"
                type="number"
                min={1}
                max={5}
                inputMode="numeric"
                value={bags}
                onChange={(e) => setBags(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
                className="text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-date">Dia (a partir de {minDate})</Label>
              <Input
                id="req-date"
                type="date"
                min={minDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-base"
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-note">Recado (opcional)</Label>
            <Input
              id="req-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="Ex.: sacos junto ao portão"
              className="text-base"
            />
          </div>
          <StickyActions>
            <Button
              type="submit"
              className="min-h-12 w-full text-base"
              disabled={create.isPending || !parishCode}
            >
              {create.isPending ? 'A enviar…' : 'Pedir recolha'}
            </Button>
          </StickyActions>
        </form>
      </SheetContent>
    </Sheet>
  );
}
