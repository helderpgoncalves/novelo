import { SankeyChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useTheme } from 'next-themes';
import { useEffect, useRef } from 'react';
import type { Flows } from '@/client';
import { DESTINATIONS } from './destination';

echarts.use([SankeyChart, TooltipComponent, CanvasRenderer]);

const ENTITY_SHADES = ['#2e6b57', '#5e6b66', '#7fb39c', '#8a9a93'];

export function FlowsSankey({ flows }: { flows: Flows }) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!ref.current) return;
    const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
    const text = mode === 'dark' ? '#f1eee6' : '#14211d';
    const label = (id: string) => flows.nodes.find((n) => n.id === id)?.label ?? id;
    const entities = flows.nodes.filter((n) => n.column === 0);

    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chart.setOption({
      animationDuration: 600,
      tooltip: {
        trigger: 'item',
        confine: true,
        valueFormatter: (v: number) =>
          `${v.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} t`,
      },
      series: [
        {
          type: 'sankey',
          left: 4,
          right: 150,
          top: 8,
          bottom: 8,
          nodeWidth: 14,
          nodeGap: 16,
          emphasis: { focus: 'adjacency' },
          data: flows.nodes.map((n) => ({
            name: n.label,
            itemStyle: {
              color:
                DESTINATIONS.find((d) => d.key === n.id)?.hex[mode] ??
                ENTITY_SHADES[entities.findIndex((e) => e.id === n.id) % ENTITY_SHADES.length],
            },
          })),
          links: flows.links.map((l) => ({
            source: label(l.source),
            target: label(l.target),
            value: l.tonnes,
          })),
          lineStyle: { color: 'target', curveness: 0.5, opacity: 0.35 },
          label: { fontFamily: 'Inter, sans-serif', fontSize: 12, color: text },
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
      aria-label="Fluxo de têxtil por entidade e destino, em toneladas"
      className="h-80 w-full"
    />
  );
}
