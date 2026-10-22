import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { fadeOut, rise } from '../anim';
import { Halftone } from '../components/Halftone';
import { Eyebrow, Title } from '../components/Type';
import { useLayout } from '../layout';
import { C } from '../theme';

/** 1. Penha ao pôr do sol, em meio-tom que nasce do sol; a pergunta. */
export function Open({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { width, height, portrait, pad } = useLayout();
  return (
    <AbsoluteFill style={{ background: C.noite }}>
      <Halftone
        name={`penha-${portrait ? 'portrait' : 'landscape'}`}
        width={width}
        height={height}
        origin={portrait ? [0.2, 0.55] : [0.14, 0.62]}
        revealFrames={70}
        zoomFrom={1}
        zoomTo={1.08}
        zoomFrames={dur + 20}
        fade={portrait ? { side: 'top', from: 0.18, to: 0.5, floor: 0.08 } : { side: 'left', from: 0.22, to: 0.62, floor: 0.08 }}
      />
      <div style={{ position: 'absolute', left: pad, top: portrait ? 260 : 0, bottom: portrait ? undefined : 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: portrait ? width - pad * 2 : 980, opacity: fadeOut(f, dur, 8) }}>
        <div style={rise(f, 24)}>
          <Eyebrow color={C.areia}>Guimarães · 2025</Eyebrow>
        </div>
        <div style={{ ...rise(f, 34, 22), marginTop: 34 }}>
          <Title size={portrait ? 104 : 112} color={C.linho}>
            Para onde vai a roupa que deitamos fora?
          </Title>
        </div>
      </div>
    </AbsoluteFill>
  );
}
