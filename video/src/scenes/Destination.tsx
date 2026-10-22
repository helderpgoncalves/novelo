import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, easeOut, fadeOut, prog, rise } from '../anim';
import { Body, Source, Title } from '../components/Type';
import { useLayout } from '../layout';
import { C, FONT } from '../theme';

const PARTS = [
  { label: 'reutilização', pct: 59.4, color: C.floresta, text: C.linho },
  { label: 'reciclagem', pct: 26.5, color: C.pedra, text: C.linho },
  { label: 'rejeito', pct: 14.1, color: C.linha, text: C.tinta },
];

/** 4. O destino do que se recolhe: o valor está na reutilização. */
export function Destination({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { width, portrait, pad } = useLayout();
  const barW = width - pad * 2;
  const grow = interpolate(f, [16, 46], [0, 1], { ...clamp, easing: easeOut });
  let acc = 0;
  return (
    <AbsoluteFill style={{ background: C.linho, opacity: fadeOut(f, dur, 6) }}>
      <div style={{ position: 'absolute', left: pad, right: pad, top: portrait ? 300 : 200 }}>
        <div style={rise(f, 0)}>
          <Title size={portrait ? 88 : 84}>E do que se recolhe, o valor está na reutilização.</Title>
        </div>
        <div style={{ marginTop: portrait ? 110 : 90, display: 'flex', flexDirection: portrait ? 'column' : 'row', height: portrait ? 760 : 250, width: barW, borderRadius: 16, overflow: 'hidden' }}>
          {PARTS.map((p, i) => {
            const share = p.pct / 100;
            const start = acc;
            acc += share;
            const local = interpolate(grow, [start * 0.6, start * 0.6 + 0.4], [0, 1], clamp);
            const size = `${share * 100 * local}%`;
            return (
              <div
                key={p.label}
                style={{
                  [portrait ? 'height' : 'width']: size,
                  background: p.color,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  padding: portrait ? '0 36px 26px' : i === 2 ? '0 18px 24px' : '0 30px 24px',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  opacity: local > 0 ? 1 : 0,
                  marginLeft: !portrait && i ? 4 : 0,
                  marginTop: portrait && i ? 4 : 0,
                }}
              >
                <span style={{ font: `500 ${i === 0 ? 92 : i === 1 ? 60 : 50}px/1 ${FONT.title}`, color: p.text, opacity: prog(f, 40 + i * 6, 12) }}>{String(p.pct).replace('.', ',')}%</span>
                <span style={{ font: `500 26px/1.3 Inter`, color: p.text, opacity: prog(f, 44 + i * 6, 12) * 0.9 }}>{p.label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ ...rise(f, 64), marginTop: 56, maxWidth: 1300 }}>
          <Body size={portrait ? 36 : 34}>
            A reciclagem custa mais do que a fibra virgem. <b style={{ color: C.tinta, fontWeight: 600 }}>O que interessa é têxtil limpo e seco, que se possa reutilizar.</b>
          </Body>
        </div>
      </div>
      <Source style={{ left: pad, right: pad, bottom: portrait ? 120 : 64, opacity: prog(f, 60, 12) }}>Vitrus Ambiente: destino das 301,3 t recolhidas em 2025 pelas 4 entidades; mentor da Vitrus, 21 out 2026.</Source>
    </AbsoluteFill>
  );
}
