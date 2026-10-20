export interface Trigger {
  kind: 'mention' | 'command';
  query: string;
  /** Posição do `@` ou `/` no texto. */
  start: number;
}

/** O que a pessoa está a escrever junto ao cursor: uma menção (`@bar`) ou um comando (`/comp`). */
export function findTrigger(text: string, caret: number): Trigger | null {
  const before = text.slice(0, caret);
  const command = /^\/(\S*)$/.exec(before);
  if (command) return { kind: 'command', query: command[1] ?? '', start: 0 };
  const mention = /(?:^|\s)@([^\s@]{0,40})$/.exec(before);
  if (mention) {
    const query = mention[1] ?? '';
    return { kind: 'mention', query, start: caret - query.length - 1 };
  }
  return null;
}

/** Troca o gatilho pelo texto escolhido (`@Barco `) e devolve o novo texto e a posição do cursor. */
export function applyTrigger(
  text: string,
  caret: number,
  trigger: Trigger,
  replacement: string,
): { text: string; caret: number } {
  const next = `${text.slice(0, trigger.start)}${replacement} ${text.slice(caret)}`;
  return { text: next, caret: trigger.start + replacement.length + 1 };
}

export const ACCEPTED_FILES =
  '.jpg,.jpeg,.png,.webp,.gif,.pdf,.csv,.xlsx,.txt,.md,.json,image/jpeg,image/png,image/webp,image/gif,application/pdf,text/csv,text/plain,text/markdown,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 5;
