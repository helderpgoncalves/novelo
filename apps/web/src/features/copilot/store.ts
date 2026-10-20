import { useSyncExternalStore } from 'react';

/** Pedido para abrir o copiloto, opcionalmente com uma pergunta (enviada logo, ou só escrita). */
export interface CopilotRequest {
  id: number;
  question: string | null;
  send: boolean;
  threadId: string | null;
}

interface UiState {
  sheetOpen: boolean;
  request: CopilotRequest | null;
}

let state: UiState = { sheetOpen: false, request: null };
let counter = 0;
let pages = 0;
const listeners = new Set<() => void>();

const emit = (next: UiState) => {
  state = next;
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/**
 * Abre o copiloto: o painel lateral (⌘K) ou, se a página /chat estiver aberta, essa página.
 * Com `question` a pergunta segue logo (`send: false` só a escreve no campo).
 */
export function openCopilot(
  options: { question?: string; send?: boolean; threadId?: string } = {},
) {
  const request: CopilotRequest | null =
    options.question || options.threadId
      ? {
          id: ++counter,
          question: options.question ?? null,
          send: options.send ?? true,
          threadId: options.threadId ?? null,
        }
      : null;
  emit({ sheetOpen: pages === 0 ? true : state.sheetOpen, request });
}

export function toggleCopilotSheet() {
  if (pages > 0) {
    emit({ ...state, request: { id: ++counter, question: null, send: false, threadId: null } });
    return;
  }
  emit({ ...state, sheetOpen: !state.sheetOpen });
}

export function setCopilotSheetOpen(open: boolean) {
  emit({ ...state, sheetOpen: open });
}

export function consumeCopilotRequest(id: number) {
  if (state.request?.id === id) emit({ ...state, request: null });
}

/** A página /chat regista-se enquanto está aberta: ⌘K e as perguntas vão para ela em vez do painel. */
export function registerChatPage(): () => void {
  pages += 1;
  if (state.sheetOpen) emit({ ...state, sheetOpen: false });
  return () => {
    pages -= 1;
  };
}

export const useCopilotUi = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
