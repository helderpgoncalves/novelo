import { describe, expect, it } from 'vitest';
import {
  isOverload,
  PLATE_MAX_G,
  suggestPlateParts,
  totalUnitsWeightG,
  unitWeightFromPlates,
} from './plates';

// Valores calculados à mão: a balança KERN IXC pesa em pratos ≤ 15 kg; um saco pesado soma vários pratos.
describe('pratos da balança (≤ 15 kg)', () => {
  it('o limite do prato é o da balança KERN (faixa 6/15 kg)', () => {
    expect(PLATE_MAX_G).toBe(15_000);
  });

  it('uma leitura até 15 kg cabe num prato; acima sobrecarrega', () => {
    expect(isOverload(15_000)).toBe(false);
    expect(isOverload(15_001)).toBe(true);
    expect(isOverload(2_600)).toBe(false);
  });

  it('o peso do saco é a soma dos pratos em que foi pesado', () => {
    expect(unitWeightFromPlates([4_200, 3_800])).toBe(8_000);
    expect(unitWeightFromPlates([15_000, 1])).toBe(15_001);
    expect(unitWeightFromPlates([4_300])).toBe(4_300);
    expect(unitWeightFromPlates([])).toBe(0);
  });

  it('divide um saco pesado pelos pratos: 46,8 kg → 3 pratos cheios + 1,8 kg', () => {
    expect(suggestPlateParts(46_800)).toEqual([15_000, 15_000, 15_000, 1_800]);
  });

  it('um saco que cabe fica num prato só, mesmo no limite', () => {
    expect(suggestPlateParts(15_000)).toEqual([15_000]);
    expect(suggestPlateParts(14_999)).toEqual([14_999]);
    expect(suggestPlateParts(4_000)).toEqual([4_000]);
  });

  it('não sugere pratos para peso desconhecido ou impossível', () => {
    expect(suggestPlateParts(0)).toEqual([]);
    expect(suggestPlateParts(-3)).toEqual([]);
  });

  it('o limite do prato pode ser outro (balança menor de demonstração)', () => {
    expect(suggestPlateParts(6_500, 6_000)).toEqual([6_000, 500]);
  });

  it('o total do lote é a soma dos sacos já pesados', () => {
    expect(totalUnitsWeightG([{ weightG: 4_200 }, { weightG: 3_800 }])).toBe(8_000);
    // Um saco sem peso ainda (não passou pela balança) não conta.
    expect(totalUnitsWeightG([{ weightG: null }, { weightG: 2_600 }])).toBe(2_600);
    expect(totalUnitsWeightG([])).toBe(0);
  });
});
