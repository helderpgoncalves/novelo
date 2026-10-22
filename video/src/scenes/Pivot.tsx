import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, easeInOut, fadeOut, pop, prog, rise } from '../anim';
import { Body, Eyebrow, Title } from '../components/Type';
import { useLayout } from '../layout';
import { C, FONT } from '../theme';

/** 7. O que a Vitrus nos disse a 21 de outubro, e o que fizemos. */
export function Pivot({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { width, portrait, pad } = useLayout();
  const cut = 104;
  const swap = interpolate(f, [cut - 10, cut + 4], [0, 1], { ...clamp, easing: easeInOut });
  const strike = interpolate(f, [46, 66], [0, 1], { ...clamp, easing: easeInOut });
  const binW = portrait ? 260 : 300;
  return (
    <AbsoluteFill style={{ background: C.linho, opacity: fadeOut(f, dur, 6) }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: portrait ? 90 : 140, padding: `0 ${pad}px`, opacity: 1 - swap }}>
        <svg width={binW} height={binW * 1.25} viewBox="0 0 120 150" style={{ flex: '0 0 auto', opacity: prog(f, 4, 14), transform: `scale(${0.9 + 0.1 * pop(f, 4)})` }}>
          <rect x="14" y="30" width="92" height="112" rx="8" fill="none" stroke={C.tinta} strokeWidth="5" />
          <rect x="8" y="18" width="104" height="14" rx="5" fill={C.tinta} />
          <rect x="40" y="52" width="40" height="7" rx="3.5" fill={C.tinta} />
          <path d="M30 88 h60 M30 106 h60 M30 124 h60" stroke={C.linha} strokeWidth="5" strokeLinecap="round" />
          <line x1="0" y1="150" x2={120 * strike} y2={150 - 150 * strike} stroke="#A2452F" strokeWidth="8" strokeLinecap="round" />
        </svg>
        <div style={{ maxWidth: portrait ? width - pad * 2 : 980 }}>
          <div style={rise(f, 0)}>
            <Eyebrow>Vitrus Ambiente · 21 out 2026</Eyebrow>
          </div>
          <div style={{ ...rise(f, 8), marginTop: 26 }}>
            <Title size={portrait ? 80 : 80}>A Vitrus não quer contentores de têxtil.</Title>
          </div>
          <div style={{ ...rise(f, 40), marginTop: 30 }}>
            <Body size={portrait ? 36 : 34}>O têxtil de contentor chega contaminado e perde a reutilização.</Body>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: `0 ${pad}px`, opacity: swap }}>
        <div style={{ font: `500 ${portrait ? 230 : 260}px/0.9 ${FONT.title}`, color: C.floresta, letterSpacing: '-0.03em', transform: `scale(${0.92 + 0.08 * pop(f, cut)})` }}>24 h</div>
        <div style={{ marginTop: 34, opacity: prog(f, cut + 8, 14) }}>
          <Title size={portrait ? 72 : 72} style={{ maxWidth: 1400 }}>
            Ouvimos e refizemos o modelo: uma rede sem um único contentor novo.
          </Title>
        </div>
      </div>
    </AbsoluteFill>
  );
}
