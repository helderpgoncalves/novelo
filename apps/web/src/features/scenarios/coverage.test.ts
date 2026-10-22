import { describe, expect, it } from 'vitest';
import { coverageChannels } from './coverage';

describe('coverageChannels', () => {
  it('ordena os canais (porta a porta primeiro, contentor de rua por último) e tira repetidos', () => {
    expect(
      coverageChannels({ channels: ['street', 'detour', 'door_to_door', 'existing', 'detour'] }),
    ).toEqual(['door_to_door', 'existing', 'detour', 'street']);
  });

  it('sem canais, sem recolha', () => {
    expect(coverageChannels({ channels: [] })).toEqual([]);
  });
});
