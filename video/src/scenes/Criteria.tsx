import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { fadeOut, prog, rise } from '../anim';
import { Eyebrow, Title } from '../components/Type';
import { useLayout } from '../layout';
import { num } from '../format';
import { K } from '../numbers';
import { C, FONT } from '../theme';

const ROWS = [
  { w: 'Impacto', name: 'Impacto', proof: `+${num(K.tonnes_year, 1)} t por ano fora do lixo, ${num(K.reusable_t, 1)} t reutilizáveis; a poupança no tratamento paga a operação (estimativas).` },
  { w: 'Inovação', name: 'Inovação', proof: 'Uma rede sem contentores, com uma viatura só para o têxtil. IA que conduz o otimizador e nunca inventa um número.' },
  { w: 'Viabilidade', name: 'Viabilidade', proof: 'Dados e respostas reais da Vitrus, otimizador OR-Tools, incerteza calculada. Em produção, com código aberto.' },
  { w: 'Continuidade', name: 'Continuidade', proof: 'Um piloto de 3 meses em duas freguesias, escolhidas pelo próprio Novelo. Replicável em qualquer município.' },
];

/** 11. O que já está provado: impacto, inovação, viabilidade e continuidade. */
export function Criteria({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { portrait, pad } = useLayout();
  return (
    <AbsoluteFill style={{ background: C.linho, opacity: fadeOut(f, dur, 6) }}>
      <div style={{ position: 'absolute', left: pad, right: pad, top: portrait ? 170 : 110 }}>
        <div style={rise(f, 0)}>
          <Eyebrow>Em resumo</Eyebrow>
        </div>
        <div style={{ ...rise(f, 6), marginTop: 22 }}>
          <Title size={portrait ? 74 : 70}>O que já está provado.</Title>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: portrait ? '1fr' : '1fr 1fr', gap: portrait ? 26 : 28, marginTop: portrait ? 64 : 56 }}>
          {ROWS.map((r, i) => {
            const at = 24 + i * 16;
            const p = prog(f, at, 16);
            return (
              <div key={r.name} style={{ ...rise(f, at, 16), background: '#FBF9F4', border: `1px solid ${C.linha}`, borderRadius: 20, padding: portrait ? '30px 34px' : '32px 38px' }}>
                <div style={{ font: `500 ${portrait ? 54 : 52}px/1 ${FONT.title}`, color: C.floresta }}>{r.w}</div>
                <div style={{ font: `400 ${portrait ? 27 : 24}px/1.42 Inter`, color: C.tinta, marginTop: 14, opacity: p }}>{r.proof}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}
