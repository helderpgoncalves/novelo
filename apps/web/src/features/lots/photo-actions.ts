import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  deleteItemPhotoMutation,
  getLotQueryKey,
  uploadItemPhotoMutation,
} from '@/client/@tanstack/react-query.gen';
import { type PhotoRequest, photoErrorMessage } from '@/lib/lot-photos';
import { m } from '@/paraglide/messages';

// A rota da miniatura não muda quando se substitui a foto: um parâmetro de versão faz o browser pedi-la outra vez.
const versions = new Map<string, number>();
export const bumpPhotoVersion = (itemId: string) => versions.set(itemId, Date.now());
export const photoSrc = (url: string, itemId: string): string => {
  const v = versions.get(itemId);
  return v ? `${url}?v=${v}` : url;
};

/** Variáveis do PUT: o consentimento vai sempre `true` porque só se chega aqui depois de o operador o dar. */
export const uploadVars = (code: string, itemId: string, request: PhotoRequest) => ({
  path: { code, item_id: itemId },
  body: { photo: request.file, confirm_no_people: true, credit: request.credit },
});

export function useUploadItemPhoto(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...uploadItemPhotoMutation(),
    onSuccess: async (_data, vars) => {
      bumpPhotoVersion(vars.path.item_id);
      await queryClient.invalidateQueries({ queryKey: getLotQueryKey({ path: { code } }) });
    },
  });
}

export function useDeleteItemPhoto(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...deleteItemPhotoMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getLotQueryKey({ path: { code } }) });
      toast.success(m.lotphoto_deleted());
    },
    onError: (error) => toast.error(photoErrorMessage(error)),
  });
}
