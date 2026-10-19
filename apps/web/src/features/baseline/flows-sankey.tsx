import { SankeyChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import type { Flows } from '@/client';

echarts.use([SankeyChart, TooltipComponent, CanvasRenderer]);

const COLORS: Record<string, string> = {
  reuse: '#2e6b57',
  recycle: '#7fb39c',
  reject: '#c4a06a',
};

export function FlowsSankey({ flows }: { flows: Flows }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption({
      tooltip: { trigger: 'item', valueFormatter: (v: number) => `${v.toLocaleString('pt-PT')} t` },
      series: [
        {
          type: 'sankey',
          left: 8,
          right: 120,
          nodeGap: 14,
          emphasis: { focus: 'adjacency' },
          data: flows.nodes.map((n) => ({
            name: n.label,
            itemStyle: { color: COLORS[n.id] ?? '#14211d' },
          })),
          links: flows.links.map((l) => ({
            source: flows.nodes.find((n) => n.id === l.source)?.label,
            target: flows.nodes.find((n) => n.id === l.target)?.label,
            value: l.tonnes,
          })),
          lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.45 },
          label: { fontFamily: 'Inter', color: '#14211d' },
        },
      ],
    });
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
    };
  }, [flows]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Fluxo de têxtil por entidade e destino, em toneladas"
      className="h-80 w-full"
    />
  );
}
