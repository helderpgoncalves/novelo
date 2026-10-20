import { type ReactNode, useRef } from 'react';
import { type TabStatus, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface PageTab<T extends string> {
  id: T;
  label: string;
  /** Contagem opcional, num badge neutro ao lado do rótulo; não se mostra a zero. */
  count?: number;
  /** Ponto (`attention`) ou triângulo (`error`) quando o separador precisa de atenção. */
  status?: TabStatus;
  /** Texto do estado para leitores de ecrã (ex.: "3 alertas por resolver"). */
  statusLabel?: string;
  /** Ícone só quando distingue (ex.: um estado), nunca decorativo. */
  icon?: ReactNode;
  content: ReactNode;
  contentClassName?: string;
}

interface PageTabsProps<T extends string> {
  tabs: PageTab<T>[];
  value: T;
  onValueChange: (value: T) => void;
  label: string;
  className?: string;
}

/**
 * Separadores de página: uma vista de cada vez para o detalhe secundário. Fio inferior de 1 px com sublinhado ativo de 2 px (animado), contagens discretas,
 * indicador de atenção/erro, rolagem com esbatido nas margens (e setas em ecrãs largos) quando não cabem, setas do teclado e o estado de cada separador (pesquisa,
 * filtros, rolagem) preservado ao voltar: os separadores já visitados ficam montados e escondidos.
 * O separador ativo deve viver na URL (`validateSearch`), a cargo de quem usa.
 */
export function PageTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  label,
  className,
}: PageTabsProps<T>) {
  const visited = useRef(new Set<T>());
  visited.current.add(value);

  return (
    <Tabs
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn('gap-4', className)}
    >
      <TabsList variant="line" aria-label={label} className="w-full">
        {tabs.map((t) => (
          <TabsTrigger
            key={t.id}
            value={t.id}
            count={t.count !== undefined && t.count > 0 ? t.count : undefined}
            status={t.status}
            statusLabel={t.statusLabel}
            icon={t.icon}
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent
          key={t.id}
          value={t.id}
          forceMount
          hidden={t.id !== value}
          className={cn('min-w-0 data-[state=inactive]:hidden', t.contentClassName)}
        >
          {visited.current.has(t.id) ? t.content : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
