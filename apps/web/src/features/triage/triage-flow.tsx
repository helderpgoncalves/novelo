import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Loader2, PackagePlus, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { LotItemIn, LotSummary, ZoneOut } from '@/client';
import {
  addLotItemMutation,
  analyseGarmentMutation,
  getLotQueryKey,
  listLotsQueryKey,
  openLotMutation,
} from '@/client/@tanstack/react-query.gen';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { PhotoInput } from './photo-input';
import { ReviewForm } from './review-form';

interface TriageFlowProps {
  zones: ZoneOut[];
  openLots: LotSummary[];
  initialLot?: string;
}

export function TriageFlow({ zones, openLots, initialLot }: TriageFlowProps) {
  const queryClient = useQueryClient();
  const [lotCode, setLotCode] = useState<string | null>(initialLot ?? openLots[0]?.code ?? null);
  const [parish, setParish] = useState<string>('');
  const [itemPhoto, setItemPhoto] = useState<File | null>(null);
  const [labelPhoto, setLabelPhoto] = useState<File | null>(null);
  const [added, setAdded] = useState(0);

  const lot = openLots.find((l) => l.code === lotCode);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: listLotsQueryKey() }),
      lotCode
        ? queryClient.invalidateQueries({ queryKey: getLotQueryKey({ path: { code: lotCode } }) })
        : undefined,
    ]);

  const open = useMutation({
    ...openLotMutation(),
    onSuccess: async (created) => {
      setLotCode(created.code);
      await queryClient.invalidateQueries({ queryKey: listLotsQueryKey() });
      toast.success(m.triage_lot_opened({ code: created.code }));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const analyse = useMutation(analyseGarmentMutation());
  const confirm = useMutation({
    ...addLotItemMutation(),
    onSuccess: async () => {
      setAdded((n) => n + 1);
      setItemPhoto(null);
      setLabelPhoto(null);
      analyse.reset();
      await refresh();
      toast.success(m.triage_item_added());
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const aiOff = analyse.isError && getErrorCode(analyse.error) === 'feature_disabled';

  if (!lotCode || !lot) {
    return (
      <div className="mx-auto max-w-lg space-y-5 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <div className="space-y-1">
          <h2 className="text-2xl">{m.triage_open_title()}</h2>
          <p className="text-muted-foreground text-sm">{m.triage_open_text()}</p>
        </div>
        {openLots.length > 0 && (
          <Select onValueChange={setLotCode}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue placeholder={m.triage_pick_lot()} />
            </SelectTrigger>
            <SelectContent>
              {openLots.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.code} · {l.parish_name ?? m.lot_no_parish()} ·{' '}
                  {m.lot_items_count({ count: l.items })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="space-y-2">
          <p className="font-medium text-sm">{m.triage_new_lot()}</p>
          <Select value={parish} onValueChange={setParish}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue placeholder={m.triage_pick_parish()} />
            </SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={z.code} value={z.code}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="h-11 w-full gap-2 font-semibold"
            disabled={open.isPending}
            onClick={() => open.mutate({ body: { parish_code: parish || null } })}
          >
            {open.isPending ? <Loader2 className="animate-spin" /> : <PackagePlus />}
            {m.triage_open_lot()}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div>
          <p className="eyebrow">{m.triage_current_lot()}</p>
          <p className="font-medium font-serif text-2xl tracking-wide">{lot.code}</p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {lot.parish_name ?? m.lot_no_parish()} · {m.lot_items_count({ count: lot.items })} ·{' '}
            {formatNumber(lot.weight_kg, 2)} kg
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLotCode(null)}>
            {m.triage_change_lot()}
          </Button>
          <Button asChild size="sm">
            <Link to="/lots/$code" params={{ code: lot.code }}>
              {m.triage_finish_lot()}
            </Link>
          </Button>
        </div>
      </div>

      {added > 0 && !analyse.data && (
        <p className="text-center text-muted-foreground text-sm">
          {m.triage_session_count({ count: added })}
        </p>
      )}

      {aiOff && (
        <Alert>
          <ScanLine className="size-4" />
          <AlertTitle>{m.triage_ai_off_title()}</AlertTitle>
          <AlertDescription>{m.triage_ai_off_text()}</AlertDescription>
        </Alert>
      )}
      <FormAlert message={analyse.isError && !aiOff ? getErrorMessage(analyse.error) : null} />

      {analyse.data ? (
        <div className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="text-2xl">{m.triage_review_title()}</h2>
          <ReviewForm
            result={analyse.data}
            pending={confirm.isPending}
            onDiscard={() => {
              analyse.reset();
              setItemPhoto(null);
              setLabelPhoto(null);
            }}
            onConfirm={(item: LotItemIn) =>
              confirm.mutate({ path: { code: lot.code }, body: item })
            }
          />
        </div>
      ) : (
        <div className="space-y-5 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="grid gap-5 sm:grid-cols-2">
            <PhotoInput
              label={m.triage_photo_item()}
              hint={m.triage_photo_item_hint()}
              value={itemPhoto}
              onChange={setItemPhoto}
              required
              removeLabel={m.triage_retake()}
            />
            <PhotoInput
              label={m.triage_photo_label()}
              hint={m.triage_photo_label_hint()}
              value={labelPhoto}
              onChange={setLabelPhoto}
              removeLabel={m.triage_retake()}
            />
          </div>
          <Button
            className="h-12 w-full gap-2 font-semibold"
            disabled={!itemPhoto || analyse.isPending}
            onClick={() =>
              itemPhoto &&
              analyse.mutate({ body: { item_photo: itemPhoto, label_photo: labelPhoto } })
            }
          >
            {analyse.isPending ? <Loader2 className="animate-spin" /> : <ScanLine />}
            {analyse.isPending ? m.triage_analysing() : m.triage_analyse()}
          </Button>
          <p className="text-center text-muted-foreground text-xs">{m.triage_privacy()}</p>
        </div>
      )}
    </div>
  );
}
