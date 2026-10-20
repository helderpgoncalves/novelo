import { BarChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import { formatNumber, formatPercent } from '@/lib/format';
import { weekdayLong, weekdayShort } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { shiftLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import { DAYS, SHIFTS, type SlotLoad } from './schedule';

echarts.use([
  BarChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const SHIFT_COLORS = {
  light: { morning: '#2e6b57', afternoon: '#c4a06a', night: '#5e6b66' },
  dark: { morning: '#7fb39c', afternoon: '#c4a06a', night: '#9fb0a9' },
};

/** Viaturas em uso por dia e turno, contra o total da frota. O equivalente em tabela fica para leitores de ecrã. */
export function LoadChart({ load, fleetSize }: { load: SlotLoad[]; fleetSize: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const find = (day: number, shift: string) => load.find((s) => s.day === day && s.shift === shift);

  useEffect(() => {
    if (!ref.current) return;
    const find = (day: number, shift: string) =>
      load.find((s) => s.day === day && s.shift === shift);
    const dark = resolvedTheme === 'dark';
    const text = dark ? '#9fb0a9' : '#566360';
    const colors = SHIFT_COLORS[dark ? 'dark' : 'light'];
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chart.setOption({
      animationDuration: 400,
      grid: { left: 4, right: 12, top: 36, bottom: 4, containLabel: true },
      legend: {
        top: 0,
        left: 0,
        textStyle: { color: text, fontSize: 12 },
        itemWidth: 12,
        itemHeight: 12,
      },
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'shadow' },
        formatter: (params: { dataIndex: number }[]) => {
          const day = DAYS[params[0]?.dataIndex ?? 0] ?? 1;
          const rows = SHIFTS.map((s) => {
            const l = find(day, s);
            return `<div>${shiftLabel[s]()}: <b>${formatNumber(l?.vehicles ?? 0)}</b> ${m.fl_chart_unit()} (${formatPercent((l?.rate ?? 0) * 100, 0)}) · ${m.fl_chart_circuits({ count: formatNumber(l?.circuits ?? 0) })}</div>`;
          });
          return `<div style="font-weight:600;text-transform:capitalize">${weekdayLong(day)}</div>${rows.join('')}`;
        },
      },
      xAxis: {
        type: 'category',
        data: DAYS.map((d) => weekdayShort(d)),
        axisLabel: { color: text, fontSize: 12 },
        axisLine: { lineStyle: { color: dark ? '#26362f' : '#dcd5c8' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        max: Math.max(fleetSize, ...load.map((l) => l.vehicles)),
        axisLabel: { color: text, fontSize: 11 },
        splitLine: { lineStyle: { color: dark ? '#26362f' : '#e6e0d3' } },
      },
      series: SHIFTS.map((s, i) => ({
        name: shiftLabel[s](),
        type: 'bar',
        barMaxWidth: 26,
        itemStyle: { color: colors[s], borderRadius: [3, 3, 0, 0] },
        label: {
          show: true,
          position: 'top',
          color: text,
          fontSize: 10,
          formatter: (p: { value: number }) => (p.value ? String(p.value) : ''),
        },
        data: DAYS.map((d) => find(d, s)?.vehicles ?? 0),
        ...(i === 0 && fleetSize > 0
          ? {
              markLine: {
                symbol: 'none',
                silent: true,
                lineStyle: { color: dark ? '#e0906f' : '#a4553a', type: 'dashed', width: 1.5 },
                label: {
                  position: 'insideEndTop',
                  color: dark ? '#e0906f' : '#a4553a',
                  fontSize: 11,
                  formatter: m.fl_chart_fleet_line({ count: formatNumber(fleetSize) }),
                },
                data: [{ yAxis: fleetSize }],
              },
            }
          : {}),
      })),
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [load, fleetSize, resolvedTheme]);

  return (
    <>
      <div ref={ref} role="img" aria-label={m.fl_chart_label()} className="h-64 w-full sm:h-72" />
      <table className="sr-only">
        <caption>{m.fl_chart_label()}</caption>
        <thead>
          <tr>
            <th scope="col">{m.fl_csv_day()}</th>
            {SHIFTS.map((s) => (
              <th key={s} scope="col">
                {shiftLabel[s]()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((d) => (
            <tr key={d}>
              <th scope="row">{weekdayLong(d)}</th>
              {SHIFTS.map((s) => (
                <td key={s}>
                  {formatNumber(find(d, s)?.vehicles ?? 0)} (
                  {formatPercent((find(d, s)?.rate ?? 0) * 100, 0)})
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
