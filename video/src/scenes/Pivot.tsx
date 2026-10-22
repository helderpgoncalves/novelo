import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, easeInOut, fadeOut, pop, prog, rise } from '../anim';
import { Body, Eyebrow, Title } from '../components/Type';
import { useLayout } from '../layout';
import { C, FONT } from '../theme';

const STRIKE = '#A2452F';

function Bin({ size, strike }: { size: number; strike: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 120 150">
      <rect x="14" y="30" width="92" height="112" rx="8" fill="none" stroke={C.tinta} strokeWidth="5" />
      <rect x="8" y="18" width="104" height="14" rx="5" fill={C.tinta} />
      <rect x="40" y="52" width="40" height="7" rx="3.5" fill={C.tinta} />
      <path d="M30 88 h60 M30 106 h60 M30 124 h60" stroke={C.linha} strokeWidth="5" strokeLinecap="round" />
      <line x1="0" y1="150" x2={120 * strike} y2={150 - 150 * strike} stroke={STRIKE} strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

function Truck({ size, strike }: { size: number; strike: number }) {
  return (
    <svg width={size * 1.4} height={size} viewBox="0 0 168 120">
      <rect x="6" y="20" width="104" height="66" rx="8" fill="none" stroke={C.tinta} strokeWidth="5" />
      <path d="M22 40 l30 26 l30 -26" fill="none" stroke={C.linha} strokeWidth="5" strokeLinejoin="round" />
      <path d="M110 40 h28 l22 24 v22 h-50 z" fill="none" stroke={C.tinta} strokeWidth="5" strokeLinejoin="round" />
      <circle cx="38" cy="96" r="13" fill={C.linho} stroke={C.tinta} strokeWidth="5" />
      <circle cx="132" cy="96" r="13" fill={C.linho} stroke={C.tinta} strokeWidth="5" />
      <line x1="10" y1="118" x2={10 + 150 * strike} y2={118 - 116 * strike} stroke={STRIKE} strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

/** 7. O que a Vitrus nos disse (21 e 22 de outubro) e o que fizemos. */
export function Pivot({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { width, portrait, pad } = useLayout();
  const b2 = 92;
  const b3 = 184;
  const ab = interpolate(f, [b2 - 10, b2 + 4], [0, 1], { ...clamp, easing: easeInOut });
  const bc = interpolate(f, [b3 - 10, b3 + 4], [0, 1], { ...clamp, easing: easeInOut });
  const icon = portrait ? 250 : 290;
  const beat = (opacity: number, at: number, eyebrow: string, title: string, body: string, art: React.ReactNode) => (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: portrait ? 80 : 130, padding: `0 ${pad}px`, opacity }}>
      <div style={{ flex: '0 0 auto', opacity: prog(f, at + 4, 14), transform: `scale(${0.9 + 0.1 * pop(f, at + 4)})` }}>{art}</div>
      <div style={{ maxWidth: portrait ? width - pad * 2 : 980 }}>
        <div style={rise(f, at)}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <div style={{ ...rise(f, at + 8), marginTop: 26 }}>
          <Title size={80}>{title}</Title>
        </div>
        <div style={{ ...rise(f, at + 36), marginTop: 30 }}>
          <Body size={portrait ? 36 : 34}>{body}</Body>
        </div>
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.linho, opacity: fadeOut(f, dur, 6) }}>
      {beat(1 - ab, 0, 'Vitrus Ambiente · 21 out 2026', 'Contentores de têxtil, não.', 'O têxtil de contentor chega contaminado e perde a reutilização.', <Bin size={icon} strike={interpolate(f, [44, 64], [0, 1], { ...clamp, easing: easeInOut })} />)}
      {beat(ab * (1 - bc), b2, 'Vitrus Ambiente · 22 out 2026', 'Nem no camião do lixo.', 'Na caixa compactadora, o saco estraga-se. A Vitrus pede um meio novo de recolha.', <Truck size={icon * 0.75} strike={interpolate(f, [b2 + 40, b2 + 60], [0, 1], { ...clamp, easing: easeInOut })} />)}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: `0 ${pad}px`, opacity: bc }}>
        <div style={{ font: `500 ${portrait ? 230 : 260}px/0.9 ${FONT.title}`, color: C.floresta, letterSpacing: '-0.03em', transform: `scale(${0.92 + 0.08 * pop(f, b3)})` }}>24 h</div>
        <div style={{ marginTop: 34, opacity: prog(f, b3 + 8, 14) }}>
          <Title size={72} style={{ maxWidth: 1450 }}>
            Ouvimos e refizemos o modelo: uma viatura só para o têxtil, sem um único contentor novo.
          </Title>
        </div>
      </div>
    </AbsoluteFill>
  );
}
