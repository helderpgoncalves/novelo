import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Column, DataTable } from './index';

interface Row {
  id: string;
  name: string;
  kind: string;
  qty: number;
}

const rows: Row[] = Array.from({ length: 14 }, (_, i) => ({
  id: `r${i}`,
  name: i === 3 ? 'Azúrem' : `Circuito ${i}`,
  kind: i % 2 === 0 ? 'par' : 'ímpar',
  qty: i + 1,
}));

const columns: Column<Row>[] = [
  { id: 'name', header: 'Nome', cell: (r) => r.name, value: (r) => r.name, primary: true },
  { id: 'kind', header: 'Tipo', cell: (r) => r.kind, value: (r) => r.kind, filter: true },
  {
    id: 'qty',
    header: 'Qtd',
    align: 'right',
    cell: (r) => r.qty,
    value: (r) => r.qty,
    aggregate: 'sum',
  },
];

beforeAll(() => {
  class Noop {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', Noop);
  vi.stubGlobal('IntersectionObserver', Noop);
});

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

const bodyRows = () =>
  Array.from(screen.getByRole('table').querySelectorAll<HTMLElement>('tbody tr[data-row-index]'));

describe('DataTable', () => {
  it('mostra a barra, as linhas, o rodapé com contagens e o total', () => {
    render(
      <DataTable id="t1" columns={columns} rows={rows} getRowId={(r) => r.id} pageSize={10} />,
    );
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByTestId('dt-filters')).toBeInTheDocument();
    expect(screen.getByText(/1–10 de 14/)).toBeInTheDocument();
    // linhas + rodapé de totais (soma 1..14 = 105)
    expect(screen.getByText('105')).toBeInTheDocument();
  });

  it('pesquisa ignora acentos, mostra chip e "Limpar tudo" repõe as linhas', () => {
    render(
      <DataTable id="t2" columns={columns} rows={rows} getRowId={(r) => r.id} controls="always" />,
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'azurem' } });
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText(/filtrado de 14/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Filtros ativos' })).toHaveTextContent('azurem');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar tudo' }));
    expect(bodyRows().length).toBeGreaterThan(5);
  });

  it('sem resultados mostra ação para limpar', () => {
    render(
      <DataTable id="t3" columns={columns} rows={rows} getRowId={(r) => r.id} controls="always" />,
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzz' } });
    expect(screen.getByText('Sem resultados')).toBeInTheDocument();
    const clear = screen.getAllByRole('button', { name: 'Limpar tudo' });
    fireEvent.click(clear[clear.length - 1] as HTMLElement);
    expect(screen.queryByText('Sem resultados')).not.toBeInTheDocument();
  });

  it('ordena ao clicar no cabeçalho e indica aria-sort', () => {
    render(
      <DataTable id="t4" columns={columns} rows={rows} getRowId={(r) => r.id} controls="always" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ordenar por Qtd' }));
    expect(screen.getByRole('columnheader', { name: /Qtd/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ordenar por Qtd' }));
    expect(screen.getByRole('columnheader', { name: /Qtd/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(within(bodyRows()[0] as HTMLElement).getByText('14')).toBeInTheDocument();
  });

  it('seleção abre a barra e as ações em massa recebem as linhas', () => {
    const onAction = vi.fn();
    render(
      <DataTable
        id="t5"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        bulkActions={[
          { id: 'go', label: 'Fazer', disabled: (r) => r.length !== 2, onSelect: onAction },
        ]}
      />,
    );
    const boxes = screen.getAllByRole('checkbox', { name: /^Selecionar Circuito/ });
    fireEvent.click(boxes[0] as HTMLElement);
    const bar = screen.getByTestId('dt-selection-bar');
    expect(bar).toHaveTextContent('1 selecionadas');
    expect(within(bar).getByRole('button', { name: 'Fazer' })).toBeDisabled();
    fireEvent.click(boxes[1] as HTMLElement);
    fireEvent.click(within(bar).getByRole('button', { name: 'Fazer' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    const received = onAction.mock.calls[0]?.[0] as Row[] | undefined;
    expect(received?.map((r) => r.id)).toEqual(['r0', 'r1']);
  });

  it('teclado: setas movem entre linhas e Espaço seleciona', () => {
    render(
      <DataTable id="t6" columns={columns} rows={rows} getRowId={(r) => r.id} controls="always" />,
    );
    const first = bodyRows()[0] as HTMLElement;
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(bodyRows()[1]).toHaveFocus();
    fireEvent.keyDown(bodyRows()[1] as HTMLElement, { key: ' ' });
    expect(screen.getByTestId('dt-selection-bar')).toHaveTextContent('1 selecionadas');
    fireEvent.keyDown(bodyRows()[1] as HTMLElement, { key: 'Escape' });
    expect(screen.queryByTestId('dt-selection-bar')).not.toBeInTheDocument();
  });

  it('carregar: esqueleto com aria-busy, sem mostrar o vazio', () => {
    render(
      <DataTable
        id="t7"
        columns={columns}
        rows={[]}
        loading
        empty={<p>Vazio próprio</p>}
        getRowId={(r) => r.id}
      />,
    );
    expect(document.querySelector('section[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText('Vazio próprio')).not.toBeInTheDocument();
  });

  it('erro: mensagem localizada e Tentar de novo chama onRetry', () => {
    const onRetry = vi.fn();
    render(
      <DataTable
        id="t8"
        columns={columns}
        rows={[]}
        error={new Error('falhou')}
        onRetry={onRetry}
        getRowId={(r) => r.id}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar a tabela');
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('vazio: devolve o `empty` do chamador quando não há dados', () => {
    render(
      <DataTable
        id="t9"
        columns={columns}
        rows={[]}
        empty={<p>Nada aqui</p>}
        getRowId={(r) => r.id}
      />,
    );
    expect(screen.getByText('Nada aqui')).toBeInTheDocument();
  });

  it('atualizar em segundo plano: região viva a avisar', () => {
    render(<DataTable id="t10" columns={columns} rows={rows} refreshing getRowId={(r) => r.id} />);
    expect(screen.getByText('A atualizar os dados')).toBeInTheDocument();
  });

  it('o estado fica na URL e é lido ao montar', () => {
    const first = render(
      <DataTable id="t11" columns={columns} rows={rows} getRowId={(r) => r.id} controls="always" />,
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'azurem' } });
    expect(window.location.search).toContain('t.t11=');
    const url = window.location.href;
    first.unmount();
    window.history.replaceState(null, '', url);
    render(
      <DataTable id="t11" columns={columns} rows={rows} getRowId={(r) => r.id} controls="always" />,
    );
    expect(screen.getByRole('searchbox')).toHaveValue('azurem');
    expect(bodyRows()).toHaveLength(1);
  });
});
