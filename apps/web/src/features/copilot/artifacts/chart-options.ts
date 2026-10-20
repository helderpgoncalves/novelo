import type { EChartsCoreOption } from 'echarts/core';
import type {
  CartesianChart,
  ChartArtifact,
  GaugeChart,
  HeatmapChart,
  RangeChart,
  SankeyChart,
  TornadoChart,
  TreemapChart,
  TreemapItem,
  WaterfallChart,
} from '@/client';
import { intlTag } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

export type ChartSpec = ChartArtifact['spec'];

export interface ChartContext {
  dark: boolean;
  narrow: boolean;
  animate: boolean;
}

const LIGHT = ['#2e6b57', '#c4a06a', '#5e6b66', '#7fb39c', '#14211d', '#a63d2f'];
const DARK = ['#7fb39c', '#c4a06a', '#9fb0a9', '#2e6b57', '#f1eee6', '#e0705f'];

const palette = (c: ChartContext) => (c.dark ? DARK : LIGHT);
const textColor = (c: ChartContext) => (c.dark ? '#f1eee6' : '#14211d');
const mutedColor = (c: ChartContext) => (c.dark ? '#9fb0a9' : '#566360');
const lineColor = (c: ChartContext) => (c.dark ? '#26362f' : '#dcd5c8');

export const fmt = (value: number | null | undefined, unit?: string | null): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const text = new Intl.NumberFormat(intlTag(), {
    maximumFractionDigits: 2,
    useGrouping: 'always',
  }).format(value);
  if (!unit) return text;
  return unit === '%' ? `${text}%` : `${text} ${unit}`;
};

const base = (c: ChartContext) => ({
  animation: c.animate,
  animationDuration: 500,
  textStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: textColor(c) },
  color: palette(c),
});

const tooltipBase = (c: ChartContext) => ({
  confine: true,
  backgroundColor: c.dark ? '#14211d' : '#faf8f3',
  borderColor: lineColor(c),
  textStyle: { color: textColor(c), fontSize: 12 },
});

const legend = (c: ChartContext) => ({
  type: 'scroll',
  top: 0,
  textStyle: { color: mutedColor(c), fontSize: 12 },
});

const grid = (c: ChartContext, withLegend: boolean) => ({
  left: 8,
  right: c.narrow ? 12 : 20,
  top: withLegend ? 38 : 16,
  bottom: 8,
  containLabel: true,
});

const axisCommon = (c: ChartContext) => ({
  axisLine: { lineStyle: { color: lineColor(c) } },
  axisTick: { show: false },
  axisLabel: { color: mutedColor(c), fontSize: c.narrow ? 11 : 12 },
  splitLine: { lineStyle: { color: lineColor(c), opacity: 0.6 } },
});

const nameOf = (label: string, unit?: string | null) => (unit ? `${label} (${unit})` : label);

function cartesian(spec: CartesianChart, c: ChartContext): EChartsCoreOption {
  const multi = spec.series.length > 1;
  const stringX = spec.series.some((s) => s.points.some((p) => typeof p.x === 'string'));
  const scatterLike = spec.kind === 'scatter' || spec.kind === 'pareto';
  const categories = [...new Set(spec.series.flatMap((s) => s.points.map((p) => String(p.x))))];
  const horizontal = spec.kind === 'bar' && categories.length > 6 && spec.series.length === 1;
  const colors = palette(c);

  const valueAxis = (label: string, unit: string | null | undefined, name = true) => ({
    type: 'value' as const,
    ...axisCommon(c),
    name: name ? nameOf(label, unit) : undefined,
    nameTextStyle: { color: mutedColor(c), align: 'left' as const },
    axisLabel: {
      ...axisCommon(c).axisLabel,
      formatter: (v: number) => fmt(v),
    },
  });
  const categoryAxis = (label: string) => ({
    type: 'category' as const,
    data: categories,
    ...axisCommon(c),
    splitLine: { show: false },
    name: c.narrow ? undefined : label,
    nameLocation: 'middle' as const,
    nameGap: 28,
    nameTextStyle: { color: mutedColor(c) },
    axisLabel: {
      ...axisCommon(c).axisLabel,
      interval: 0,
      hideOverlap: true,
      width: horizontal ? (c.narrow ? 90 : 160) : 80,
      overflow: 'truncate' as const,
      rotate: !horizontal && categories.length > 5 ? 30 : 0,
    },
  });

  let series: Record<string, unknown>[];
  if (scatterLike) {
    const highlight = new Set(spec.highlight ?? []);
    series = spec.series.flatMap((s, si) => {
      const pts = s.points.filter((p) => p.y !== null);
      const data = pts.map((p) => ({
        value: [Number(p.x), p.y, p.label ?? ''],
        symbolSize: p.size ? Math.max(8, Math.min(34, p.size)) : 12,
        itemStyle: highlight.has(p.label ?? '') ? { color: colors[0] } : undefined,
      }));
      const out: Record<string, unknown>[] = [
        {
          name: s.name,
          type: 'scatter',
          data,
          itemStyle: {
            color:
              spec.kind === 'pareto' && highlight.size ? mutedColor(c) : colors[si % colors.length],
            opacity: spec.kind === 'pareto' && highlight.size ? 0.55 : 0.9,
          },
          emphasis: { focus: 'self' },
        },
      ];
      if (spec.kind === 'pareto' && highlight.size) {
        const front = pts
          .filter((p) => highlight.has(p.label ?? ''))
          .sort((a, b) => Number(a.x) - Number(b.x))
          .map((p) => [Number(p.x), p.y, p.label ?? '']);
        out.push({
          name: m.chat_chart_frontier(),
          type: 'line',
          data: front,
          symbolSize: 14,
          itemStyle: { color: colors[0] },
          lineStyle: { color: colors[0], width: 2 },
          z: 3,
        });
      }
      return out;
    });
  } else {
    const type = spec.kind === 'bar' || spec.kind === 'stacked_bar' ? 'bar' : 'line';
    series = spec.series.map((s, si) => {
      const byX = new Map(s.points.map((p) => [String(p.x), p.y]));
      const data =
        stringX || type === 'bar'
          ? categories.map((cat) => byX.get(cat) ?? null)
          : s.points.map((p) => [Number(p.x), p.y]);
      return {
        name: s.name,
        type,
        data,
        stack: spec.kind === 'stacked_bar' ? 'total' : undefined,
        smooth: false,
        showSymbol: type === 'line' ? s.points.length < 24 : undefined,
        areaStyle: spec.kind === 'area' ? { opacity: 0.25 } : undefined,
        barMaxWidth: 38,
        itemStyle: {
          color: colors[si % colors.length],
          borderRadius: type === 'bar' && spec.kind === 'bar' ? [3, 3, 0, 0] : 0,
        },
        emphasis: { focus: 'series' },
      };
    });
  }

  const xIsCategory =
    !scatterLike && (stringX || spec.kind === 'bar' || spec.kind === 'stacked_bar');
  const xAxis = xIsCategory
    ? categoryAxis(spec.x_label)
    : valueAxis(spec.x_label, spec.x_unit, !c.narrow);
  const yAxis = valueAxis(spec.y_label, spec.y_unit, !horizontal);
  const showLegend = multi || (spec.kind === 'pareto' && !!spec.highlight?.length);

  return {
    ...base(c),
    legend: showLegend ? legend(c) : undefined,
    // Espaço no topo para o nome do eixo (e para a legenda).
    grid: { ...grid(c, showLegend), top: horizontal ? 16 : showLegend ? 62 : 36 },
    tooltip: {
      ...tooltipBase(c),
      trigger: scatterLike ? 'item' : 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v: unknown) => fmt(typeof v === 'number' ? v : null, spec.y_unit),
      formatter: scatterLike
        ? (p: { value: [number, number, string]; seriesName: string }) =>
            `${p.value[2] ? `<b>${p.value[2]}</b><br/>` : ''}${spec.x_label}: ${fmt(p.value[0], spec.x_unit)}<br/>${spec.y_label}: ${fmt(p.value[1], spec.y_unit)}`
        : undefined,
    },
    xAxis: horizontal ? yAxis : xAxis,
    yAxis: horizontal ? { ...categoryAxis(spec.x_label), inverse: true } : yAxis,
    series,
  };
}

function waterfall(spec: WaterfallChart, c: ChartContext): EChartsCoreOption {
  const colors = palette(c);
  const labels: string[] = [];
  const invisible: number[] = [];
  const up: (number | null)[] = [];
  const down: (number | null)[] = [];
  const total: (number | null)[] = [];
  let run = 0;
  for (const step of spec.steps) {
    labels.push(step.label);
    const kind = step.kind ?? 'delta';
    if (kind === 'delta') {
      const v = step.value;
      invisible.push(v >= 0 ? run : run + v);
      up.push(v >= 0 ? v : null);
      down.push(v < 0 ? -v : null);
      total.push(null);
      run += v;
    } else {
      invisible.push(0);
      up.push(null);
      down.push(null);
      total.push(step.value);
      run = step.value;
    }
  }
  const stack = (name: string, data: (number | null)[], color: string, hidden = false) => ({
    name,
    type: 'bar',
    stack: 'wf',
    data,
    barMaxWidth: 44,
    silent: hidden,
    itemStyle: hidden ? { color: 'transparent' } : { color },
  });
  return {
    ...base(c),
    grid: grid(c, false),
    tooltip: {
      ...tooltipBase(c),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (items: { dataIndex: number }[]) => {
        const i = items[0]?.dataIndex ?? 0;
        const step = spec.steps[i];
        return step ? `<b>${step.label}</b><br/>${fmt(step.value, spec.unit)}` : '';
      },
    },
    xAxis: {
      type: 'category',
      data: labels,
      ...axisCommon(c),
      splitLine: { show: false },
      axisLabel: {
        ...axisCommon(c).axisLabel,
        interval: 0,
        hideOverlap: true,
        width: 80,
        overflow: 'truncate',
      },
    },
    yAxis: {
      type: 'value',
      ...axisCommon(c),
      axisLabel: { ...axisCommon(c).axisLabel, formatter: (v: number) => fmt(v) },
    },
    series: [
      stack('base', invisible, 'transparent', true),
      stack(m.chat_chart_total(), total, colors[2] ?? '#5e6b66'),
      stack(m.chat_chart_increase(), up, colors[0] ?? '#2e6b57'),
      stack(m.chat_chart_decrease(), down, c.dark ? '#e0705f' : '#a63d2f'),
    ],
  };
}

function sankey(spec: SankeyChart, c: ChartContext): EChartsCoreOption {
  const label = new Map(spec.nodes.map((n) => [n.id, n.label]));
  const name = (id: string) => label.get(id) ?? id;
  return {
    ...base(c),
    tooltip: {
      ...tooltipBase(c),
      trigger: 'item',
      valueFormatter: (v: unknown) => fmt(typeof v === 'number' ? v : null, spec.unit),
    },
    series: [
      {
        type: 'sankey',
        left: 4,
        right: c.narrow ? 84 : 150,
        top: 8,
        bottom: 8,
        nodeWidth: 14,
        nodeGap: 14,
        emphasis: { focus: 'adjacency' },
        data: spec.nodes.map((n, i) => ({
          name: n.label,
          itemStyle: { color: palette(c)[i % palette(c).length] },
        })),
        links: spec.links.map((l) => ({
          source: name(l.source),
          target: name(l.target),
          value: l.value,
        })),
        lineStyle: { color: 'target', curveness: 0.5, opacity: 0.35 },
        label: { color: textColor(c), fontSize: c.narrow ? 11 : 12 },
      },
    ],
  };
}

function toTree(items: TreemapItem[]) {
  const children = new Map<string | null, TreemapItem[]>();
  for (const it of items) {
    const key = it.parent ?? null;
    children.set(key, [...(children.get(key) ?? []), it]);
  }
  const build = (parent: string | null): Record<string, unknown>[] =>
    (children.get(parent) ?? []).map((it) => {
      const kids = build(it.name);
      return kids.length ? { name: it.name, children: kids } : { name: it.name, value: it.value };
    });
  return build(null);
}

function treemap(spec: TreemapChart, c: ChartContext): EChartsCoreOption {
  return {
    ...base(c),
    tooltip: {
      ...tooltipBase(c),
      valueFormatter: (v: unknown) => fmt(typeof v === 'number' ? v : null, spec.unit),
    },
    series: [
      {
        type: 'treemap',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        label: { color: '#faf8f3', fontSize: 12 },
        upperLabel: { show: false },
        itemStyle: { borderColor: c.dark ? '#0f1815' : '#faf8f3', borderWidth: 2, gapWidth: 2 },
        data: toTree(spec.items),
      },
    ],
  };
}

function heatmap(spec: HeatmapChart, c: ChartContext): EChartsCoreOption {
  const xi = new Map(spec.x_categories.map((x, i) => [x, i]));
  const yi = new Map(spec.y_categories.map((y, i) => [y, i]));
  const data = spec.cells
    .map((cell) => [xi.get(cell.x), yi.get(cell.y), cell.value])
    .filter((d) => d[0] !== undefined && d[1] !== undefined);
  const values = spec.cells.map((x) => x.value);
  return {
    ...base(c),
    grid: { left: 8, right: 12, top: 12, bottom: 56, containLabel: true },
    tooltip: {
      ...tooltipBase(c),
      formatter: (p: { value: [number, number, number] }) =>
        `${spec.y_categories[p.value[1]]} · ${spec.x_categories[p.value[0]]}<br/><b>${fmt(p.value[2], spec.unit)}</b>`,
    },
    xAxis: {
      type: 'category',
      data: spec.x_categories,
      ...axisCommon(c),
      splitArea: { show: true },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: spec.y_categories,
      ...axisCommon(c),
      splitLine: { show: false },
    },
    visualMap: {
      min: Math.min(...values, 0),
      max: Math.max(...values, 1),
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 12,
      itemHeight: 120,
      textStyle: { color: mutedColor(c) },
      inRange: { color: c.dark ? ['#1f322b', '#7fb39c'] : ['#e3eae2', '#2e6b57'] },
    },
    series: [
      {
        type: 'heatmap',
        data,
        label: {
          show: data.length <= 40,
          color: textColor(c),
          fontSize: 11,
          formatter: (p: { value: number[] }) => fmt(p.value[2] ?? null),
        },
        itemStyle: { borderColor: c.dark ? '#0f1815' : '#faf8f3', borderWidth: 1 },
      },
    ],
  };
}

function tornado(spec: TornadoChart, c: ChartContext): EChartsCoreOption {
  const bars = [...spec.bars].sort((a, b) => b.high - b.low - (a.high - a.low));
  const centre = bars[0]?.base ?? 0;
  const colors = palette(c);
  return {
    ...base(c),
    legend: legend(c),
    grid: grid(c, true),
    tooltip: {
      ...tooltipBase(c),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (items: { dataIndex: number }[]) => {
        const b = bars[items[0]?.dataIndex ?? 0];
        return b
          ? `<b>${b.label}</b><br/>${m.chat_chart_low()}: ${fmt(b.low, spec.unit)}<br/>${m.chat_chart_base()}: ${fmt(b.base, spec.unit)}<br/>${m.chat_chart_high()}: ${fmt(b.high, spec.unit)}`
          : '';
      },
    },
    xAxis: {
      type: 'value',
      ...axisCommon(c),
      axisLabel: { ...axisCommon(c).axisLabel, formatter: (v: number) => fmt(v + centre) },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: bars.map((b) => b.label),
      ...axisCommon(c),
      splitLine: { show: false },
      axisLabel: { ...axisCommon(c).axisLabel, width: c.narrow ? 90 : 150, overflow: 'truncate' },
    },
    series: [
      {
        name: m.chat_chart_low(),
        type: 'bar',
        stack: 't',
        barMaxWidth: 22,
        data: bars.map((b) => b.low - centre),
        itemStyle: { color: colors[1] },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: mutedColor(c), type: 'dashed' },
          data: [{ xAxis: 0 }],
        },
      },
      {
        name: m.chat_chart_high(),
        type: 'bar',
        stack: 't',
        barMaxWidth: 22,
        data: bars.map((b) => b.high - centre),
        itemStyle: { color: colors[0] },
      },
    ],
  };
}

function range(spec: RangeChart, c: ChartContext): EChartsCoreOption {
  const items = spec.items;
  const colors = palette(c);
  return {
    ...base(c),
    legend: legend(c),
    grid: grid(c, true),
    tooltip: {
      ...tooltipBase(c),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (p: { dataIndex: number }[]) => {
        const it = items[p[0]?.dataIndex ?? 0];
        return it
          ? `<b>${it.label}</b><br/>P10: ${fmt(it.p10, spec.unit)}<br/>P50: ${fmt(it.p50, spec.unit)}<br/>P90: ${fmt(it.p90, spec.unit)}`
          : '';
      },
    },
    xAxis: {
      type: 'value',
      ...axisCommon(c),
      axisLabel: { ...axisCommon(c).axisLabel, formatter: (v: number) => fmt(v) },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: items.map((i) => i.label),
      ...axisCommon(c),
      splitLine: { show: false },
      axisLabel: { ...axisCommon(c).axisLabel, width: c.narrow ? 90 : 150, overflow: 'truncate' },
    },
    series: [
      {
        name: 'base',
        type: 'bar',
        stack: 'r',
        silent: true,
        data: items.map((i) => i.p10),
        itemStyle: { color: 'transparent' },
        tooltip: { show: false },
      },
      {
        name: m.chat_chart_range(),
        type: 'bar',
        stack: 'r',
        barMaxWidth: 18,
        data: items.map((i) => i.p90 - i.p10),
        itemStyle: { color: colors[3], opacity: 0.55, borderRadius: 4 },
      },
      {
        name: 'P50',
        type: 'scatter',
        symbolSize: 12,
        data: items.map((i, idx) => [i.p50, idx]),
        itemStyle: { color: colors[0] },
        z: 4,
      },
    ],
  };
}

function gauge(spec: GaugeChart, c: ChartContext): EChartsCoreOption {
  const span = spec.max - spec.min || 1;
  const frac = (v: number) => Math.min(1, Math.max(0, (v - spec.min) / span));
  const colors = palette(c);
  const bands: [number, string][] =
    spec.target !== null && spec.target !== undefined
      ? [
          [frac(spec.target), colors[0] ?? '#2e6b57'],
          [1, lineColor(c)],
        ]
      : [[1, colors[0] ?? '#2e6b57']];
  return {
    ...base(c),
    series: [
      {
        type: 'gauge',
        min: spec.min,
        max: spec.max,
        radius: '92%',
        center: ['50%', '62%'],
        startAngle: 200,
        endAngle: -20,
        progress: {
          show: spec.target === null || spec.target === undefined,
          width: 14,
          itemStyle: { color: colors[0] },
        },
        axisLine: { lineStyle: { width: 14, color: bands } },
        pointer: { width: 5, length: '60%', itemStyle: { color: textColor(c) } },
        axisTick: { show: false },
        splitLine: { length: 8, lineStyle: { color: mutedColor(c) } },
        axisLabel: {
          color: mutedColor(c),
          fontSize: 11,
          distance: 18,
          formatter: (v: number) => fmt(v),
        },
        detail: {
          valueAnimation: c.animate,
          formatter: () => fmt(spec.value, spec.unit),
          color: textColor(c),
          fontSize: 22,
          fontFamily: 'Newsreader, Georgia, serif',
          offsetCenter: [0, '38%'],
        },
        data: [{ value: spec.value }],
      },
    ],
  };
}

export function buildOption(spec: ChartSpec, c: ChartContext): EChartsCoreOption {
  switch (spec.kind) {
    case 'waterfall':
      return waterfall(spec, c);
    case 'sankey':
      return sankey(spec, c);
    case 'treemap':
      return treemap(spec, c);
    case 'heatmap':
      return heatmap(spec, c);
    case 'tornado':
      return tornado(spec, c);
    case 'range':
      return range(spec, c);
    case 'gauge':
      return gauge(spec, c);
    default:
      return cartesian(spec, c);
  }
}

/** Altura sensata por tipo e quantidade de dados. */
export function chartHeight(spec: ChartSpec, narrow: boolean): number {
  switch (spec.kind) {
    case 'gauge':
      return 230;
    case 'sankey':
      return 320;
    case 'heatmap':
      return Math.min(440, 120 + spec.y_categories.length * 34);
    case 'tornado':
      return Math.min(460, 110 + spec.bars.length * 36);
    case 'range':
      return Math.min(460, 110 + spec.items.length * 36);
    case 'treemap':
      return 300;
    case 'bar': {
      const n = spec.series[0]?.points.length ?? 0;
      return spec.series.length === 1 && n > 6 ? Math.min(520, 80 + n * 30) : narrow ? 260 : 300;
    }
    default:
      return narrow ? 260 : 300;
  }
}

/** Texto para leitores de ecrã: título, subtítulo e os primeiros valores. */
export function describeChart(spec: ChartSpec): string {
  const head = [spec.title, spec.subtitle].filter(Boolean).join('. ');
  let body = '';
  switch (spec.kind) {
    case 'waterfall':
      body = spec.steps
        .slice(0, 12)
        .map((s) => `${s.label}: ${fmt(s.value, spec.unit)}`)
        .join('; ');
      break;
    case 'gauge':
      body = fmt(spec.value, spec.unit);
      break;
    case 'sankey':
      body = spec.links
        .slice(0, 12)
        .map((l) => `${l.source} → ${l.target}: ${fmt(l.value, spec.unit)}`)
        .join('; ');
      break;
    case 'treemap':
      body = spec.items
        .slice(0, 12)
        .map((i) => `${i.name}: ${fmt(i.value, spec.unit)}`)
        .join('; ');
      break;
    case 'heatmap':
      body = spec.cells
        .slice(0, 12)
        .map((x) => `${x.y}/${x.x}: ${fmt(x.value, spec.unit)}`)
        .join('; ');
      break;
    case 'tornado':
      body = spec.bars
        .slice(0, 12)
        .map((b) => `${b.label}: ${fmt(b.low, spec.unit)} – ${fmt(b.high, spec.unit)}`)
        .join('; ');
      break;
    case 'range':
      body = spec.items
        .slice(0, 12)
        .map((b) => `${b.label}: ${fmt(b.p10, spec.unit)} – ${fmt(b.p90, spec.unit)}`)
        .join('; ');
      break;
    default:
      body = spec.series
        .slice(0, 3)
        .map(
          (s) =>
            `${s.name}: ${s.points
              .slice(0, 10)
              .map((p) => `${p.x} ${fmt(p.y, s.unit ?? spec.y_unit)}`)
              .join(', ')}`,
        )
        .join('. ');
  }
  return `${head}. ${body}`;
}
