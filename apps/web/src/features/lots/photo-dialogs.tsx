import { Camera } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import type { LotItemOut } from '@/client';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormAlert } from '@/features/auth/form-alert';
import { shrinkImage } from '@/lib/image';
import {
  type PhotoChoice,
  photoAlt,
  photoChoiceReady,
  photoErrorMessage,
  photoRequestFrom,
} from '@/lib/lot-photos';
import { m } from '@/paraglide/messages';
import { uploadVars, useDeleteItemPhoto, useUploadItemPhoto } from './photo-actions';
import { PhotoConsent } from './photo-consent';

const START: PhotoChoice = { save: true, confirmed: false, credit: '' };

/** «Acrescentar» / «Substituir» fotografia numa peça do lote: o mesmo consentimento da triagem. */
export function PhotoUploadDialog({
  code,
  item,
  onClose,
}: {
  code: string;
  /** `null` fechado. */
  item: LotItemOut | null;
  onClose: () => void;
}) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [choice, setChoice] = useState<PhotoChoice>(START);
  const upload = useUploadItemPhoto(code);

  // biome-ignore lint/correctness/useExhaustiveDependencies: recomeça sempre que se abre para outra peça
  useEffect(() => {
    setFile(null);
    setChoice(START);
    upload.reset();
  }, [item?.id]);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const request = photoRequestFrom(choice, file);
  const replacing = item?.has_photo === true;

  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.lotphoto_add_title()}</DialogTitle>
          <DialogDescription>{m.lotphoto_add_text()}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div
              className="relative grid aspect-[4/3] max-h-56 w-full place-items-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/40 data-[has=true]:border-primary/40 data-[has=true]:border-solid"
              data-has={!!preview}
            >
              {preview && item ? (
                <img
                  src={preview}
                  alt={photoAlt(item.garment_type, item.brand)}
                  className="size-full object-contain"
                />
              ) : (
                <label
                  htmlFor={inputId}
                  className="flex cursor-pointer flex-col items-center gap-2 p-4 text-center text-muted-foreground text-sm"
                >
                  <Camera className="size-8" aria-hidden="true" />
                  {m.lotphoto_pick()}
                </label>
              )}
            </div>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={async (e) => {
                const picked = e.target.files?.[0];
                e.target.value = '';
                if (picked) setFile(await shrinkImage(picked, 1024));
              }}
            />
            {file && (
              <Button asChild variant="ghost" size="sm" className="h-10">
                <label htmlFor={inputId} className="cursor-pointer">
                  {m.lotphoto_pick_other()}
                </label>
              </Button>
            )}
          </div>
          <PhotoConsent choice={choice} onChange={setChoice} showToggle={false} />
          <FormAlert message={upload.isError ? photoErrorMessage(upload.error) : null} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button
            type="button"
            className="h-11 font-semibold"
            disabled={!request || !photoChoiceReady(choice)}
            loading={upload.isPending}
            onClick={() => {
              if (!item || !request) return;
              upload.mutate(uploadVars(code, item.id, request), {
                onSuccess: () => {
                  toast.success(m.lotphoto_saved());
                  onClose();
                },
              });
            }}
          >
            {replacing ? m.lotphoto_replace() : m.lotphoto_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Confirmação antes de apagar a miniatura (folha inferior em telemóvel). */
export function PhotoDeleteDialog({
  code,
  item,
  onClose,
}: {
  code: string;
  item: LotItemOut | null;
  onClose: () => void;
}) {
  const remove = useDeleteItemPhoto(code);
  return (
    <AlertDialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <AlertDialogHeader>
          <AlertDialogTitle>{m.lotphoto_delete_title()}</AlertDialogTitle>
          <AlertDialogDescription>{m.lotphoto_delete_text()}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11">{m.common_cancel()}</AlertDialogCancel>
          <Button
            variant="destructive"
            className="h-11 font-semibold"
            loading={remove.isPending}
            onClick={() =>
              item && remove.mutate({ path: { code, item_id: item.id } }, { onSettled: onClose })
            }
          >
            {m.lotphoto_delete()}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
