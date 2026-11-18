import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  cancelCollectionRequestMutation,
  createCollectionRequestMutation,
  listCollectionRequestsOptions,
  listCollectionRequestsQueryKey,
} from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RequestStateBadge } from '@/features/collection-requests/request-parts';
import { getErrorCode } from '@/lib/errors';

// Strings em pt-PT de propósito: a área do local é só portuguesa no MVP (decisão da spec #54).

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

/** O pedido de recolha do local/B2B: morada institucional (a do sítio da conta — nunca se escreve),
 * até 20 sacos (teto de estimativa; acima disto a recolha vai para a fila de exceções da Vitrus) e
 * o dia pretendido com o corte de 48 h. A lista de baixo mostra os pedidos do próprio sítio. */
export function LocalRequestsSheet() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: listCollectionRequestsQueryKey() });
  const create = useMutation({
    ...createCollectionRequestMutation(),
    onSuccess: () => {
      invalidate();
      toast('Pedido enviado — a equipa confirma pela ronda');
    },
    onError: (error) => toast(`Não foi possível pedir: ${getErrorCode(error) ?? 'erro'}`),
  });
  const cancel = useMutation({
    ...cancelCollectionRequestMutation(),
    onSuccess: () => {
      invalidate();
      toast('Pedido anulado');
    },
    onError: (error) => toast(`Não foi possível anular: ${getErrorCode(error) ?? 'erro'}`),
  });

  const [bags, setBags] = useState(4);
  const [date, setDate] = useState(() =>
    new Date(Date.now() + TWO_DAYS_MS).toISOString().slice(0, 10),
  );
  const [note, setNote] = useState('');

  const { data: requests } = useQuery(listCollectionRequestsOptions());
  const mine = requests ?? [];
  const minDate = new Date(Date.now() + TWO_DAYS_MS).toISOString().slice(0, 10);

  return (
    <div className="mt-4 space-y-5">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            body: {
              bag_count: bags,
              requested_date: date,
              note: note.trim() || undefined,
            },
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="request-bags" className="text-sm font-medium">
            Quantos sacos
          </Label>
          <Input
            id="request-bags"
            type="number"
            min={1}
            max={500}
            inputMode="numeric"
            value={bags}
            onChange={(e) => setBags(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
            className="h-10 text-base"
            aria-describedby="request-bags-hint"
          />
          <p id="request-bags-hint" className="text-muted-foreground text-xs">
            {bags > 20
              ? 'Mais de 20 sacos é recolha especial: a equipa da Vitrus confirma consigo.'
              : 'Até 20 sacos (teto de estimativa); acima disso, é recolha especial.'}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="request-date" className="text-sm font-medium">
            Dia pretendido
          </Label>
          <Input
            id="request-date"
            type="date"
            min={minDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 text-base"
          />
          <p className="text-muted-foreground text-xs">
            A recolha marca-se com 48 horas de margem (dois dias).
          </p>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={240}
          rows={2}
          placeholder="Recado para a equipa (opcional) — ex.: portão da cozinha"
          className="min-h-11 text-base"
        />
        <Button type="submit" className="min-h-11 w-full" disabled={create.isPending || !date}>
          {create.isPending ? 'A pedir…' : 'Pedir recolha'}
        </Button>
        <p className="text-muted-foreground text-xs">
          A morada é a institucional do nosso local — não se escreve aqui.
        </p>
      </form>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Os nossos pedidos</p>
        {mine.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Ainda sem pedidos de recolha.
          </p>
        ) : (
          <ul className="space-y-2">
            {mine.map((request) => (
              <li
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2.5"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">
                    {request.bag_count} {request.bag_count === 1 ? 'saco' : 'sacos'} ·{' '}
                    {request.requested_date}
                    {request.state === 'exception' && ' · à espera da equipa'}
                  </p>
                  <RequestStateBadge state={request.state} />
                </div>
                {(request.state === 'scheduled' || request.state === 'exception') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-10"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate({ path: { request_id: request.id } })}
                  >
                    Anular
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
