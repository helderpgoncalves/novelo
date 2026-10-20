import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UserAvatar, UserChip } from './user-chip';

afterEach(cleanup);

describe('UserChip', () => {
  it('mostra o nome, o email por baixo e as iniciais', () => {
    render(<UserChip person={{ name: 'Hélder Gonçalves', email: 'helder@x.pt' }} />);
    expect(screen.getByText('Hélder Gonçalves')).toBeTruthy();
    expect(screen.getByText('helder@x.pt')).toBeTruthy();
    expect(screen.getByText('HG')).toBeTruthy();
  });

  it('sem nome usa a parte local do email, nunca o email inteiro como nome', () => {
    render(<UserChip person={{ name: null, email: 'flavio@x.pt' }} />);
    expect(screen.getByText('Flavio')).toBeTruthy();
    expect(screen.getByText('flavio@x.pt')).toBeTruthy();
  });

  it('a variante inline não repete o email', () => {
    render(<UserChip variant="inline" person={{ name: 'Ana', email: 'ana@x.pt' }} />);
    expect(screen.queryByText('ana@x.pt')).toBeNull();
  });

  it('marca «Tu» na própria pessoa', () => {
    render(<UserChip you person={{ name: 'Ana', email: 'ana@x.pt' }} />);
    expect(screen.getByText('Tu')).toBeTruthy();
  });
});

describe('UserAvatar', () => {
  it('tem nome acessível com o papel quando está sozinho', () => {
    render(
      <UserAvatar person={{ name: 'Ana Silva', email: 'a@x.pt' }} roleLabel="Administrador" />,
    );
    expect(screen.getByRole('img', { name: 'Ana Silva, Administrador' })).toBeTruthy();
  });

  it('a foto leva privacidade, lazy e dimensões, e cai nas iniciais se falhar', () => {
    const { container } = render(
      <UserAvatar
        person={{ name: 'Ana Silva', avatar_url: 'https://lh3.googleusercontent.com/a' }}
      />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('width')).toBe('32');
    expect(img?.getAttribute('alt')).toBe('');
    if (img) fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('AS')).toBeTruthy();
  });

  it('sem nada utilizável mostra um ícone em vez de texto vazio', () => {
    const { container } = render(<UserAvatar person={{}} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
