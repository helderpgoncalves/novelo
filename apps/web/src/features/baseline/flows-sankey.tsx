import { SankeyChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import type { Flows } from '@/client';
import { formatTonnes } from '@/lib/format';
import { MODE_COLORS } from '@/lib/map';
import { modeLabel } from '@/lib/scenario';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { destinationLabel } from '@/lib/vocab';
import { m, m as messages } from '@/paraglide/messages';
import { DESTINATIONS } from './destination';

echarts.use([SankeyChart, TooltipComponent, CanvasRenderer]);

const ENTITY_SHADES = ['#2e6b57', '#5e6b66', '#7fb39c', '#8a9a93'];
const UNION = /^União das freguesias de\s+/i;

export function FlowsSankey({ flows, className }: { flows: Flows; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!ref.current) return;
    const dark = resolvedTheme === 'dark';
    const text = dark ? '#f1eee6' : '#14211d';
    // Contorno da cor do cartão: o texto lê-se por cima das ligações.
    const halo = dark ? '#17231f' : '#faf8f3';
    const nodeName = (n: Flows['nodes'][number]) =>
      n.destination
        ? destinationLabel[n.destination]()
        : n.mode
          ? modeLabel[n.mode]()
          : (n.label ?? messages.sankey_others());
    const name = (id: string) => {
      const node = flows.nodes.find((n) => n.id === id);
      return node ? nodeName(node) : id;
    };
    const narrow = ref.current.clientWidth < 520;
    const entities = flows.nodes.filter((n) => n.column === 0);

    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chart.setOption({
      animationDuration: 600,
      tooltip: {
        trigger: 'item',
        confine: true,
        valueFormatter: (v: number) => formatTonnes(v),
      },
      series: [
        {
          type: 'sankey',
          left: 4,
          right: narrow ? 92 : 150,
          top: 8,
          bottom: 8,
          nodeWidth: 14,
          nodeGap: 16,
          emphasis: { focus: 'adjacency' },
          data: flows.nodes.map((n) => ({
            name: nodeName(n),
            // Modos e destinos são poucos e altos: o nome quebra em linhas em vez de ser cortado.
            ...(n.column > 0 && { label: { overflow: 'break', lineHeight: narrow ? 13 : 15 } }),
            itemStyle: {
              color:
                (n.mode ? MODE_COLORS[n.mode] : undefined) ??
                DESTINATIONS.find((d) => d.key === n.destination)?.hex[resolvedTheme] ??
                ENTITY_SHADES[entities.findIndex((e) => e.id === n.id) % ENTITY_SHADES.length],
            },
          })),
          links: flows.links.map((l) => ({
            source: name(l.source),
            target: name(l.target),
            value: l.tonnes,
          })),
          lineStyle: { color: 'target', curveness: 0.5, opacity: 0.35 },
          label: {
            fontFamily: 'Inter, sans-serif',
            fontSize: narrow ? 11 : 12,
            color: text,
            textBorderColor: halo,
            textBorderWidth: 3,
            // «União das freguesias de X» passa a «UF X» (cortado, só se lia «União das freg…»); o nome inteiro
            // fica no tooltip (passar o rato ou tocar no nó).
            formatter: (p: { name: string }) => p.name.replace(UNION, 'UF '),
            width: narrow ? 92 : 170,
            overflow: 'truncate',
          },
        },
      ],
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [flows, resolvedTheme]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={m.sankey_aria()}
      className={cn('h-80 w-full', className)}
    />
  );
}
