import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, easeInOut, fadeOut, prog, rise } from '../anim';
import { Body, Eyebrow, Source, Title } from '../components/Type';
import { useLayout } from '../layout';
import { C, FONT } from '../theme';

/** 5. A lei: obrigatória desde 2025, paga o município; em 2028 a RAP, só para as peças novas e só o custo eficiente. */
export function Law({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { width, portrait, pad } = useLayout();
  const lineW = width - pad * 2;
  const draw = interpolate(f, [20, 80], [0, 1], { ...clamp, easing: easeInOut });
  const x2025 = 0.08;
  const x2028 = portrait ? 0.78 : 0.72;
  // 17 jun 2027, prazo de transposição: proporcional às datas entre 1 jan 2025 e 17 abr 2028
  const X_TRANSP = x2025 + (x2028 - x2025) * (897 / 1202);
  const punch = 180;
  const shift = interpolate(f, [punch - 14, punch], [0, 1], { ...clamp, easing: easeInOut });
  const mark = (x: number, at: number, top: string, title: string, body: string, color: string, dy = 0) => (
    <div style={{ position: 'absolute', left: x * lineW, top: 0, opacity: prog(f, at, 14) }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: color, transform: 'translate(-11px, -11px)' }} />
      {dy > 0 && <div style={{ position: 'absolute', left: -1, top: 14, width: 2, height: dy + 10, background: C.linha }} />}
      <div style={{ position: 'absolute', top: 36 + dy, left: x > 0.5 ? undefined : -11, right: x > 0.5 ? -11 : undefined, width: portrait ? 640 : 640, textAlign: x > 0.5 ? 'right' : 'left' }}>
        <div style={{ font: `600 20px/1 Inter`, letterSpacing: '0.18em', textTransform: 'uppercase', color }}>{top}</div>
        <div style={{ font: `500 ${portrait ? 42 : 46}px/1.1 ${FONT.title}`, color: C.tinta, marginTop: 14 }}>{title}</div>
        <div style={{ font: `400 ${portrait ? 26 : 27}px/1.4 Inter`, color: C.pedra, marginTop: 10 }}>{body}</div>
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.linho, opacity: fadeOut(f, dur, 6) }}>
      <div style={{ position: 'absolute', left: pad, right: pad, top: portrait ? 220 : 130, opacity: 1 - shift, transform: `translateY(${-shift * 40}px)` }}>
        <div style={rise(f, 0)}>
          <Eyebrow>A lei</Eyebrow>
        </div>
        <div style={{ ...rise(f, 6), marginTop: 26 }}>
          <Title size={portrait ? 80 : 76}>A recolha seletiva já é obrigatória. Hoje, paga-a o município.</Title>
        </div>
        <div style={{ position: 'relative', marginTop: portrait ? 300 : 190, height: portrait ? 700 : 330 }}>
          <div style={{ position: 'absolute', left: 0, top: -2, height: 4, width: lineW * draw, background: C.linha }} />
          <div style={{ position: 'absolute', left: x2025 * lineW, top: -9, height: 18, width: (x2028 - x2025) * lineW * interpolate(f, [56, 96], [0, 1], { ...clamp, easing: easeInOut }), background: C.areia, borderRadius: 9, opacity: 0.55 }} />
          <div style={{ position: 'absolute', left: ((x2025 + x2028) / 2) * lineW, top: -84, transform: 'translateX(-50%)', font: `600 22px/1 Inter`, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A5F33', opacity: prog(f, 84, 12), whiteSpace: 'nowrap' }}>
            paga o município
          </div>
          <div style={{ position: 'absolute', left: X_TRANSP * lineW, top: -7, width: 14, height: 14, borderRadius: '50%', background: C.pedra, transform: 'translateX(-7px)', opacity: prog(f, 92, 12) }} />
          <div style={{ position: 'absolute', left: X_TRANSP * lineW, top: portrait ? 26 : -40, transform: 'translateX(-50%)', font: `600 18px/1 Inter`, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.pedra, opacity: prog(f, 92, 12), whiteSpace: 'nowrap', display: portrait ? 'none' : 'block' }}>
            17 jun 2027 · transposição
          </div>
          {mark(x2025, 34, '1 jan 2025', 'Recolha seletiva de têxteis obrigatória', 'Diretiva 2008/98/CE e regime geral de gestão de resíduos.', C.floresta)}
          {mark(x2028, 110, '17 abr 2028', 'Responsabilidade alargada do produtor', 'Só para as peças vendidas depois da lei nacional, e só o custo eficiente.', C.tinta, portrait ? 260 : 0)}
        </div>
      </div>
      <div style={{ position: 'absolute', left: pad, right: pad, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: shift }}>
        <div style={{ transform: `translateY(${(1 - shift) * 40}px)` }}>
          <Title size={portrait ? 92 : 96} style={{ maxWidth: 1500 }}>
            Quem chegar à mesa sem saber quanto custa cada tonelada <span style={{ color: C.floresta }}>não tem como defender o seu número.</span>
          </Title>
          <div style={{ marginTop: 40 }}>
            <Body size={portrait ? 32 : 30}>Os custos são fixados «entre os intervenientes relevantes», entre eles as autoridades locais.</Body>
          </div>
        </div>
      </div>
      <Source style={{ left: pad, right: pad, bottom: portrait ? 120 : 64, opacity: prog(f, 30, 12) }}>
        Diretiva (UE) 2025/1892, art. 22.º-A, n.º 7, 11 e 12; APA, perguntas frequentes sobre têxteis (dez 2025).
      </Source>
    </AbsoluteFill>
  );
}
