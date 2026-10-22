import { describe, expect, it } from 'vitest';
import { coverageChannels } from './coverage';

describe('coverageChannels', () => {
  it('ordena os canais (saco à porta primeiro, contentor de rua por último) e tira repetidos', () => {
    expect(coverageChannels({ channels: ['street', 'existing', 'on_demand', 'existing'] })).toEqual(
      ['on_demand', 'existing', 'street'],
    );
  });

  it('sem canais, sem recolha', () => {
    expect(coverageChannels({ channels: [] })).toEqual([]);
  });
});
