import { Link } from '@tanstack/react-router';
import { Download, History, Maximize2, MessageCircle, Settings2, SquarePen, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { ChatHeader } from './chat-header';
import { ChatView } from './chat-view';
import { exportThreadMarkdown } from './export-thread';
import { HistorySheet } from './history-sheet';
import { setCopilotSheetOpen, toggleCopilotSheet, useCopilotUi } from './store';
import { useChat } from './use-chat';
import { useIsMobile, useVisualViewport } from './use-viewport';

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

/** Botão do topo + atalho ⌘K / Ctrl+K + painel (ecrã inteiro no telemóvel, lateral no desktop). A conversa vive aqui para sobreviver ao fechar o painel. */
export function CopilotLauncher() {
  const { sheetOpen } = useCopilotUi();
  const [threadId, setThreadId] = useState<string | null>(readThread);
  const [historyOpen, setHistoryOpen] = useState(false);
  const mobile = useIsMobile();
  // No iOS o teclado não encolhe o viewport de layout: segue-se a área visível para o campo não ficar tapado.
  const viewport = useVisualViewport(mobile && sheetOpen);
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
        <MessageCircle className="size-4" strokeWidth={1.75} aria-hidden="true" />
        <span className="hidden sm:inline">{m.copilot_launcher()}</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground lg:inline">
          {isMac() ? '⌘K' : 'Ctrl K'}
        </kbd>
      </Button>
      <Sheet open={sheetOpen} onOpenChange={setCopilotSheetOpen}>
        <SheetContent
          side={mobile ? 'bottom' : 'right'}
          showCloseButton={false}
          aria-describedby="copilot-description"
          className={cn(
            'gap-0 p-0',
            mobile
              ? 'inset-x-0 top-0 bottom-auto h-dvh w-full max-w-full border-t-0'
              : 'h-dvh w-full max-w-full sm:max-w-xl lg:max-w-2xl',
          )}
          style={
            mobile && viewport
              ? { height: viewport.height, top: viewport.top, bottom: 'auto' }
              : undefined
          }
        >
          <SheetTitle className="sr-only">{m.copilot_title()}</SheetTitle>
          <SheetDescription id="copilot-description" className="sr-only">
            {m.copilot_description()}
          </SheetDescription>
          <ChatHeader
            safeTop={mobile}
            title={chat.title ?? m.copilot_launcher()}
            leading={
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-muted-foreground"
                  aria-label={m.common_close()}
                >
                  <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </SheetClose>
            }
            menu={
              <>
                <DropdownMenuItem className="min-h-11" onSelect={chat.newChat}>
                  <SquarePen />
                  {m.chat_new()}
                </DropdownMenuItem>
                <DropdownMenuItem className="min-h-11" onSelect={() => setHistoryOpen(true)}>
                  <History />
                  {m.chat_threads()}
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="min-h-11">
                  <Link
                    to="/chat"
                    search={threadId ? { thread: threadId } : {}}
                    onClick={() => setCopilotSheetOpen(false)}
                  >
                    <Maximize2 />
                    {m.chat_open_fullscreen()}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="min-h-11">
                  <Link
                    to="/chat"
                    search={{ tab: 'settings' }}
                    onClick={() => setCopilotSheetOpen(false)}
                  >
                    <Settings2 />
                    {m.chat_tab_settings()}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-11"
                  disabled={!threadId}
                  onSelect={() => void exportThreadMarkdown(threadId)}
                >
                  <Download />
                  {m.cp_menu_export()}
                </DropdownMenuItem>
              </>
            }
          />
          <ChatView chat={chat} handlesRequests={sheetOpen} onOpenThread={onThreadId} />
        </SheetContent>
      </Sheet>
      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        selectedId={threadId}
        onSelect={(id) => {
          setHistoryOpen(false);
          onThreadId(id);
        }}
        onNew={() => {
          setHistoryOpen(false);
          chat.newChat();
        }}
        onGone={(id) => {
          if (id === threadId) chat.newChat();
        }}
      />
    </>
  );
}
