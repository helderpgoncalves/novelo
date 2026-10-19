import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { GitCompareArrows, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ScenarioOut } from '@/client';
import {
  deleteScenarioMutation,
  listScenariosQueryKey,
  renameScenarioMutation,
} from '@/client/@tanstack/react-query.gen';
import {
  AlertDialog,
  AlertDialogAction,
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
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';

export function ScenarioActions({ scenario }: { scenario: ScenarioOut }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState(scenario.label);

  const rename = useMutation({
    ...renameScenarioMutation(),
    onSuccess: async () => {
      setRenaming(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listScenariosQueryKey() }),
        router.invalidate(),
      ]);
      toast.success(m.scenario_renamed());
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const remove = useMutation({
    ...deleteScenarioMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listScenariosQueryKey() });
      toast.success(m.scenario_deleted());
      await navigate({ to: '/scenarios' });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <>
      <Button variant="outline" className="h-10 gap-2" onClick={() => setRenaming(true)}>
        <Pencil /> {m.scenario_rename()}
      </Button>
      <Button asChild variant="outline" className="h-10 gap-2">
        <Link to="/simulator" search={{ from: scenario.id }}>
          <SlidersHorizontal /> {m.scenario_adjust()}
        </Link>
      </Button>
      <Button asChild variant="outline" className="h-10 gap-2">
        <Link to="/scenarios/compare" search={{ a: scenario.id }}>
          <GitCompareArrows /> {m.scenario_compare()}
        </Link>
      </Button>
      <DeleteScenario
        label={scenario.label}
        pending={remove.isPending}
        onConfirm={() => remove.mutate({ path: { scenario_id: scenario.id } })}
      />

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.scenario_rename()}</DialogTitle>
            <DialogDescription>{m.scenario_rename_description()}</DialogDescription>
          </DialogHeader>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            aria-label={m.sim_label()}
            className="h-10"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(false)}>
              {m.common_cancel()}
            </Button>
            <Button
              disabled={!label.trim() || rename.isPending}
              onClick={() =>
                rename.mutate({ path: { scenario_id: scenario.id }, body: { label: label.trim() } })
              }
            >
              {m.common_save()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteScenario({
  label,
  pending,
  onConfirm,
}: {
  label: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        className="h-10 gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 /> {m.scenario_delete()}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.scenario_delete_title({ label })}</AlertDialogTitle>
            <AlertDialogDescription>{m.scenario_delete_description()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.common_cancel()}</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={onConfirm}>
              {m.scenario_delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
