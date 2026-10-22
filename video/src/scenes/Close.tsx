import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, easeInOut, prog, rise } from '../anim';
import { Halftone } from '../components/Halftone';
import { Logo } from '../components/Logo';
import { Body, Eyebrow, Title } from '../components/Type';
import { useLayout } from '../layout';
import { C, FONT } from '../theme';

/** 13. O pedido e o fecho. */
export function Close({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { width, height, portrait, pad } = useLayout();
  const swap = 150;
  const s = interpolate(f, [swap - 12, swap + 6], [0, 1], { ...clamp, easing: easeInOut });
  return (
    <AbsoluteFill style={{ background: C.noite }}>
      <Halftone
        name={`plataforma-${portrait ? 'portrait' : 'landscape'}`}
        width={width}
        height={height}
        origin={[0.8, 0.5]}
        revealFrames={80}
        zoomFrom={1.04}
        zoomTo={1}
        zoomFrames={dur}
        dim={1 - 0.65 * s}
        fade={portrait ? { side: 'top', from: 0.3, to: 0.75, floor: 0.06 } : { side: 'left', from: 0.5, to: 0.95, floor: 0.06 }}
      />
      <div style={{ position: 'absolute', left: pad, top: 0, bottom: 0, width: portrait ? width - pad * 2 : 1100, display: 'flex', flexDirection: 'column', justifyContent: portrait ? 'flex-start' : 'center', paddingTop: portrait ? 260 : 0, opacity: 1 - s }}>
        <div style={rise(f, 10)}>
          <Eyebrow color={C.areia}>O próximo passo</Eyebrow>
        </div>
        <div style={{ ...rise(f, 16), marginTop: 28 }}>
          <Title size={portrait ? 96 : 100} color={C.linho}>
            Pedimos um piloto de 3 meses em duas freguesias.
          </Title>
        </div>
        <div style={{ ...rise(f, 40), marginTop: 34 }}>
          <Body size={portrait ? 36 : 34} color="rgba(244,241,234,0.78)">
            Escolhidas pelo Novelo, para trocar os pressupostos por toneladas, €/t e rejeito medidos.
          </Body>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: s }}>
        <div style={{ transform: `scale(${0.94 + 0.06 * s})` }}>
          <Logo height={portrait ? 300 : 230} dark stacked />
        </div>
        <div style={{ marginTop: 50, font: `500 ${portrait ? 54 : 48}px/1.2 ${FONT.title}`, color: C.linho, opacity: prog(f, swap + 10, 14) }}>
          Do saco ao fio, ao menor custo.
        </div>
        <div style={{ marginTop: 34, font: `600 ${portrait ? 36 : 32}px/1 Inter`, color: C.florestaClara, opacity: prog(f, swap + 18, 14) }}>novelo.helder.si</div>
        <div style={{ marginTop: 50, font: `400 ${portrait ? 28 : 24}px/1.6 Inter`, color: 'rgba(244,241,234,0.7)', opacity: prog(f, swap + 26, 14) }}>
          Hélder Gonçalves · Flávio Fernandes
          <br />
          Hack4Guimarães 2035 · Desafio 5 TexVitrus
        </div>
      </div>
    </AbsoluteFill>
  );
}
