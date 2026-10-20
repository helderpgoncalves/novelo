import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { exportCopilotData } from '@/client';
import { deleteCopilotDataMutation } from '@/client/@tanstack/react-query.gen';
import { Panel } from '@/components/panel';
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
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';
import { downloadText } from '../download';

const WORD = 'APAGAR';

/** Os teus dados: exportar tudo (RGPD) e apagar tudo, a segunda só depois de escrever APAGAR. */
export function DataSection({ onDeleted }: { onDeleted: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [exporting, setExporting] = useState(false);
  const remove = useMutation({
    ...deleteCopilotDataMutation(),
    onSuccess: () => {
      setOpen(false);
      setTyped('');
      qc.removeQueries({
        predicate: (q) => /Copilot|PendingMemory/.test(JSON.stringify(q.queryKey[0] ?? '')),
      });
      toast.success(m.chat_data_deleted());
      onDeleted();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const exportAll = async () => {
    setExporting(true);
    try {
      const { data } = await exportCopilotData({ throwOnError: true });
      downloadText('novelo-copiloto.json', JSON.stringify(data, null, 2), 'application/json');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Panel title={m.chat_data_export_title()} description={m.chat_data_export_description()}>
        <Button
          variant="outline"
          className="h-11 gap-2"
          loading={exporting}
          onClick={() => void exportAll()}
        >
          {!exporting && <Download className="size-4" aria-hidden="true" />}
          {m.chat_data_export()}
        </Button>
      </Panel>
      <Panel
        title={m.chat_data_delete_title()}
        description={m.chat_data_delete_description()}
        className="ring-destructive/30"
      >
        <Button variant="destructive" className="h-11 gap-2" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" aria-hidden="true" />
          {m.chat_data_delete()}
        </Button>
      </Panel>
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setTyped('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.chat_data_delete_confirm_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.chat_data_delete_confirm_description()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="delete-confirm" className="font-medium text-sm">
              {m.chat_action_type_to_confirm({ word: WORD })}
            </label>
            <Input
              id="delete-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="h-11 text-base md:text-base"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10">{m.common_cancel()}</AlertDialogCancel>
            <Button
              variant="destructive"
              className="h-10"
              loading={remove.isPending}
              disabled={typed.trim().toUpperCase() !== WORD}
              onClick={() => remove.mutate({ query: { confirmation: WORD } })}
            >
              {m.chat_data_delete()}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
