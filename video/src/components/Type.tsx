import type { CSSProperties, ReactNode } from 'react';
import { C, FONT } from '../theme';

export function Eyebrow({ children, color = C.floresta, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        font: `600 22px/1 ${FONT.text}`,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color,
        ...style,
      }}
    >
      <span style={{ width: 36, height: 2, background: color, display: 'block' }} />
      {children}
    </div>
  );
}

export function Title({ children, size = 96, color = C.tinta, style }: { children: ReactNode; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        font: `500 ${size}px/1.04 ${FONT.title}`,
        letterSpacing: '-0.018em',
        fontFeatureSettings: "'lnum'",
        fontOpticalSizing: 'auto',
        color,
        textWrap: 'balance',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Body({ children, size = 30, color = C.pedra, style }: { children: ReactNode; size?: number; color?: string; style?: CSSProperties }) {
  return <div style={{ font: `400 ${size}px/1.45 ${FONT.text}`, color, textWrap: 'pretty', ...style }}>{children}</div>;
}

/** Etiqueta "estimativa", como na app. */
export function Estimate({ dark = false, size = 18, style }: { dark?: boolean; size?: number; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-block',
        font: `600 ${size}px/1 ${FONT.text}`,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        padding: `${size * 0.45}px ${size * 0.7}px`,
        borderRadius: 999,
        color: dark ? C.areia : '#6B5530',
        background: dark ? 'rgba(196,160,106,0.14)' : 'rgba(196,160,106,0.24)',
        border: dark ? '1px solid rgba(196,160,106,0.45)' : '1px solid rgba(196,160,106,0.5)',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      estimativa
    </span>
  );
}

/** Fonte no rodapé de cada cena com números. */
export function Source({ children, dark = false, style }: { children: ReactNode; dark?: boolean; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        font: `400 19px/1.4 ${FONT.text}`,
        color: dark ? 'rgba(244,241,234,0.62)' : C.pedra,
        ...style,
      }}
    >
      <span style={{ fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: 15, marginRight: 12 }}>Fonte</span>
      {children}
    </div>
  );
}
