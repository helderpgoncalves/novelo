import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, fadeOut, prog, rise } from '../anim';
import { Body, Estimate, Source, Title } from '../components/Type';
import { useLayout } from '../layout';
import { C, FONT } from '../theme';

// 301,27 t recolhidas ÷ (3 003,3 + 301,27) t geradas = 9,1% ≈ 18 em 200 pontos (cada ponto ≈ 16,5 t).
const TOTAL = 200;
const COLLECTED = 18;

/** 3. Mais de 9 em cada 10 quilos acabam no lixo: 200 pontos, 18 recolhidos à parte. */
export function Waffle({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { width, portrait, pad } = useLayout();
  const cols = 20;
  const cell = portrait ? 45.6 : 40;
  const r = cell * 0.36;
  const gridW = cols * cell;
  return (
    <AbsoluteFill style={{ background: C.linho, opacity: fadeOut(f, dur, 6) }}>
      <div
        style={{
          position: 'absolute',
          left: pad,
          right: pad,
          top: portrait ? 260 : 150,
          display: 'flex',
          flexDirection: portrait ? 'column' : 'row',
          gap: portrait ? 64 : 110,
          alignItems: portrait ? 'flex-start' : 'center',
        }}
      >
        <div style={{ flex: portrait ? undefined : '0 0 760px' }}>
          <div style={rise(f, 0)}>
            <Title size={portrait ? 88 : 84}>Mais de 9 em cada 10 quilos acabam no lixo.</Title>
          </div>
          <div style={{ ...rise(f, 70), marginTop: portrait ? 36 : 54, display: 'flex', alignItems: 'baseline', gap: 22 }}>
            <span style={{ font: `500 ${portrait ? 150 : 140}px/1 ${FONT.title}`, color: C.floresta, letterSpacing: '-0.02em' }}>9,1%</span>
            <Estimate size={18} />
          </div>
          <div style={{ ...rise(f, 80), marginTop: 12 }}>
            <Body size={portrait ? 34 : 32}>
              do têxtil chega à recolha seletiva: <b style={{ color: C.tinta, fontWeight: 600 }}>301,3 t</b> em 2025, recolhidas por 4 entidades.
            </Body>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
        <svg width={gridW} height={(TOTAL / cols) * cell} style={{ overflow: 'visible', flex: '0 0 auto', }}>
          {Array.from({ length: TOTAL }, (_, i) => {
            const x = (i % cols) * cell + cell / 2;
            const y = Math.floor(i / cols) * cell + cell / 2;
            const appear = interpolate(f, [6 + i * 0.22, 16 + i * 0.22], [0, 1], clamp);
            const collected = i < COLLECTED;
            const turn = interpolate(f, [34 + i * 0.4, 44 + i * 0.4], [0, 1], clamp);
            const fill = collected ? C.floresta : turn > 0.5 ? C.tinta : C.linha;
            return <circle key={i} cx={x} cy={y} r={r * appear * (collected ? 1 + 0.12 * prog(f, 66, 10) : 1)} fill={fill} opacity={collected ? 1 : 0.86} />;
          })}
        </svg>
          <div style={{ display: 'flex', gap: 40, ...rise(f, 90), font: `500 24px/1 ${'Inter'}`, color: C.pedra }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <i style={{ width: 20, height: 20, borderRadius: '50%', background: C.floresta, display: 'block' }} /> recolhido à parte
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <i style={{ width: 20, height: 20, borderRadius: '50%', background: C.tinta, display: 'block' }} /> no lixo indiferenciado
            </span>
          </div>
        </div>
      </div>
      <Source style={{ left: pad, right: pad, bottom: portrait ? 120 : 64, opacity: prog(f, 90, 12), maxWidth: width - pad * 2 }}>
        Vitrus Ambiente, 2025 (301,3 t recolhidas à parte); ≈ 3 003,3 t por desviar. Captura = 301,3 ÷ 3 304,6 t geradas. Cada ponto ≈ 16,5 t.
      </Source>
    </AbsoluteFill>
  );
}
