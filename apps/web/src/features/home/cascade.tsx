import { SankeyChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import type { OverviewGap } from '@/client';
import { formatPercent, formatTonnes } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { m } from '@/paraglide/messages';
import { useMotion } from './motion';
import { EstimateTag } from './story-section';

echarts.use([SankeyChart, TooltipComponent, CanvasRenderer]);

interface Palette {
  text: string;
  potential: string;
  collected: string;
  reuse: string;
  recycle: string;
  reject: string;
  missing: string;
}

const LIGHT: Palette = {
  text: '#14211d',
  potential: '#14211d',
  collected: '#2e6b57',
  reuse: '#2e6b57',
  recycle: '#7fb39c',
  reject: '#c4a06a',
  missing: '#8a948f',
};
const DARK: Palette = {
  text: '#f1eee6',
  potential: '#f1eee6',
  collected: '#7fb39c',
  reuse: '#7fb39c',
  recycle: '#2e6b57',
  reject: '#c4a06a',
  missing: '#6f7d77',
};

/** Do potencial ao destino: o que já se recolhe (e para onde vai) e o que falta captar. */
export function Cascade({ gap }: { gap: OverviewGap }) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const { enabled } = useMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const c = resolvedTheme === 'dark' ? DARK : LIGHT;
    const names = {
      potential: m.home_cascade_potential(),
      collected: m.home_cascade_collected(),
      missing: m.home_cascade_missing(),
      reuse: m.home_cascade_reuse(),
      recycle: m.home_cascade_recycle(),
      reject: m.home_cascade_reject(),
      mixed: m.home_cascade_mixed(),
    };
    const d = gap.destinations;
    const chart = echarts.init(el, undefined, { renderer: 'canvas' });
    const render = () => {
      const narrow = el.clientWidth < 560;
      chart.setOption({
        animation: enabled,
        animationDuration: 1100,
        tooltip: {
          trigger: 'item',
          confine: true,
          valueFormatter: (v: number) => formatTonnes(v, 1),
        },
        series: [
          {
            type: 'sankey',
            left: 4,
            right: narrow ? 92 : 190,
            top: 10,
            bottom: 10,
            nodeWidth: narrow ? 12 : 16,
            nodeGap: narrow ? 14 : 18,
            nodeAlign: 'justify',
            layoutIterations: 0,
            emphasis: { focus: 'adjacency' },
            data: [
              { name: names.potential, itemStyle: { color: c.potential } },
              { name: names.collected, itemStyle: { color: c.collected } },
              { name: names.missing, itemStyle: { color: c.missing } },
              { name: names.reuse, itemStyle: { color: c.reuse } },
              { name: names.recycle, itemStyle: { color: c.recycle } },
              { name: names.reject, itemStyle: { color: c.reject } },
              { name: names.mixed, itemStyle: { color: c.missing } },
            ],
            links: [
              { source: names.potential, target: names.collected, value: gap.collected_t },
              { source: names.potential, target: names.missing, value: gap.missing_t },
              { source: names.collected, target: names.reuse, value: d.reuse_t },
              { source: names.collected, target: names.recycle, value: d.recycle_t },
              { source: names.collected, target: names.reject, value: d.reject_t },
              { source: names.missing, target: names.mixed, value: gap.missing_t },
            ],
            lineStyle: { color: 'target', curveness: 0.5, opacity: 0.32 },
            label: {
              fontFamily: 'Inter, sans-serif',
              fontSize: narrow ? 11 : 13,
              color: c.text,
              lineHeight: narrow ? 14 : 17,
              formatter: (p: { name: string; value: number }) =>
                `{n|${p.name}}\n{v|${formatTonnes(p.value, p.value >= 100 ? 0 : 1)}}`,
              rich: {
                n: { fontWeight: 600, fontSize: narrow ? 11 : 13, color: c.text },
                v: { fontSize: narrow ? 11 : 12, color: c.text, opacity: 0.8 },
              },
            },
          },
        ],
      });
    };
    render();
    const observer = new ResizeObserver(() => {
      chart.resize();
      render();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [gap, resolvedTheme, enabled]);

  const d = gap.destinations;
  const rows = [
    { label: m.home_cascade_potential(), value: gap.potential_t, estimate: true },
    { label: m.home_cascade_collected(), value: gap.collected_t, estimate: false },
    { label: m.home_cascade_reuse(), value: d.reuse_t, estimate: false },
    { label: m.home_cascade_recycle(), value: d.recycle_t, estimate: false },
    { label: m.home_cascade_reject(), value: d.reject_t, estimate: false },
    { label: m.home_cascade_missing(), value: gap.missing_t, estimate: true },
  ];

  return (
    <div className="space-y-4 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-5">
      <div
        ref={ref}
        role="img"
        aria-label={m.home_cascade_aria({
          potential: formatTonnes(gap.potential_t, 0),
          collected: formatTonnes(gap.collected_t),
          missing: formatTonnes(gap.missing_t, 0),
          pct: formatPercent(gap.capture_pct),
        })}
        className="h-[25rem] w-full sm:h-[26rem]"
      />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-border border-t px-1 pt-3 text-sm sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="flex min-w-0 items-baseline justify-between gap-2">
            <dt className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-muted-foreground">
              {r.label}
              {r.estimate && <EstimateTag />}
            </dt>
            <dd className="whitespace-nowrap font-semibold tabular-nums">
              {formatTonnes(r.value, r.value >= 100 ? 0 : 1)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
