import { describe, expect, it } from 'vitest';
import { destinationFor, EXPORT_KEY_AXES, FINE_STATES } from '@/lib/taxonomy';

describe('taxonomia da triagem (espelho de domain/taxonomy.py)', () => {
  it('mapeia os 4 graus para reutilização e reciclar/rejeitar para os seus destinos', () => {
    expect(destinationFor('grade_a')).toBe('reuse');
    expect(destinationFor('grade_b')).toBe('reuse');
    expect(destinationFor('grade_c')).toBe('reuse');
    expect(destinationFor('grade_d')).toBe('reuse');
    expect(destinationFor('recycle')).toBe('recycle');
    expect(destinationFor('reject')).toBe('reject');
  });

  it('tem 6 estados finos e a chave do lote de escoamento exclui cor e tamanho', () => {
    expect(FINE_STATES).toHaveLength(6);
    expect(EXPORT_KEY_AXES).toEqual(['fine_state', 'garment_type', 'season', 'gender']);
    expect(EXPORT_KEY_AXES).not.toContain('colour');
    expect(EXPORT_KEY_AXES).not.toContain('size_band');
  });
});
