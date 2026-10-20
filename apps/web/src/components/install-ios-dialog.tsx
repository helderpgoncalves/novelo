import { EllipsisVertical, PlusSquare, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { m } from '@/paraglide/messages';

/** No iPhone/iPad não existe diálogo de instalação: explica o caminho "Partilhar > Adicionar ao ecrã principal". */
export function InstallIosDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const steps = [
    { icon: Share, text: m.install_ios_step_share() },
    { icon: PlusSquare, text: m.install_ios_step_add() },
    { icon: EllipsisVertical, text: m.install_ios_step_open() },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.install_ios_title()}</DialogTitle>
          <DialogDescription>{m.install_ios_intro()}</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3">
          {steps.map(({ icon: Icon, text }, i) => (
            <li key={text} className="flex items-start gap-3 text-sm">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="pt-1">
                <span className="sr-only">{i + 1}. </span>
                {text}
              </span>
            </li>
          ))}
        </ol>
        <DialogFooter>
          <DialogClose asChild>
            <Button>{m.install_ios_done()}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
