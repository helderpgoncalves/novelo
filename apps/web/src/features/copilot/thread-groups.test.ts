import { describe, expect, it } from 'vitest';
import { dateGroup, groupThreads } from './thread-groups';

const now = new Date(2026, 9, 20, 15, 0);
const at = (daysAgo: number) => new Date(2026, 9, 20 - daysAgo, 9, 0).toISOString();

describe('grupos de conversas por data', () => {
  it('classifica hoje, ontem, semana, mês e mais antigas', () => {
    expect(dateGroup(at(0), now)).toBe('today');
    expect(dateGroup(at(1), now)).toBe('yesterday');
    expect(dateGroup(at(6), now)).toBe('week');
    expect(dateGroup(at(7), now)).toBe('month');
    expect(dateGroup(at(45), now)).toBe('older');
  });

  it('põe as fixadas primeiro e mantém a ordem dentro de cada grupo', () => {
    const groups = groupThreads(
      [
        { id: 'a', pinned: false, updated_at: at(0) },
        { id: 'b', pinned: true, updated_at: at(40) },
        { id: 'c', pinned: false, updated_at: at(0) },
      ],
      now,
    );
    expect(groups.map((g) => g.key)).toEqual(['pinned', 'today']);
    expect(groups[1]?.items.map((t) => t.id)).toEqual(['a', 'c']);
  });
});
