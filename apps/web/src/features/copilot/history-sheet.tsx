import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { m } from '@/paraglide/messages';
import { ThreadList } from './thread-list';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onGone: (id: string) => void;
}

/** Conversas anteriores numa folha inferior (pesquisa, grupos por data): a mesma lista da coluna do desktop. */
export function HistorySheet({ open, onOpenChange, selectedId, onSelect, onNew, onGone }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="mx-auto h-[min(82dvh,44rem)] max-w-2xl gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border" />
        <SheetHeader className="px-4 pt-2 pb-2 pr-14">
          <SheetTitle className="font-medium font-serif text-lg tracking-tight">
            {m.chat_threads()}
          </SheetTitle>
          <SheetDescription className="sr-only">{m.chat_threads_description()}</SheetDescription>
        </SheetHeader>
        <ThreadList
          className="min-h-0 flex-1 border-t"
          selectedId={selectedId}
          onSelect={onSelect}
          onNew={onNew}
          onGone={onGone}
        />
      </SheetContent>
    </Sheet>
  );
}
