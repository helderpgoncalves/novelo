import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, Download, History, SquarePen } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { m } from '@/paraglide/messages';
import { ActionsTab } from './actions-tab';
import { ChatHeader } from './chat-header';
import { ChatView } from './chat-view';
import { exportThreadMarkdown } from './export-thread';
import { GalleryTab } from './gallery-tab';
import { HistorySheet } from './history-sheet';
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
      <ChatHeader
        level="h1"
        className="sm:px-6 lg:px-8"
        wideTitle={m.chat_page_title()}
        nav={
          <Tabs
            value={tab}
            onValueChange={(v) => go({ tab: v as ChatTab })}
            className="h-full min-w-0 gap-0"
          >
            <TabsList
              variant="line"
              aria-label={m.chat_page_title()}
              className="h-full w-max min-w-0 gap-1 border-b-0 pb-0"
            >
              {tabs.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="h-full px-3.5 sm:px-4">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
        title={
          tab === 'chat'
            ? (chat.title ?? m.chat_page_title())
            : (tabs.find((t) => t.id === tab)?.label ?? m.chat_page_title())
        }
        leading={
          tab !== 'chat' ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-11 text-muted-foreground sm:hidden"
              aria-label={m.chat_tab_chat()}
              onClick={() => go({ tab: 'chat' })}
            >
              <ChevronLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          ) : undefined
        }
        actions={
          tab === 'chat' ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-11 text-muted-foreground lg:hidden"
              aria-label={m.chat_threads()}
              onClick={() => setListOpen(true)}
            >
              <History className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          ) : undefined
        }
        menu={
          <>
            <DropdownMenuItem
              className="min-h-11"
              onSelect={() => {
                if (tab !== 'chat') go({ tab: 'chat' });
                chat.newChat();
              }}
            >
              <SquarePen />
              {m.chat_new()}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-11"
              disabled={!chat.threadId}
              onSelect={() => void exportThreadMarkdown(chat.threadId)}
            >
              <Download />
              {m.cp_menu_export()}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="sm:hidden" />
            {tabs
              .filter((t) => t.id !== tab)
              .map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  className="min-h-11 sm:hidden"
                  onSelect={() => go({ tab: t.id })}
                >
                  {t.label}
                </DropdownMenuItem>
              ))}
          </>
        }
      />
      {tab === 'chat' ? (
        <div className="flex min-h-0 flex-1">
          <aside
            className="hidden w-80 shrink-0 border-r bg-card/40 lg:block"
            aria-label={m.chat_threads()}
          >
            {list}
          </aside>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {chat.title && (
              <div className="hidden h-11 shrink-0 items-center border-b px-6 sm:flex lg:px-8">
                <h2
                  className="truncate font-medium font-serif text-base tracking-tight"
                  data-testid="copilot-thread-title"
                >
                  {chat.title}
                </h2>
              </div>
            )}
            <ChatView chat={chat} layout="page" handlesRequests onOpenThread={openThread} />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:px-8">
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

      <HistorySheet
        open={listOpen}
        onOpenChange={setListOpen}
        selectedId={thread}
        onSelect={openThread}
        onNew={() => {
          setListOpen(false);
          chat.newChat();
        }}
        onGone={(id) => {
          if (id === thread) chat.newChat();
        }}
      />
    </div>
  );
}
