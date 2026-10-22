import type { CSSProperties, ReactNode } from 'react';
import { Img, staticFile } from 'remotion';
import shots from '../data/shots.json';
import { C, FONT } from '../theme';

type Shot = { base: string; content: string; viewport: [number, number]; rect: [number, number, number, number]; contentHeight: number; anchors: Record<string, number> };
export const SHOT_INFO = shots as unknown as Record<string, Shot>;

/**
 * Um ecrã real da app: a captura do ecrã (barra lateral, topo) com o #content inteiro por cima, a deslizar `scroll`
 * px CSS, como um scroll verdadeiro. A câmara aproxima-se do ponto (cx, cy) do ecrã, em px CSS, com zoom `z`.
 */
export function AppScreen({ shot, width, scroll = 0, cx, cy, z = 1 }: { shot: string; width: number; scroll?: number; cx?: number; cy?: number; z?: number }) {
  const s = SHOT_INFO[shot];
  if (!s) return <div style={{ width, height: width * 0.6, background: 'magenta' }}>{shot}</div>;
  const [vw, vh] = s.viewport;
  const k = width / vw;
  const height = vh * k;
  const [rx, ry, rw, rh] = s.rect;
  const maxScroll = Math.max(0, s.contentHeight - rh);
  const sc = Math.min(maxScroll, Math.max(0, scroll));
  const fx = (cx ?? vw / 2) * k;
  const fy = (cy ?? vh / 2) * k;
  // mantém o ponto focado no centro da moldura, sem mostrar fora do ecrã
  let tx = width / 2 - fx * z;
  let ty = height / 2 - fy * z;
  tx = Math.min(0, Math.max(width - width * z, tx));
  ty = Math.min(0, Math.max(height - height * z, ty));
  return (
    <div style={{ width, height, overflow: 'hidden', position: 'relative', background: C.linho }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width, height, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${z})` }}>
        <Img src={staticFile(`shots/app/${s.base}`)} style={{ position: 'absolute', left: 0, top: 0, width, height }} />
        <div style={{ position: 'absolute', left: rx * k, top: ry * k, width: rw * k, height: rh * k, overflow: 'hidden', background: C.linho }}>
          <Img src={staticFile(`shots/app/${s.content}`)} style={{ position: 'absolute', left: 0, top: -sc * k, width: rw * k, height: s.contentHeight * k }} />
        </div>
      </div>
    </div>
  );
}

/** Moldura de navegador à volta de um ecrã. */
export function BrowserChrome({ width, url, children, style }: { width: number; url: string; children: ReactNode; style?: CSSProperties }) {
  const bar = Math.round(width * 0.034);
  return (
    <div style={{ width, borderRadius: 18, overflow: 'hidden', background: C.linho, border: `1px solid ${C.linha}`, boxShadow: '0 2px 4px rgba(20,33,29,.08), 0 50px 90px -40px rgba(20,33,29,.45)', ...style }}>
      <div style={{ height: bar, background: C.linhoSuave, borderBottom: `1px solid ${C.linha}`, display: 'flex', alignItems: 'center', padding: `0 ${bar * 0.45}px`, position: 'relative' }}>
        <div style={{ display: 'flex', gap: bar * 0.18 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: bar * 0.26, height: bar * 0.26, borderRadius: '50%', background: '#D4CCBC', display: 'block' }} />
          ))}
        </div>
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', height: bar * 0.62, padding: `0 ${bar * 0.5}px`, minWidth: width * 0.3, borderRadius: 9, background: '#F7F4EE', border: `1px solid ${C.linha}`, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `500 ${bar * 0.3}px/1 ${FONT.text}`, color: C.pedra, whiteSpace: 'nowrap' }}>
          <b style={{ fontWeight: 500, color: C.tinta }}>novelo.helder.si</b>
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Telemóvel à volta de um ecrã de 390 px. */
export function PhoneChrome({ width, children, style }: { width: number; children: ReactNode; style?: CSSProperties }) {
  const pad = width * 0.032;
  return (
    <div style={{ width, borderRadius: width * 0.15, padding: pad, background: C.tinta, boxShadow: '0 2px 4px rgba(20,33,29,.15), 0 60px 100px -40px rgba(20,33,29,.6)', ...style }}>
      <div style={{ borderRadius: width * 0.12, overflow: 'hidden', background: C.linho, position: 'relative' }}>
        <div style={{ height: width * 0.075, background: C.linho, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: width * 0.28, height: width * 0.05, borderRadius: 999, background: C.tinta }} />
        </div>
        {children}
      </div>
    </div>
  );
}
