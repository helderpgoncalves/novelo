import { useNavigate } from '@tanstack/react-router';
import { Download, Ellipsis, History, SquarePen } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { m } from '@/paraglide/messages';
import { ActionsTab } from './actions-tab';
import { ChatView } from './chat-view';
import { exportThreadMarkdown } from './export-thread';
import { GalleryTab } from './gallery-tab';
import { HistorySheet } from './history-sheet';
import { type ChatTab, HistoryTab } from './history-tab';
import { SettingsTab } from './settings/settings-tab';
import { registerChatPage, useCopilotUi } from './store';
import { ThreadBar } from './thread-bar';
import { ThreadList } from './thread-list';
import { useChat } from './use-chat';

export type { ChatTab } from './history-tab';

const LIST_KEY = 'novelo.copilot.list';

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
  // Coluna de conversas (a partir de `md`): recolhível, lembra a escolha.
  const [listVisible, setListVisible] = useState(() => localStorage.getItem(LIST_KEY) !== 'closed');
  const toggleList = useCallback(() => {
    setListVisible((v) => {
      localStorage.setItem(LIST_KEY, v ? 'closed' : 'open');
      return !v;
    });
  }, []);

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
      heading
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
  const mobileTitle = tab === 'chat' && chat.title ? chat.title : m.chat_page_title();

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="copilot-page">
      {/* Barra única da página: marca e secções à esquerda, ações à direita. Em telemóvel as secções passam
          para uma segunda linha deslizante, dentro da mesma barra (um só fio por baixo). */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-2 border-b bg-background px-2 sm:flex-nowrap sm:gap-x-4 sm:px-4 lg:px-6">
        <div className="flex h-14 min-w-0 flex-1 items-center gap-0.5 sm:flex-none">
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 text-muted-foreground md:hidden"
            aria-label={m.chat_threads()}
            onClick={() => setListOpen(true)}
          >
            <History className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </Button>
          <h1 className="min-w-0 truncate px-1.5 font-medium font-serif text-[1.25rem] tracking-tight md:px-0">
            <span className="md:hidden">{mobileTitle}</span>
            <span className="hidden md:inline">{m.chat_page_title()}</span>
          </h1>
        </div>
        <div className="order-last w-full min-w-0 px-1 pb-2 sm:order-none sm:w-auto sm:flex-1 sm:px-0 sm:pb-0">
          <Tabs
            value={tab}
            onValueChange={(v) => go({ tab: v as ChatTab })}
            className="min-w-0 gap-0"
          >
            {/* Telemóvel: as cinco secções repartem a largura (cabem todas a partir de ~375 px, sem rótulos cortados). */}
            <TabsList
              aria-label={m.chat_page_title()}
              className="max-sm:w-full group-data-[orientation=horizontal]/tabs:h-12 sm:group-data-[orientation=horizontal]/tabs:h-10"
            >
              {tabs.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="max-sm:flex-1 max-sm:text-[13px] group-data-[variant=default]/tabs-list:h-full group-data-[variant=default]/tabs-list:px-1 sm:group-data-[variant=default]/tabs-list:px-3.5"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 text-muted-foreground sm:size-10"
              aria-label={m.cp_menu_label()}
            >
              <Ellipsis className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56 rounded-xl p-1.5">
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
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {tab === 'chat' ? (
        <div className="flex min-h-0 flex-1">
          {listVisible && (
            <aside
              className="hidden w-72 shrink-0 border-r bg-muted/30 md:block lg:w-80 xl:w-88"
              aria-label={m.chat_threads()}
            >
              {list}
            </aside>
          )}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ThreadBar chat={chat} listVisible={listVisible} onToggleList={toggleList} />
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
