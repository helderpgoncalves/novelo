import { Ellipsis } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

interface Props {
  title: string;
  /** `h1` na página, `h2` no painel. */
  level?: 'h1' | 'h2';
  /** Botão fechar/voltar. */
  leading?: ReactNode;
  /** Botões extra antes do menu "⋯". */
  actions?: ReactNode;
  /** Itens do menu "⋯" (`DropdownMenuItem`). */
  menu: ReactNode;
  /** Título fixo a partir de `sm` (a página mostra "Copiloto"; o título da conversa fica para telemóvel). */
  wideTitle?: string;
  /** Separadores na mesma linha do título, a partir de `sm`. */
  nav?: ReactNode;
  /** Folha em ecrã inteiro: deixa espaço para o entalhe do telemóvel. */
  safeTop?: boolean;
  className?: string;
}

/** Cabeçalho de uma só linha: fechar, título e menu com o resto; na página, com os separadores ao lado do título. */
export function ChatHeader({
  title,
  level: Level = 'h2',
  leading,
  actions,
  menu,
  wideTitle,
  nav,
  safeTop,
  className,
}: Props) {
  return (
    <header
      className={cn(
        'flex shrink-0 items-center gap-0.5 border-b bg-background px-1.5',
        safeTop
          ? 'h-[calc(3.25rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]'
          : 'h-13',
        nav && 'sm:h-14',
        className,
      )}
    >
      {leading}
      <Level
        className={cn(
          'min-w-0 flex-1 truncate font-medium font-serif text-[1.0625rem] tracking-tight',
          leading ? 'px-1' : 'px-2.5',
          nav && 'sm:flex-none sm:pr-6 sm:pl-0',
        )}
      >
        {wideTitle ? (
          <>
            <span className="sm:hidden">{title}</span>
            <span className="hidden sm:inline">{wideTitle}</span>
          </>
        ) : (
          title
        )}
      </Level>
      {nav && <div className="hidden h-full min-w-0 flex-1 sm:flex">{nav}</div>}
      {actions}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11" aria-label={m.cp_menu_label()}>
            <Ellipsis className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 rounded-xl p-1.5">
          {menu}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
