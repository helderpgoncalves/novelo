import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import type { FineState, GarmentType, Gender, Season } from '@/client';
import {
  createExportLotMutation,
  listExportLotsQueryKey,
} from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { garmentLabel } from '@/lib/lots';
import {
  FINE_STATES,
  fineStateLabel,
  GENDERS,
  genderLabel,
  SEASONS,
  seasonLabel,
} from '@/lib/taxonomy';
import { m } from '@/paraglide/messages';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Fechar um lote de escoamento por (estado fino, tipologia, estação, género): a chave juntas todas
 * as peças triadas que apanham e ainda não têm lote; cor e tamanho ficam fora, para filtros. */
export function CreateExportLotDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <CreateBody onClose={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function CreateBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fineState, setFineState] = useState<FineState | ''>('');
  const [garment, setGarment] = useState<GarmentType | ''>('');
  const [season, setSeason] = useState<Season | ''>('');
  const [gender, setGender] = useState<Gender | ''>('');

  const create = useMutation({
    ...createExportLotMutation(),
    onSuccess: async (lot) => {
      await queryClient.invalidateQueries({ queryKey: listExportLotsQueryKey() });
      toast.success(m.export_lot_closed_toast());
      onClose();
      await navigate({ to: '/export-lots/$code', params: { code: lot.code } });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{m.export_create_title()}</DialogTitle>
        <DialogDescription>{m.export_create_description()}</DialogDescription>
      </DialogHeader>
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (fineState && garment && season && gender)
            create.mutate({
              body: { fine_state: fineState, garment_type: garment, season, gender },
            });
        }}
      >
        <div className="space-y-1.5 text-sm">
          <Label>{m.export_create_fine_state()}</Label>
          <Select value={fineState} onValueChange={(v) => setFineState(v as FineState)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={m.export_create_fine_state()} />
            </SelectTrigger>
            <SelectContent>
              {FINE_STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {fineStateLabel[s]()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 text-sm">
          <Label>{m.export_create_garment()}</Label>
          <Select value={garment} onValueChange={(v) => setGarment(v as GarmentType)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={m.export_create_garment()} />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(garmentLabel) as GarmentType[]).map((g) => (
                <SelectItem key={g} value={g}>
                  {garmentLabel[g]()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 text-sm">
          <Label>{m.export_create_season()}</Label>
          <Select value={season} onValueChange={(v) => setSeason(v as Season)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={m.export_create_season()} />
            </SelectTrigger>
            <SelectContent>
              {SEASONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {seasonLabel[s]()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 text-sm">
          <Label>{m.export_create_gender()}</Label>
          <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={m.export_create_gender()} />
            </SelectTrigger>
            <SelectContent>
              {GENDERS.map((g) => (
                <SelectItem key={g} value={g}>
                  {genderLabel[g]()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <FormAlert message={create.isError ? getErrorMessage(create.error) : null} />
        </div>
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" className="h-10" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button
            type="submit"
            className="h-10 font-semibold"
            disabled={!fineState || !garment || !season || !gender}
            loading={create.isPending}
          >
            {m.export_create_submit()}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
