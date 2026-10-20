import { Link } from '@tanstack/react-router';
import { Maximize2, Sparkles, SquarePen } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { m } from '@/paraglide/messages';
import { ChatView } from './chat-view';
import { setCopilotSheetOpen, toggleCopilotSheet, useCopilotUi } from './store';
import { useChat } from './use-chat';

const isMac = () => typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
const STORAGE_KEY = 'novelo.copilot.thread';

const readThread = (): string | null => {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
const writeThread = (id: string | null) => {
  try {
    if (id) sessionStorage.setItem(STORAGE_KEY, id);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sem armazenamento (janela privada): a conversa continua enquanto o painel existir.
  }
};

/** Botão do topo + atalho ⌘K / Ctrl+K + painel lateral. A conversa vive aqui para sobreviver ao fechar o painel. */
export function CopilotLauncher() {
  const { sheetOpen } = useCopilotUi();
  const [threadId, setThreadId] = useState<string | null>(readThread);
  const onThreadId = useCallback((id: string | null) => {
    setThreadId(id);
    writeThread(id);
  }, []);
  const chat = useChat({ threadId, onThreadId });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCopilotSheet();
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
        onClick={toggleCopilotSheet}
        aria-label={m.copilot_launcher_label()}
      >
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <span className="hidden sm:inline">{m.copilot_launcher()}</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground lg:inline">
          {isMac() ? '⌘K' : 'Ctrl K'}
        </kbd>
      </Button>
      <Sheet open={sheetOpen} onOpenChange={setCopilotSheetOpen}>
        <SheetContent
          className="h-dvh w-full max-w-full gap-0 p-0 sm:max-w-xl lg:max-w-2xl"
          aria-describedby="copilot-description"
        >
          <SheetHeader className="border-b px-4 py-3 pr-14 sm:px-6">
            <SheetTitle className="flex items-center gap-2 font-serif text-xl">
              <Sparkles className="size-5 text-primary" aria-hidden="true" />
              {m.copilot_title()}
            </SheetTitle>
            <SheetDescription id="copilot-description" className="truncate">
              {chat.title ?? m.copilot_description()}
            </SheetDescription>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" className="h-10 gap-1.5" onClick={chat.newChat}>
                <SquarePen className="size-3.5" aria-hidden="true" />
                {m.copilot_clear()}
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-10 gap-1.5">
                <Link
                  to="/chat"
                  search={threadId ? { thread: threadId } : {}}
                  onClick={() => setCopilotSheetOpen(false)}
                >
                  <Maximize2 className="size-3.5" aria-hidden="true" />
                  {m.chat_open_fullscreen()}
                </Link>
              </Button>
            </div>
          </SheetHeader>
          <ChatView chat={chat} handlesRequests={sheetOpen} onOpenThread={onThreadId} />
        </SheetContent>
      </Sheet>
    </>
  );
}
