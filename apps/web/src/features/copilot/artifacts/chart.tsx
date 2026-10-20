import {
  BarChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  SankeyChart,
  ScatterChart,
  TreemapChart,
} from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '../use-reduced-motion';
import { buildOption, type ChartSpec, chartHeight, describeChart } from './chart-options';

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  SankeyChart,
  TreemapChart,
  HeatmapChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

/** Gráfico do copiloto (13 tipos): a especificação vem do servidor, aqui só se desenha. */
export default function ChartView({ spec, className }: { spec: ChartSpec; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: 'canvas' });
    const draw = () =>
      chart.setOption(
        buildOption(spec, {
          dark: resolvedTheme === 'dark',
          narrow: el.clientWidth < 520,
          animate: !reduced,
        }),
        true,
      );
    draw();
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      chart.resize();
      if (Math.abs(el.clientWidth - width) > 80) {
        width = el.clientWidth;
        draw();
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [spec, resolvedTheme, reduced]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={describeChart(spec)}
      data-testid="copilot-chart"
      data-kind={spec.kind}
      className={cn('w-full', className)}
      style={{ height: chartHeight(spec, false) }}
    />
  );
}
