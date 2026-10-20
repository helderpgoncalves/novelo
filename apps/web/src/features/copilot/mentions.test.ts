import { describe, expect, it } from 'vitest';
import {
  findMentionSpans,
  mentionDeletion,
  pruneMentions,
  type ResolvedMention,
  segmentText,
  snapSelection,
  stepIndex,
} from './mentions';

const azurem: ResolvedMention = { ref: { type: 'parish', id: 'p1' }, label: 'Azurém' };
const longer: ResolvedMention = { ref: { type: 'locality', id: 'l1' }, label: 'Azurém de Baixo' };

describe('menções no texto', () => {
  it('só reconhece menções escolhidas, isoladas e inteiras', () => {
    const text = 'compara @Azurém com @xyz e x@Azurém e @Azurémx';
    const spans = findMentionSpans(text, [azurem]);
    expect(spans).toHaveLength(1);
    expect(text.slice(spans[0]?.start, spans[0]?.end)).toBe('@Azurém');
  });

  it('aceita pontuação a seguir e prefere o rótulo mais longo', () => {
    expect(findMentionSpans('vê @Azurém, ok', [azurem])).toHaveLength(1);
    const spans = findMentionSpans('vê @Azurém de Baixo.', [azurem, longer]);
    expect(spans.map((s) => s.mention.label)).toEqual(['Azurém de Baixo']);
  });

  it('parte o texto em troços com a menção marcada', () => {
    const parts = segmentText('olá @Azurém e mais', [azurem]);
    expect(parts.map((p) => p.text)).toEqual(['olá ', '@Azurém', ' e mais']);
    expect(parts.map((p) => !!p.mention)).toEqual([false, true, false]);
    expect(segmentText('sem nada', [azurem])).toEqual([{ text: 'sem nada' }]);
  });

  it('deixa de seguir a menção quando o texto foi editado', () => {
    expect(pruneMentions('olá @Azurém ', [azurem])).toEqual([azurem]);
    expect(pruneMentions('olá @Azur ', [azurem])).toEqual([]);
  });
});

describe('cursor e apagar como unidade', () => {
  const text = 'a @Azurém b'; // menção em [2, 9)
  const spans = findMentionSpans(text, [azurem]);

  it('o cursor salta para a margem do movimento', () => {
    expect(snapSelection(spans, 5, 5, 1)).toEqual([9, 9]); // para a direita
    expect(snapSelection(spans, 5, 5, 9)).toEqual([2, 2]); // para a esquerda
    expect(snapSelection(spans, 3, 3, null)).toEqual([2, 2]); // clique: margem mais próxima
    expect(snapSelection(spans, 9, 9, 5)).toEqual([9, 9]); // na margem não mexe
  });

  it('alarga a seleção que corta a menção', () => {
    expect(snapSelection(spans, 4, 11, null)).toEqual([2, 11]);
    expect(snapSelection(spans, 0, 5, null)).toEqual([0, 9]);
  });

  it('Backspace e Delete apagam a menção toda', () => {
    expect(mentionDeletion(spans, 9, 9, 'Backspace')).toEqual({ start: 2, end: 9 });
    expect(mentionDeletion(spans, 2, 2, 'Delete')).toEqual({ start: 2, end: 9 });
    expect(mentionDeletion(spans, 2, 2, 'Backspace')).toBeNull();
    expect(mentionDeletion(spans, 10, 10, 'Backspace')).toBeNull();
    expect(mentionDeletion(spans, 2, 9, 'Backspace')).toBeNull();
  });
});

describe('navegação nas listas', () => {
  it('as setas dão a volta nos dois sentidos', () => {
    expect(stepIndex(0, 3, 1)).toBe(1);
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 3, -1)).toBe(2);
    expect(stepIndex(0, 0, 1)).toBe(0);
  });
});
