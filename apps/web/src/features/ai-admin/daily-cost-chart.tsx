import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import type { UsageDay } from '@/client';
import { formatDate } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { m } from '@/paraglide/messages';
import { formatUsd } from './ai';

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

/** Custo por dia em barras, com equivalente em tabela para leitores de ecrã. */
export function DailyCostChart({ days }: { days: UsageDay[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!ref.current) return;
    const dark = resolvedTheme === 'dark';
    const text = dark ? '#9fb0a9' : '#566360';
    const bar = dark ? '#7fb39c' : '#2e6b57';
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chart.setOption({
      animationDuration: 400,
      grid: { left: 8, right: 8, top: 12, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        confine: true,
        valueFormatter: (v: number) => formatUsd(v),
      },
      xAxis: {
        type: 'category',
        data: days.map((d) => formatDate(d.day, 'short')),
        axisLabel: { color: text, fontSize: 11, hideOverlap: true },
        axisLine: { lineStyle: { color: dark ? '#26362f' : '#dcd5c8' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: text, fontSize: 11, formatter: (v: number) => formatUsd(v, 2) },
        splitLine: { lineStyle: { color: dark ? '#26362f' : '#e6e0d3' } },
      },
      series: [
        {
          type: 'bar',
          data: days.map((d) => d.cost_usd),
          itemStyle: { color: bar, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 28,
        },
      ],
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [days, resolvedTheme]);

  return (
    <>
      <div
        ref={ref}
        role="img"
        aria-label={m.aiadm_chart_label()}
        className="h-64 w-full sm:h-72"
      />
      <div className="sr-only">
        <table>
          <caption>{m.aiadm_chart_label()}</caption>
          <thead>
            <tr>
              <th scope="col">{m.aiadm_col_day()}</th>
              <th scope="col">{m.aiadm_col_cost()}</th>
              <th scope="col">{m.aiadm_col_calls()}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <th scope="row">{formatDate(d.day, 'short')}</th>
                <td>{formatUsd(d.cost_usd)}</td>
                <td>{d.calls}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
