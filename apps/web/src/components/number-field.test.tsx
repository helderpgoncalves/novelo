import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { formatFieldNumber, NumberField, parseFieldNumber } from './number-field';

describe('formatFieldNumber e parseFieldNumber', () => {
  it('mostra vírgula decimal pt-PT, sem milhares e com no máximo 4 casas', () => {
    expect(formatFieldNumber(1.2353)).toBe('1,2353');
    expect(formatFieldNumber(1.23528342)).toBe('1,2353');
    expect(formatFieldNumber(1200)).toBe('1200');
    expect(formatFieldNumber(0.5)).toBe('0,5');
  });

  it('aceita vírgula ou ponto e rejeita texto inválido', () => {
    expect(parseFieldNumber('1,25')).toBe(1.25);
    expect(parseFieldNumber('1.25')).toBe(1.25);
    expect(parseFieldNumber(' 12 ')).toBe(12);
    expect(parseFieldNumber('1,')).toBe(1);
    expect(Number.isNaN(parseFieldNumber(''))).toBe(true);
    expect(Number.isNaN(parseFieldNumber('abc'))).toBe(true);
    expect(Number.isNaN(parseFieldNumber('1,2,3'))).toBe(true);
  });
});

function Controlled({ initial, percent }: { initial: number; percent?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumberField label="Valor" value={value} onChange={setValue} percent={percent} step={0.1} />
      <output data-testid="stored">{String(value)}</output>
    </>
  );
}

describe('NumberField', () => {
  it('mostra o valor com vírgula (nunca «1.2353») e guarda o número', () => {
    render(<Controlled initial={1.2352834279155773} />);
    const input = screen.getByRole('spinbutton', { name: 'Valor' });
    expect(input).toHaveValue('1,2353');
    fireEvent.change(input, { target: { value: '1,5' } });
    expect(screen.getByTestId('stored')).toHaveTextContent('1.5');
    // Enquanto escreve, o texto fica como está («1,»); ao sair do campo volta ao formato pt-PT.
    fireEvent.change(input, { target: { value: '2,' } });
    expect(input).toHaveValue('2,');
    fireEvent.blur(input);
    expect(input).toHaveValue('2');
  });

  it('em percentagem mostra 0 a 100 e guarda a fração', () => {
    render(<Controlled initial={0.18} percent />);
    const input = screen.getByRole('spinbutton', { name: 'Valor' });
    expect(input).toHaveValue('18');
    fireEvent.change(input, { target: { value: '22,5' } });
    expect(screen.getByTestId('stored')).toHaveTextContent('0.225');
  });

  it('as setas somam e subtraem o passo, dentro dos limites', () => {
    const onChange = vi.fn();
    render(<NumberField label="Valor" value={0.95} onChange={onChange} step={0.1} max={1} />);
    const input = screen.getByRole('spinbutton', { name: 'Valor' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(1);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(0.9);
  });
});
