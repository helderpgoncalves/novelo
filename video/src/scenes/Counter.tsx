import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, easeInOut, fadeOut, prog, rise } from '../anim';
import { Body, Estimate, Source, Title } from '../components/Type';
import { num } from '../format';
import { useLayout } from '../layout';
import { C, FONT } from '../theme';

/** 2. O número: 43 051 t × 5,4% = 2 324,8 t por ano no lixo indiferenciado. */
export function Counter({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { width, portrait, pad } = useLayout();
  const v = interpolate(f, [14, 96], [0, 2324.754], { ...clamp, easing: easeInOut });
  const settle = prog(f, 96, 20);
  const big = portrait ? 236 : 300;
  return (
    <AbsoluteFill style={{ background: C.noite, opacity: fadeOut(f, dur, 6) }}>
      <div style={{ position: 'absolute', left: pad, right: pad, top: portrait ? 470 : 290 }}>
        <div style={rise(f, 0)}>
          <Body size={portrait ? 40 : 36} color="rgba(244,241,234,0.75)">
            Em 2025, a Vitrus recolheu <b style={{ color: C.linho, fontWeight: 600 }}>{num(43051)} t</b> de lixo indiferenciado.{portrait ? <br /> : ' '}
            <b style={{ color: C.linho, fontWeight: 600 }}>5,4%</b> é têxtil.
          </Body>
        </div>
        <div
          style={{
            marginTop: portrait ? 90 : 40,
            font: `500 ${big}px/0.95 ${FONT.title}`,
            letterSpacing: '-0.03em',
            color: C.areia,
            fontVariantNumeric: 'tabular-nums lining-nums',
            whiteSpace: 'nowrap',
            opacity: prog(f, 8, 10),
          }}
        >
          {num(v, 1)}
          <span style={{ fontSize: big * 0.45, marginLeft: 24, color: C.linho }}>t</span>
        </div>
        <div style={{ marginTop: 34, display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: portrait ? 'flex-start' : 'center', gap: 26, opacity: settle, transform: `translateY(${(1 - settle) * 20}px)` }}>
          <Title size={portrait ? 60 : 58} color={C.linho} style={{ maxWidth: portrait ? width - pad * 2 : 1300 }}>
            de têxtil por ano acabam no lixo.
          </Title>
          <Estimate dark size={20} />
        </div>
      </div>
      <Source dark style={{ left: pad, right: pad, bottom: portrait ? 120 : 64, opacity: settle }}>
        Vitrus Ambiente (RSU recolhido em 2025); APA (5,4% de têxtil no RSU, indicado pela Vitrus). 43 051 t × 5,4% = 2 324,8 t.
      </Source>
    </AbsoluteFill>
  );
}
