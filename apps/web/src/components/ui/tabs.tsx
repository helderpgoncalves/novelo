import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn('group/tabs flex gap-2 data-[orientation=horizontal]:flex-col', className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  'group/tabs-list relative inline-flex w-fit max-w-full items-center justify-start text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden group-data-[orientation=horizontal]/tabs:overflow-x-auto group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col',
  {
    variants: {
      variant: {
        // Segmentado: uma pastilha desliza por baixo do separador ativo.
        default:
          'gap-0.5 rounded-lg bg-muted p-[3px] group-data-[orientation=horizontal]/tabs:h-10',
        // Linha: sublinhado animado, o desenho para separadores de página.
        line: 'gap-1 rounded-none bg-transparent group-data-[orientation=horizontal]/tabs:border-b',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface Indicator {
  x: number;
  w: number;
}

/**
 * Lista de separadores com indicador animado (linha ou pastilha), rolagem horizontal quando não cabe e
 * setas nas extremidades. O indicador segue o separador ativo (`data-state`) e o seu tamanho, por isso
 * funciona com qualquer conteúdo e em qualquer ecrã.
 */
function TabsList({
  className,
  variant = 'default',
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = React.useState<Indicator | null>(null);
  const [ready, setReady] = React.useState(false);
  const [edge, setEdge] = React.useState({ start: false, end: false });
  const lastActive = React.useRef<HTMLElement | null>(null);

  const measure = React.useCallback(() => {
    const list = ref.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    if (active) {
      const next = { x: active.offsetLeft, w: active.offsetWidth };
      setIndicator((prev) => (prev && prev.x === next.x && prev.w === next.w ? prev : next));
      if (active !== lastActive.current) {
        lastActive.current = active;
        const left = active.offsetLeft;
        const right = left + active.offsetWidth;
        if (left < list.scrollLeft + 24 || right > list.scrollLeft + list.clientWidth - 24) {
          list.scrollTo?.({
            left: left - (list.clientWidth - active.offsetWidth) / 2,
            behavior: 'smooth',
          });
        }
      }
    } else {
      setIndicator(null);
    }
    const start = list.scrollLeft > 2;
    const end = list.scrollLeft + list.clientWidth < list.scrollWidth - 2;
    setEdge((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  React.useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    measure();
    // Só depois da primeira medição é que o indicador passa a animar (sem "voar" desde a esquerda).
    const frame = requestAnimationFrame(() => setReady(true));
    const mutations = new MutationObserver(measure);
    mutations.observe(list, {
      attributes: true,
      attributeFilter: ['data-state'],
      subtree: true,
      childList: true,
    });
    const resize = new ResizeObserver(measure);
    resize.observe(list);
    for (const child of list.children) resize.observe(child);
    list.addEventListener('scroll', measure, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resize.disconnect();
      list.removeEventListener('scroll', measure);
    };
  }, [measure]);

  const scrollBy = (dir: -1 | 1) =>
    ref.current?.scrollBy?.({ left: dir * ref.current.clientWidth * 0.6, behavior: 'smooth' });
  const arrow =
    'absolute top-0 z-20 hidden h-full w-9 items-center from-background via-background/90 to-transparent text-muted-foreground hover:text-foreground group-data-[orientation=horizontal]/tabs:flex';

  return (
    <div className="relative min-w-0 max-w-full" data-slot="tabs-list-wrap">
      <TabsPrimitive.List
        ref={ref}
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      >
        {indicator && (
          <span
            aria-hidden="true"
            data-slot="tabs-indicator"
            className={cn(
              'pointer-events-none absolute left-0 group-data-[orientation=vertical]/tabs:hidden motion-reduce:transition-none',
              ready && 'transition-[transform,width] duration-200 ease-out',
              variant === 'line'
                ? '-bottom-px h-0.5 rounded-full bg-primary'
                : 'inset-y-[3px] rounded-md bg-background shadow-sm ring-1 ring-foreground/5',
            )}
            style={{ width: indicator.w, transform: `translateX(${indicator.x}px)` }}
          />
        )}
        {children}
      </TabsPrimitive.List>
      {edge.start && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => scrollBy(-1)}
          className={cn(arrow, 'left-0 justify-start bg-gradient-to-r')}
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      {edge.end && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => scrollBy(1)}
          className={cn(arrow, 'right-0 justify-end bg-gradient-to-l')}
        >
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}

type TabStatus = 'attention' | 'error';

interface TabsTriggerProps extends React.ComponentProps<typeof TabsPrimitive.Trigger> {
  /** Contagem mostrada numa pastilha ao lado do rótulo. */
  count?: number;
  /** Pede atenção ao utilizador: ponto (`attention`) ou triângulo (`error`). */
  status?: TabStatus;
  /** Texto para leitores de ecrã sobre o estado (obrigatório com `status`). */
  statusLabel?: string;
  /** Ícone só quando ajuda a distinguir (nunca decorativo). */
  icon?: React.ReactNode;
}

function TabsTrigger({
  className,
  children,
  count,
  status,
  statusLabel,
  icon,
  ...props
}: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "group/tab relative z-10 inline-flex h-11 flex-none shrink-0 items-center justify-center gap-2 rounded-md border border-transparent px-3.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none group-data-[orientation=vertical]/tabs:h-9 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground sm:px-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Pastilha: o fundo vem do indicador; a caixa fica mais baixa para caber no preenchimento da lista.
        'group-data-[variant=default]/tabs-list:h-9 group-data-[variant=default]/tabs-list:px-3',
        // Linha: sem arredondar, o indicador cola-se ao rebordo da lista.
        'group-data-[variant=line]/tabs-list:rounded-b-none',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {count !== undefined && (
        <span className="rounded-full bg-background/60 px-1.5 py-px font-semibold text-[10px] text-muted-foreground tabular-nums ring-1 ring-foreground/5 group-data-[state=active]/tab:bg-primary/10 group-data-[state=active]/tab:text-primary group-data-[state=active]/tab:ring-primary/20">
          {count}
        </span>
      )}
      {status === 'attention' && (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/50 motion-reduce:hidden" />
          <span
            role="img"
            aria-label={statusLabel ?? m.tabs_attention()}
            className="relative inline-flex size-2 rounded-full bg-destructive"
          />
        </span>
      )}
      {status === 'error' && (
        <AlertTriangle
          role="img"
          aria-label={statusLabel ?? m.tabs_error()}
          className="size-3.5 text-destructive"
        />
      )}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        'flex-1 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
      {...props}
    />
  );
}

export type { TabStatus };
export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants };
