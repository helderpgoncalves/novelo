import { formatPercent, formatTonnes } from './format';

describe('format pt-PT', () => {
  it('usa vírgula decimal e unidade', () => {
    expect(formatTonnes(301.265)).toBe('301,3 t');
    expect(formatPercent(22.9)).toBe('22,9%');
  });
});
