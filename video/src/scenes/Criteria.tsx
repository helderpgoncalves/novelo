import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { fadeOut, prog, rise } from '../anim';
import { Eyebrow, Title } from '../components/Type';
import { useLayout } from '../layout';
import { C, FONT } from '../theme';

const ROWS = [
  { w: '30%', name: 'Impacto e relevância', proof: '+396,5 t por ano fora do lixo, 235,6 t reutilizáveis, e todo o território, não só onde rende (estimativas).' },
  { w: '25%', name: 'Inovação e originalidade', proof: 'Uma rede sem contentores, sobre os circuitos que já existem. IA que conduz o otimizador e nunca inventa um número.' },
  { w: '25%', name: 'Viabilidade técnica', proof: 'Dados reais da Vitrus, otimizador OR-Tools, incerteza calculada. Em produção, com código aberto.' },
  { w: '20%', name: 'Apresentação e continuidade', proof: 'Um piloto de 3 meses em duas freguesias, desenhado pelo próprio Novelo. Replicável em qualquer município.' },
];

/** 11. Os quatro critérios do júri, cada um com a sua prova. */
export function Criteria({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { portrait, pad } = useLayout();
  return (
    <AbsoluteFill style={{ background: C.linho, opacity: fadeOut(f, dur, 6) }}>
      <div style={{ position: 'absolute', left: pad, right: pad, top: portrait ? 170 : 110 }}>
        <div style={rise(f, 0)}>
          <Eyebrow>Os critérios do júri</Eyebrow>
        </div>
        <div style={{ ...rise(f, 6), marginTop: 22 }}>
          <Title size={portrait ? 74 : 70}>Cada critério, com a sua prova.</Title>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: portrait ? '1fr' : '1fr 1fr', gap: portrait ? 26 : 28, marginTop: portrait ? 64 : 56 }}>
          {ROWS.map((r, i) => {
            const at = 24 + i * 16;
            const p = prog(f, at, 16);
            return (
              <div key={r.name} style={{ ...rise(f, at, 16), display: 'flex', gap: 30, alignItems: 'flex-start', background: '#FBF9F4', border: `1px solid ${C.linha}`, borderRadius: 20, padding: portrait ? '30px 34px' : '32px 36px' }}>
                <div style={{ font: `500 ${portrait ? 84 : 84}px/0.9 ${FONT.title}`, color: C.floresta, minWidth: portrait ? 170 : 170, fontVariantNumeric: 'lining-nums' }}>{r.w}</div>
                <div>
                  <div style={{ font: `600 ${portrait ? 30 : 28}px/1.2 Inter`, color: C.tinta }}>{r.name}</div>
                  <div style={{ font: `400 ${portrait ? 26 : 23}px/1.42 Inter`, color: C.pedra, marginTop: 10, opacity: p }}>{r.proof}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}
