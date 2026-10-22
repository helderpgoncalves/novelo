import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PackagePlus, ScanLine } from 'lucide-react';
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
import { BrandSpinner } from '@/components/brand-logo';
import { Panel, SectionTitle } from '@/components/page';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkingState } from '@/components/working-state';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { getLocale } from '@/lib/i18n';
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {openLots.length > 0 && (
          <Panel className="space-y-4 sm:p-6">
            <div className="space-y-1">
              <SectionTitle>{m.rw_triage_continue_title()}</SectionTitle>
              <p className="text-muted-foreground text-sm">{m.rw_triage_continue_text()}</p>
            </div>
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
          </Panel>
        )}
        <Panel className="space-y-4 sm:p-6">
          <div className="space-y-1">
            <SectionTitle>{m.triage_open_title()}</SectionTitle>
            <p className="text-muted-foreground text-sm">{m.triage_open_text()}</p>
          </div>
          <div className="space-y-3">
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
              {open.isPending ? <BrandSpinner tone="mono" /> : <PackagePlus />}
              {m.triage_open_lot()}
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <aside className="self-start lg:sticky lg:top-4 lg:order-2 lg:col-span-4">
        <Panel className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow">{m.triage_current_lot()}</p>
              <p className="font-medium font-serif text-2xl tracking-wide">{lot.code}</p>
              <p className="text-muted-foreground text-xs">
                {lot.parish_name ?? m.lot_no_parish()}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-9" onClick={() => setLotCode(null)}>
              {m.triage_change_lot()}
            </Button>
          </div>
          <StatStrip className="lg:grid-cols-2">
            <StatCell label={m.lot_stat_items()} value={formatNumber(lot.items)} />
            <StatCell label={m.rw_triage_session()} value={formatNumber(added)} />
          </StatStrip>
          <p className="text-muted-foreground text-xs tabular-nums">
            {formatNumber(lot.weight_kg, 2)} kg · {m.common_estimate()}
          </p>
          <Button asChild variant="outline" className="h-10 w-full">
            <Link to="/lots/$code" params={{ code: lot.code }}>
              {m.triage_finish_lot()}
            </Link>
          </Button>
        </Panel>
      </aside>

      <div className="min-w-0 space-y-4 lg:order-1 lg:col-span-8">
        {aiOff && (
          <Alert>
            <ScanLine className="size-4" />
            <AlertTitle>{m.triage_ai_off_title()}</AlertTitle>
            <AlertDescription>{m.triage_ai_off_text()}</AlertDescription>
          </Alert>
        )}
        <FormAlert message={analyse.isError && !aiOff ? getErrorMessage(analyse.error) : null} />

        {analyse.data ? (
          <Panel className="space-y-4 sm:p-6">
            <SectionTitle>{m.triage_review_title()}</SectionTitle>
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
          </Panel>
        ) : (
          <Panel className="space-y-5 sm:p-6">
            <SectionTitle>{m.rw_triage_step_photo()}</SectionTitle>
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
            {analyse.isPending && (
              <WorkingState
                title={m.working_triage_title()}
                subtitle={m.working_triage_hint()}
                trackElapsed
              />
            )}
            <Button
              className="h-12 w-full gap-2 font-semibold"
              disabled={!itemPhoto || analyse.isPending}
              onClick={() =>
                itemPhoto &&
                analyse.mutate({
                  body: { item_photo: itemPhoto, label_photo: labelPhoto },
                  query: { locale: getLocale() },
                })
              }
            >
              <ScanLine />
              {analyse.isPending ? m.triage_analysing() : m.triage_analyse()}
            </Button>
            <p className="text-center text-muted-foreground text-xs">{m.triage_privacy()}</p>
          </Panel>
        )}
      </div>
    </div>
  );
}
