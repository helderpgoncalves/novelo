import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LOCKUP, BRAND_METRICS as M, STACKED, SYMBOL } from '@/components/brand-geometry.gen';
import { BrandLogo, BrandSymbol } from '@/components/brand-logo';

const nums = (s: string) => s.split(' ').map(Number);

describe('geometria do logótipo', () => {
  it('símbolo = altura de maiúscula + 2 overshoots, centrado no eixo das maiúsculas', () => {
    const t = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(LOCKUP.symbolTransform);
    const sx = Number(t?.[1]);
    const sy = Number(t?.[2]);
    expect(M.symbolInkHeight).toBeCloseTo(M.cap + 2 * M.overshoot, 6);
    // centro de tinta do símbolo (SYMBOL.viewBox) mapeado pelo transform
    const [, vy, , vh] = nums(SYMBOL.viewBox);
    const cy = (vy ?? 0) + (vh ?? 0) / 2;
    const scale = M.symbolScale;
    expect((sy ?? 0) + cy * scale).toBeCloseTo(-M.cap / 2, 2);
    expect(sx).toBeCloseTo(((nums(SYMBOL.viewBox)[2] ?? 0) / 2) * scale, 2);
  });

  it('caixa do lockup simétrica em torno do eixo do símbolo (centrar em flex fica exato)', () => {
    const [, y0, , h] = nums(LOCKUP.viewBox);
    expect((y0 ?? 0) + (h ?? 0) / 2).toBeCloseTo(-M.cap / 2, 3);
  });

  it('empilhado centrado no eixo vertical', () => {
    const [x0, , w] = nums(STACKED.viewBox);
    expect((x0 ?? 0) + (w ?? 0) / 2).toBeCloseTo(0, 3);
  });
});

describe('BrandLogo / BrandSymbol', () => {
  it('lockup tem nome acessível e o símbolo sozinho é decorativo', () => {
    const { getByRole, container } = render(
      <>
        <BrandLogo />
        <BrandSymbol />
      </>,
    );
    expect(getByRole('img', { name: 'Novelo' })).toBeTruthy();
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(1);
  });

  it('usa o viewBox gerado, sem margens', () => {
    const { container } = render(<BrandLogo stacked />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe(STACKED.viewBox);
  });
});
