import { useMutation } from '@tanstack/react-query';
import { Pencil, QrCode, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { BagActivationOut } from '@/client';
import {
  activateBagMutation,
  createBagActivationMutation,
  deactivateBagMutation,
  updateBagActivationMutation,
} from '@/client/@tanstack/react-query.gen';
import { ErrorState } from '@/components/states';
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
import { cn } from '@/lib/utils';

// Strings em pt-PT de propósito: a área do cidadão é só portuguesa no MVP (decisão da spec #54).

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

export function BagsTab({
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
