import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PageTabs } from './page-tabs';

beforeAll(() => {
  class Noop {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', Noop);
  vi.stubGlobal('MutationObserver', Noop);
});
afterEach(cleanup);

function Harness() {
  const [tab, setTab] = useState<'a' | 'b'>('a');
  return (
    <PageTabs
      label="Vistas"
      value={tab}
      onValueChange={setTab}
      tabs={[
        {
          id: 'a',
          label: 'Alertas',
          count: 12,
          status: 'attention',
          statusLabel: '12 por resolver',
          content: <input aria-label="campo-a" />,
        },
        { id: 'b', label: 'Fontes', content: <p>Conteúdo B</p> },
      ]}
    />
  );
}

describe('PageTabs', () => {
  it('mostra contagem e estado acessível no separador', () => {
    render(<Harness />);
    const tab = screen.getByRole('tab', { name: /Alertas/ });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(tab).toHaveTextContent('12');
    expect(screen.getByRole('img', { name: '12 por resolver' })).toBeInTheDocument();
  });

  it('só monta o conteúdo depois da primeira visita e preserva o estado ao voltar', () => {
    render(<Harness />);
    expect(screen.queryByText('Conteúdo B')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('campo-a'), { target: { value: 'ronfe' } });
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Fontes/ }), { button: 0 });
    expect(screen.getByText('Conteúdo B')).toBeVisible();
    expect(screen.getByLabelText('campo-a', { selector: 'input' })).not.toBeVisible();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Alertas/ }), { button: 0 });
    expect(screen.getByLabelText('campo-a')).toHaveValue('ronfe');
  });

  it('a lista de separadores tem nome e as setas do teclado trocam de separador', async () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Vistas' })).toBeInTheDocument();
    const first = screen.getByRole('tab', { name: /Alertas/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByRole('tab', { name: /Fontes/ })).toHaveFocus());
  });
});
