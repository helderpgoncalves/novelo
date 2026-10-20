import {
  BarChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
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
import type { CartesianChart } from '@/client';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { useReducedMotion } from '../use-reduced-motion';
import {
  buildOption,
  type ChartSpec,
  chartHeight,
  describeChart,
  fmt,
  pieSlices,
} from './chart-options';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
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

/** Gráfico do copiloto (14 tipos): a especificação vem do servidor, aqui só se desenha. */
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
    <>
      <div
        ref={ref}
        role="img"
        aria-label={describeChart(spec)}
        data-testid="copilot-chart"
        data-kind={spec.kind}
        className={cn('w-full', className)}
        style={{ height: chartHeight(spec, false) }}
      />
      {spec.kind === 'pie' && 'series' in spec && <PieTable spec={spec} />}
    </>
  );
}

/** Alternativa em tabela para leitores de ecrã (as fatias, valores e percentagens em pt-PT). */
function PieTable({ spec }: { spec: CartesianChart }) {
  const slices = pieSlices(spec);
  return (
    <table className="sr-only" data-testid="copilot-chart-table">
      <caption>{m.chat_chart_table()}</caption>
      <thead>
        <tr>
          <th scope="col">{m.chat_chart_col_slice()}</th>
          <th scope="col">{m.chat_chart_col_value()}</th>
          <th scope="col">{m.chat_chart_col_share()}</th>
        </tr>
      </thead>
      <tbody>
        {slices.map((sl) => (
          <tr key={sl.name}>
            <th scope="row">{sl.name}</th>
            <td>{fmt(sl.value, spec.y_unit)}</td>
            <td>{fmt(sl.share * 100, '%')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
