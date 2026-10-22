import { evolvePath } from '@remotion/paths';
import { useMemo } from 'react';
import { interpolate } from 'remotion';
import geo from '../data/geo.json';
import { clamp } from '../anim';
import { C } from '../theme';

type Parish = (typeof geo.parishes)[number];
export const GEO = geo;

export type MapState = {
  /** 0..1: contornos desenhados */
  outline: number;
  /** 0..1: contentores municipais acesos (onda a partir do centro) */
  containers: number;
  /** 0..1: freguesias com saco à porta (recolha a pedido) pintadas */
  pap: number;
  /** 0..1: freguesias servidas em local existente pintadas */
  existing: number;
  /** 0..1: escolas acesas */
  schools: number;
  /** 0..1: circuitos desenhados a partir do depósito */
  routes: number;
  /** opacidade dos contentores no fim (para dar lugar à rede) */
  containersDim?: number;
  dark?: boolean;
};

function routePath(stops: number[][], depot: number[]) {
  const pts = [depot, ...stops, depot];
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
}

export function GuimaraesMap({ s, width }: { s: MapState; width: number }) {
  const dark = s.dark ?? true;
  const cx = geo.width / 2;
  const cy = geo.height / 2;
  const maxD = Math.hypot(cx, cy);
  const containers = useMemo(
    () => geo.containers.map(([x, y, kind]) => ({ x: x as number, y: y as number, kind: kind as string, d: Math.hypot((x as number) - cx, (y as number) - cy) / maxD })),
    [cx, cy, maxD],
  );
  const routes = useMemo(() => geo.routes.map((r) => routePath(r.stops, geo.depot)), []);
  const height = (width * geo.height) / geo.width;

  const fillFor = (p: Parish, i: number) => {
    const stagger = (i / geo.parishes.length) * 0.5;
    const local = (v: number) => interpolate(v, [stagger, stagger + 0.5], [0, 1], clamp);
    if (p.onDemand && s.pap > 0) return { fill: dark ? C.florestaClara : C.floresta, op: local(s.pap) * 0.85 };
    if (p.existing && s.existing > 0) return { fill: C.areia, op: local(s.existing) * 0.8 };
    return { fill: 'transparent', op: 0 };
  };

  return (
    <svg viewBox={`0 0 ${geo.width} ${geo.height}`} width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      {geo.parishes.map((p, i) => {
        const f = fillFor(p, i);
        return <path key={`f${p.code}`} d={p.d} fill={f.fill} fillOpacity={f.op} />;
      })}
      {geo.parishes.map((p, i) => {
        const stagger = (i / geo.parishes.length) * 0.4;
        const t = interpolate(s.outline, [stagger, stagger + 0.6], [0, 1], clamp);
        const ev = evolvePath(t, p.d);
        return (
          <path
            key={`o${p.code}`}
            d={p.d}
            fill="none"
            stroke={dark ? 'rgba(244,241,234,0.55)' : 'rgba(20,33,29,0.45)'}
            strokeWidth={1.4}
            strokeDasharray={ev.strokeDasharray}
            strokeDashoffset={ev.strokeDashoffset}
            strokeLinejoin="round"
          />
        );
      })}
      {s.containers > 0 &&
        containers.map((c, i) => {
          const t = interpolate(s.containers, [c.d * 0.75, c.d * 0.75 + 0.25], [0, 1], clamp);
          if (t <= 0) return null;
          const organic = c.kind.startsWith('organic') || c.kind === 'green_waste';
          return (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={3.1 * (t < 1 ? 1 + (1 - t) * 1.5 : 1)}
              fill={organic ? (dark ? C.florestaClara : C.floresta) : C.areia}
              opacity={t * (s.containersDim ?? 1) * 0.9}
            />
          );
        })}
      {routes.map((d, i) => {
        const t = interpolate(s.routes, [i * 0.15, i * 0.15 + 0.7], [0, 1], clamp);
        if (t <= 0) return null;
        const ev = evolvePath(t, d);
        return (
          <path
            key={`r${i}`}
            d={d}
            fill="none"
            stroke={dark ? C.linho : C.tinta}
            strokeWidth={3}
            strokeDasharray={ev.strokeDasharray}
            strokeDashoffset={ev.strokeDashoffset}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        );
      })}
      {s.routes > 0 && (
        <g opacity={interpolate(s.routes, [0, 0.1], [0, 1], clamp)}>
          <circle cx={geo.depot[0]} cy={geo.depot[1]} r={12} fill={dark ? C.linho : C.tinta} />
          <circle cx={geo.depot[0]} cy={geo.depot[1]} r={5} fill={dark ? C.noite : C.linho} />
        </g>
      )}
      {s.schools > 0 &&
        geo.schools.map(([x, y], i) => {
          const t = interpolate(s.schools, [(i / geo.schools.length) * 0.6, (i / geo.schools.length) * 0.6 + 0.4], [0, 1], clamp);
          if (t <= 0) return null;
          return <rect key={`s${i}`} x={(x as number) - 7} y={(y as number) - 7} width={14} height={14} rx={2} fill={dark ? C.linho : C.tinta} opacity={t} transform={`rotate(45 ${x} ${y})`} />;
        })}
    </svg>
  );
}
