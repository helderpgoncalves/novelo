import type { MentionRef } from '@/client';

/** Menção escolhida da lista: o rótulo é o texto que fica no campo a seguir ao `@`. */
export interface ResolvedMention {
  ref: MentionRef;
  label: string;
}

export interface MentionSpan {
  start: number;
  end: number;
  mention: ResolvedMention;
}

export interface Segment {
  text: string;
  mention?: ResolvedMention;
}

// Uma menção só conta como unidade quando está isolada: depois de espaço/abertura e antes de espaço/pontuação.
const BEFORE_OK = /[\s(«"“[]/;
const AFTER_OK = /[\s.,;:!?)\]»"”'’]/;

/** Onde estão as menções resolvidas no texto (`@Azurém`). Texto `@xyz` que não foi escolhido nunca entra. */
export function findMentionSpans(text: string, mentions: ResolvedMention[]): MentionSpan[] {
  const sorted = mentions.filter((x) => x.label).sort((a, b) => b.label.length - a.label.length);
  const spans: MentionSpan[] = [];
  for (const mention of sorted) {
    const needle = `@${mention.label}`;
    let from = 0;
    for (;;) {
      const start = text.indexOf(needle, from);
      if (start < 0) break;
      from = start + 1;
      const end = start + needle.length;
      const before = start === 0 || BEFORE_OK.test(text.charAt(start - 1));
      const after = end === text.length || AFTER_OK.test(text.charAt(end));
      if (!before || !after) continue;
      if (spans.some((s) => start < s.end && end > s.start)) continue;
      spans.push({ start, end, mention });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

/** Parte o texto em troços simples e menções, para o campo e para a mensagem enviada. */
export function segmentText(text: string, mentions: ResolvedMention[]): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const s of findMentionSpans(text, mentions)) {
    if (s.start > at) out.push({ text: text.slice(at, s.start) });
    out.push({ text: text.slice(s.start, s.end), mention: s.mention });
    at = s.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

/** Só as menções que ainda estão no texto (apagou-se ou editou-se o resto, deixam de seguir). */
export function pruneMentions(text: string, mentions: ResolvedMention[]): ResolvedMention[] {
  const spans = findMentionSpans(text, mentions);
  return mentions.filter((x) => spans.some((s) => s.mention === x));
}

/**
 * O cursor nunca fica a meio de uma menção: salta para a margem que o movimento indica
 * (`previous` é a posição anterior; sem ela, a margem mais próxima). Uma seleção que corta
 * uma menção alarga-se para a apanhar inteira.
 */
export function snapSelection(
  spans: MentionSpan[],
  start: number,
  end: number,
  previous: number | null = null,
): [number, number] {
  if (start === end) {
    const s = spans.find((x) => start > x.start && start < x.end);
    if (!s) return [start, end];
    let to: number;
    if (previous !== null && previous !== start) to = start > previous ? s.end : s.start;
    else to = start - s.start < s.end - start ? s.start : s.end;
    return [to, to];
  }
  const a = spans.find((x) => start > x.start && start < x.end);
  const b = spans.find((x) => end > x.start && end < x.end);
  return [a ? a.start : start, b ? b.end : end];
}

/** Backspace/Delete junto a uma menção apaga-a toda; `null` quando não há nada de especial a fazer. */
export function mentionDeletion(
  spans: MentionSpan[],
  start: number,
  end: number,
  key: 'Backspace' | 'Delete',
): { start: number; end: number } | null {
  if (start !== end) return null;
  const s =
    key === 'Backspace'
      ? spans.find((x) => start > x.start && start <= x.end)
      : spans.find((x) => start >= x.start && start < x.end);
  return s ? { start: s.start, end: s.end } : null;
}

/** Posição seguinte numa lista com volta ao princípio/fim (setas ↑/↓). */
export function stepIndex(current: number, count: number, delta: 1 | -1): number {
  if (count <= 0) return 0;
  return (((current + delta) % count) + count) % count;
}
