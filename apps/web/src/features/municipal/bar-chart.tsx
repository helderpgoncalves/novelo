import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/lib/theme';

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

export interface BarItem {
  label: string;
  value: number;
  /** Cor da barra; por omissão a cor principal da marca. */
  color?: string;
}

interface HBarChartProps {
  items: BarItem[];
  /** Formata o valor no eixo, na etiqueta e na tabela (ex.: `formatNumber`). */
  format: (value: number) => string;
  /** Descrição curta do gráfico, para leitores de ecrã. */
  ariaLabel: string;
  /** Cabeçalho da coluna de valores na tabela equivalente. */
  valueHeader: string;
  labelHeader: string;
  /** Teto do eixo (ex.: 100 para percentagens). */
  max?: number;
}

const ROW_PX = 34;

/** Barras horizontais com a mesma pele dos outros gráficos, mais a tabela equivalente para leitores de ecrã. */
export function HBarChart({
  items,
  format,
  ariaLabel,
  valueHeader,
  labelHeader,
  max,
}: HBarChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dark = resolvedTheme === 'dark';
    const text = dark ? '#9fb0a9' : '#566360';
    const strong = dark ? '#e6efe9' : '#14211d';
    const brand = dark ? '#7fb39c' : '#2e6b57';
    const chart = echarts.init(el, undefined, { renderer: 'canvas' });
    // Gráfico de barras horizontais: a primeira linha fica no topo (eixo invertido).
    chart.setOption({
      animationDuration: 400,
      grid: { left: 8, right: 56, top: 4, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'none' },
        confine: true,
        valueFormatter: (v: number) => format(v),
      },
      xAxis: {
        type: 'value',
        max,
        show: false,
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: items.map((i) => i.label),
        axisLabel: { color: strong, fontSize: 12, width: 130, overflow: 'truncate' },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: items.map((i) => ({
            value: i.value,
            itemStyle: { color: i.color ?? brand, borderRadius: [0, 3, 3, 0] },
          })),
          barMaxWidth: 18,
          label: {
            show: true,
            position: 'right',
            color: text,
            fontSize: 11,
            formatter: (p: { value: number }) => format(p.value),
          },
        },
      ],
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [items, format, max, resolvedTheme]);

  return (
    <>
      <div
        ref={ref}
        role="img"
        aria-label={ariaLabel}
        style={{ height: Math.max(80, items.length * ROW_PX + 8) }}
        className="w-full"
      />
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">{labelHeader}</th>
              <th scope="col">{valueHeader}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.label}>
                <th scope="row">{i.label}</th>
                <td>{format(i.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
