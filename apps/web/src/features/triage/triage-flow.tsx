import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ImageOff, PackagePlus, ScanLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
import { uploadVars, useUploadItemPhoto } from '@/features/lots/photo-actions';
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { getLocale } from '@/lib/i18n';
import {
  NO_PHOTO_CHOICE,
  type PhotoChoice,
  type PhotoRequest,
  photoErrorMessage,
  photoRequestFrom,
} from '@/lib/lot-photos';
import { m } from '@/paraglide/messages';
import { PhotoInput, PhotoThumbs } from './photo-input';
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
  // A peça já está no lote mas a foto não seguiu: guardamo-la aqui para «Tentar guardar a foto outra vez».
  const [failedPhoto, setFailedPhoto] = useState<{
    code: string;
    itemId: string;
    request: PhotoRequest;
    message: string;
  } | null>(null);

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
  const review = useRef<HTMLDivElement>(null);
  const photoAlert = useRef<HTMLDivElement>(null);
  // O botão «Acrescentar ao lote» fica no fundo: se a foto falhar, o aviso (no topo) tem de aparecer à vista.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só quando surge uma falha nova
  useEffect(() => {
    if (!failedPhoto) return;
    const el = photoAlert.current;
    const scroller = el?.closest('main');
    if (!el || !scroller) return;
    const offset = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + offset - 16) });
  }, [failedPhoto?.itemId, failedPhoto?.message]);
  const analyse = useMutation({
    ...analyseGarmentMutation(),
    // No telemóvel o botão «Analisar» fica no fundo: a confirmação abre no topo, com as fotos à vista.
    // Rola só a área de conteúdo: `scrollIntoView` rolava também o documento e escondia o cabeçalho no telemóvel.
    onSuccess: () =>
      requestAnimationFrame(() => {
        const el = review.current;
        const scroller = el?.closest('main');
        if (!el || !scroller) return;
        const offset = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + offset - 16) });
      }),
  });
  const pendingChoice = useRef<PhotoChoice>(NO_PHOTO_CHOICE);
  const uploadPhoto = useUploadItemPhoto(lotCode ?? '');
  const savePhoto = (code: string, itemId: string, request: PhotoRequest) =>
    uploadPhoto.mutate(uploadVars(code, itemId, request), {
      onSuccess: () => {
        setFailedPhoto(null);
        toast.success(m.lotphoto_saved());
      },
      onError: (error) =>
        setFailedPhoto({ code, itemId, request, message: photoErrorMessage(error) }),
    });
  const confirm = useMutation({
    ...addLotItemMutation(),
    onSuccess: async (created, vars) => {
      setAdded((n) => n + 1);
      const request = photoRequestFrom(pendingChoice.current, itemPhoto);
      setItemPhoto(null);
      setLabelPhoto(null);
      analyse.reset();
      setFailedPhoto(null);
      await refresh();
      toast.success(m.triage_item_added());
      // A foto só segue depois de a peça estar no lote; se falhar, a peça fica e o erro é recuperável.
      if (request) savePhoto(vars.path.code, created.id, request);
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
                    {l.items === 1
                      ? m.lot_items_count_one()
                      : m.lot_items_count({ count: l.items })}
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
        {(failedPhoto || uploadPhoto.isPending) && (
          <Alert
            ref={photoAlert}
            variant={failedPhoto ? 'destructive' : 'default'}
            role={failedPhoto ? 'alert' : 'status'}
          >
            <ImageOff className="size-4" />
            <AlertTitle className="line-clamp-none">
              {failedPhoto ? m.lotphoto_failed_title() : m.lotphoto_saving()}
            </AlertTitle>
            {failedPhoto && (
              <AlertDescription className="space-y-3">
                <p>{failedPhoto.message}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="h-11"
                    loading={uploadPhoto.isPending}
                    onClick={() =>
                      savePhoto(failedPhoto.code, failedPhoto.itemId, failedPhoto.request)
                    }
                  >
                    {m.lotphoto_retry()}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 text-foreground"
                    onClick={() => setFailedPhoto(null)}
                  >
                    {m.lotphoto_skip()}
                  </Button>
                </div>
              </AlertDescription>
            )}
          </Alert>
        )}
        <FormAlert message={analyse.isError && !aiOff ? getErrorMessage(analyse.error) : null} />

        {analyse.data ? (
          <Panel ref={review} className="space-y-4 sm:p-6">
            <SectionTitle>{m.triage_review_title()}</SectionTitle>
            <div className="grid gap-5 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
              <PhotoThumbs
                photos={[
                  { file: itemPhoto, label: m.triage_photo_item() },
                  { file: labelPhoto, label: m.triage_photo_label() },
                ]}
              />
              <ReviewForm
                result={analyse.data}
                pending={confirm.isPending}
                onDiscard={() => {
                  analyse.reset();
                  setItemPhoto(null);
                  setLabelPhoto(null);
                }}
                onConfirm={(item: LotItemIn, photo) => {
                  pendingChoice.current = photo;
                  confirm.mutate({ path: { code: lot.code }, body: item });
                }}
              />
            </div>
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
