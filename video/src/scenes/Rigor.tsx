import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, easeOut, fadeOut, prog, rise } from '../anim';
import { Eyebrow, Title } from '../components/Type';
import { num } from '../format';
import { useLayout } from '../layout';
import { C, FONT } from '../theme';

// `just check` de 22 out 2026 (testes da API e da web, verdes) e `just eval-copilot` (155 perguntas ao modelo real,
// 100% dos números verificados; docs/engenharia/avaliacao-copiloto.md).
const STATS = [
  { v: 1037, l: 'testes da API' },
  { v: 437, l: 'testes da web' },
  { v: 155, l: 'perguntas de avaliação ao copiloto, 100% dos números verificados' },
];

/** 12. Rigor: nenhum número sem fonte, e testado. */
export function Rigor({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { portrait, pad } = useLayout();
  return (
    <AbsoluteFill style={{ background: C.noite, opacity: fadeOut(f, dur, 6) }}>
      <div style={{ position: 'absolute', left: pad, right: pad, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={rise(f, 0)}>
          <Eyebrow color={C.areia}>Rigor</Eyebrow>
        </div>
        <div style={{ ...rise(f, 6), marginTop: 24 }}>
          <Title size={portrait ? 80 : 78} color={C.linho}>
            Nenhum número sem fonte. Cada estimativa diz que é estimativa.
          </Title>
        </div>
        <div style={{ display: 'flex', flexDirection: portrait ? 'column' : 'row', gap: portrait ? 40 : 100, marginTop: portrait ? 80 : 70 }}>
          {STATS.map((s, i) => (
            <div key={s.l} style={{ ...rise(f, 30 + i * 10), maxWidth: portrait ? undefined : 470 }}>
              <div style={{ font: `500 ${portrait ? 110 : 104}px/1 ${FONT.title}`, color: C.areia, fontVariantNumeric: 'tabular-nums lining-nums' }}>
                {num(interpolate(f, [30 + i * 10, 80 + i * 10], [0, s.v], { ...clamp, easing: easeOut }))}
              </div>
              <div style={{ font: `400 ${portrait ? 30 : 26}px/1.3 Inter`, color: 'rgba(244,241,234,0.72)', marginTop: 8 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: portrait ? 80 : 70, font: `500 ${portrait ? 34 : 30}px/1.4 Inter`, color: C.linho, opacity: prog(f, 80, 14) }}>
          Em produção em <span style={{ color: C.florestaClara }}>novelo.helder.si</span> · código aberto no GitHub
        </div>
      </div>
    </AbsoluteFill>
  );
}
