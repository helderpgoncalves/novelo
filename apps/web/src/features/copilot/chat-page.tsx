import { useNavigate } from '@tanstack/react-router';
import { MessagesSquare, PanelLeft, Sparkles, SquarePen } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { m } from '@/paraglide/messages';
import { ActionsTab } from './actions-tab';
import { ChatView } from './chat-view';
import { GalleryTab } from './gallery-tab';
import { type ChatTab, HistoryTab } from './history-tab';
import { SettingsTab } from './settings/settings-tab';
import { registerChatPage, useCopilotUi } from './store';
import { ThreadList } from './thread-list';
import { useChat } from './use-chat';

export type { ChatTab } from './history-tab';

/** Página /chat: conversas à esquerda, a conversa ao centro e, noutros separadores, histórico, artefactos, ações e definições. */
export function ChatPage({
  thread,
  tab,
  isAdmin,
}: {
  thread: string | null;
  tab: ChatTab;
  isAdmin: boolean;
}) {
  const navigate = useNavigate({ from: '/chat' });
  const ui = useCopilotUi();
  const [listOpen, setListOpen] = useState(false);

  const go = useCallback(
    (patch: { tab?: ChatTab; thread?: string | null }, replace = false) =>
      void navigate({
        search: (prev) => ({
          ...prev,
          ...('tab' in patch ? { tab: patch.tab === 'chat' ? undefined : patch.tab } : {}),
          ...('thread' in patch ? { thread: patch.thread ?? undefined } : {}),
        }),
        replace,
      }),
    [navigate],
  );
  const onThreadId = useCallback((id: string | null) => go({ thread: id }, true), [go]);
  const chat = useChat({ threadId: thread, onThreadId });

  useEffect(() => registerChatPage(), []);
  // Uma pergunta vinda de fora (`openCopilot`) leva à conversa.
  useEffect(() => {
    if (ui.request && tab !== 'chat') go({ tab: 'chat' }, true);
  }, [ui.request, tab, go]);

  const openThread = useCallback(
    (id: string) => {
      setListOpen(false);
      go({ tab: 'chat', thread: id });
    },
    [go],
  );

  const list = (
    <ThreadList
      selectedId={thread}
      onSelect={openThread}
      onNew={() => {
        setListOpen(false);
        chat.newChat();
      }}
      onGone={(id) => {
        if (id === thread) chat.newChat();
      }}
      className="h-full"
    />
  );

  const tabs: { id: ChatTab; label: string }[] = [
    { id: 'chat', label: m.chat_tab_chat() },
    { id: 'history', label: m.chat_tab_history() },
    { id: 'artifacts', label: m.chat_tab_artifacts() },
    { id: 'actions', label: m.chat_tab_actions() },
    { id: 'settings', label: m.chat_tab_settings() },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="copilot-page">
      <header className="shrink-0 border-b bg-background">
        <div className="flex items-center gap-2 px-4 pt-3 sm:px-6 lg:px-8">
          <Sparkles className="size-5 text-primary" aria-hidden="true" />
          <h1 className="min-w-0 flex-1 truncate font-serif text-xl sm:text-2xl">
            {tab === 'chat' && chat.title ? chat.title : m.chat_page_title()}
          </h1>
          {tab === 'chat' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-1.5 lg:hidden"
                onClick={() => setListOpen(true)}
              >
                <PanelLeft className="size-4" aria-hidden="true" />
                {m.chat_threads()}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-1.5 lg:hidden"
                onClick={chat.newChat}
              >
                <SquarePen className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{m.chat_new()}</span>
                <span className="sr-only sm:hidden">{m.chat_new()}</span>
              </Button>
            </>
          )}
        </div>
        <Tabs value={tab} onValueChange={(v) => go({ tab: v as ChatTab })}>
          <div className="overflow-x-auto px-4 sm:px-6 lg:px-8">
            <TabsList
              variant="line"
              aria-label={m.chat_page_title()}
              className="h-auto w-max min-w-full justify-start gap-1 pb-0"
            >
              {tabs.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="h-11 flex-none px-3.5 sm:px-4">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </header>

      {tab === 'chat' ? (
        <div className="flex min-h-0 flex-1">
          <aside
            className="hidden w-80 shrink-0 border-r bg-card/40 lg:block xl:w-96"
            aria-label={m.chat_threads()}
          >
            {list}
          </aside>
          <ChatView chat={chat} handlesRequests onOpenThread={openThread} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
            {tab === 'history' && (
              <HistoryTab onOpenThread={openThread} onGo={(t) => go({ tab: t })} />
            )}
            {tab === 'artifacts' && <GalleryTab onOpenThread={openThread} />}
            {tab === 'actions' && <ActionsTab isAdmin={isAdmin} onOpenThread={openThread} />}
            {tab === 'settings' && (
              <SettingsTab
                onOpenThread={openThread}
                onDeleted={() => {
                  chat.newChat();
                }}
              />
            )}
          </div>
        </div>
      )}

      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetContent side="left" className="w-full max-w-full gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b px-4 py-3 pr-14">
            <SheetTitle className="flex items-center gap-2 font-serif text-xl">
              <MessagesSquare className="size-5 text-primary" aria-hidden="true" />
              {m.chat_threads()}
            </SheetTitle>
            <SheetDescription className="sr-only">{m.chat_threads_description()}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1">{list}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
