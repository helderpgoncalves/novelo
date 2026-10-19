import { useParams } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { m } from '@/paraglide/messages';
import { CopilotPanel } from './copilot-panel';
import { useCopilot } from './use-copilot';

const isMac = () => typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);

/** Botão do topo + atalho ⌘K / Ctrl+K. A conversa vive aqui para sobreviver ao fechar o painel. */
export function CopilotLauncher() {
  const [open, setOpen] = useState(false);
  const { scenarioId } = useParams({ strict: false }) as { scenarioId?: string };
  const copilot = useCopilot(scenarioId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-10 gap-2 px-3"
        onClick={() => setOpen(true)}
        aria-label={m.copilot_launcher_label()}
      >
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <span className="hidden sm:inline">{m.copilot_launcher()}</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground lg:inline">
          {isMac() ? '⌘K' : 'Ctrl K'}
        </kbd>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className="h-dvh w-full max-w-full gap-0 p-0 sm:max-w-lg lg:max-w-xl"
          aria-describedby="copilot-description"
        >
          <SheetHeader className="border-b px-4 py-4 pr-14 sm:px-6">
            <SheetTitle className="flex items-center gap-2 font-serif text-xl">
              <Sparkles className="size-5 text-primary" aria-hidden="true" />
              {m.copilot_title()}
            </SheetTitle>
            <SheetDescription id="copilot-description">{m.copilot_description()}</SheetDescription>
          </SheetHeader>
          <CopilotPanel copilot={copilot} withScenario={!!scenarioId} />
        </SheetContent>
      </Sheet>
    </>
  );
}
