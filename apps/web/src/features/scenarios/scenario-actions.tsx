import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { GitCompareArrows, MoreHorizontal, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useIsGuest } from '@/features/auth/use-current-user';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';

export function ScenarioActions({ scenario }: { scenario: ScenarioOut }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState(scenario.label);
  const [deleting, setDeleting] = useState(false);
  // Convidados não apagam: a opção fica visível mas desligada, com a razão no título.
  const guest = useIsGuest();

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

  // Duas ações à vista (as que levam a outro ecrã) e as de gestão num menu: em telemóvel cabem numa linha.
  return (
    <>
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-10"
            aria-label={m.dt_row_actions({ row: scenario.label })}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem className="min-h-10" onSelect={() => setRenaming(true)}>
            <Pencil /> {m.scenario_rename()}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-10 text-destructive focus:text-destructive"
            disabled={guest}
            onSelect={() => setDeleting(true)}
          >
            <Trash2 />
            <span className="flex flex-col">
              {m.scenario_delete()}
              {guest && <span className="text-muted-foreground text-xs">{m.guest_blocked()}</span>}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {m.scenario_delete_title({ label: scenario.label })}
            </AlertDialogTitle>
            <AlertDialogDescription>{m.scenario_delete_description()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.common_cancel()}</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => remove.mutate({ path: { scenario_id: scenario.id } })}
            >
              {m.scenario_delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
