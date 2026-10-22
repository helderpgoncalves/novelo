import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, easeInOut, fadeOut, prog, rise } from '../anim';
import { GEO, GuimaraesMap } from '../components/GuimaraesMap';
import { Body, Eyebrow, Source, Title } from '../components/Type';
import { num } from '../format';
import { useLayout } from '../layout';
import { C, FONT } from '../theme';

/** 6. Onde se perde: os 48 contornos CAOP e os contentores municipais da Vitrus, a acender. */
export function MapScene({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { width, height, portrait, pad } = useLayout();
  const mapW = portrait ? 960 : 900;
  const outline = interpolate(f, [4, 70], [0, 1], { ...clamp, easing: easeInOut });
  const containers = interpolate(f, [60, 170], [0, 1], { ...clamp, easing: easeInOut });
  const count = Math.round(GEO.containersTotal * containers);
  const stat = (value: string, label: string, at: number) => (
    <div style={rise(f, at)}>
      <div style={{ font: `500 ${portrait ? 76 : 72}px/1 ${FONT.title}`, color: C.areia, fontVariantNumeric: 'tabular-nums lining-nums' }}>{value}</div>
      <div style={{ font: `400 ${portrait ? 26 : 24}px/1.3 Inter`, color: 'rgba(244,241,234,0.72)', marginTop: 8 }}>{label}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.noite, opacity: fadeOut(f, dur, 6) }}>
      <div style={{ position: 'absolute', ...(portrait ? { left: (width - 960) / 2, top: 650 } : { right: 90, top: (height - (mapW * GEO.height) / GEO.width) / 2 }) }}>
        <GuimaraesMap width={mapW} s={{ outline, containers, pap: 0, existing: 0, schools: 0, routes: 0 }} />
      </div>
      <div style={{ position: 'absolute', left: pad, top: portrait ? 170 : 150, width: portrait ? width - pad * 2 : 760 }}>
        <div style={rise(f, 0)}>
          <Eyebrow color={C.areia}>Onde se perde</Eyebrow>
        </div>
        <div style={{ ...rise(f, 8), marginTop: 26 }}>
          <Title size={portrait ? 76 : 76} color={C.linho}>
            O têxtil perde-se onde o camião já passa.
          </Title>
        </div>
        <div style={{ display: 'flex', flexDirection: portrait ? 'row' : 'column', gap: portrait ? 56 : 44, marginTop: portrait ? 50 : 80 }}>
          {stat(num(count), 'contentores municipais', 70)}
          {stat(num(GEO.sitesTotal), 'locais', 96)}
          {stat(String(GEO.parishes.length), 'freguesias', 110)}
        </div>
      </div>
      <div style={{ position: 'absolute', left: pad, ...(portrait ? { top: 560 } : { bottom: 130 }), display: 'flex', gap: 34, opacity: prog(f, 120, 12), font: '500 22px/1 Inter', color: 'rgba(244,241,234,0.72)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <i style={{ width: 14, height: 14, borderRadius: '50%', background: C.areia, display: 'block' }} /> superfície e subterrâneos
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <i style={{ width: 14, height: 14, borderRadius: '50%', background: C.florestaClara, display: 'block' }} /> orgânico e verdes
        </span>
      </div>
      <Source dark style={{ left: pad, right: pad, bottom: portrait ? 120 : 64, opacity: prog(f, 40, 12) }}>
        Vitrus Ambiente, pacote QGIS de contentores municipais (out 2026; 2 722 com coordenadas); DGT, CAOP 2019.
      </Source>
    </AbsoluteFill>
  );
}
