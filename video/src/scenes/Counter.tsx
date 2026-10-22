import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, easeInOut, fadeOut, prog, rise } from '../anim';
import { Body, Estimate, Source, Title } from '../components/Type';
import { num } from '../format';
import { useLayout } from '../layout';
import { C, FONT } from '../theme';

// Vitrus, R&C 2025, p. 8: as 43 050,5 t que recolheu são 84,0% do indiferenciado do concelho; APA, RARU 2025, p. 24: 5,86% de
// têxtil. Confirmado pela Vitrus a 22 out 2026 (usar o total do concelho e os 5,86%).
const RSU_VITRUS_T = 43050.5;
const VITRUS_SHARE = 0.84;
const TEXTILE_SHARE = 0.0586;
const RSU_MUNICIPALITY_T = RSU_VITRUS_T / VITRUS_SHARE;
const TEXTILE_T = RSU_MUNICIPALITY_T * TEXTILE_SHARE;

/** 2. O número: ≈ 51 250 t de indiferenciado no concelho × 5,86% ≈ 3 003,3 t de têxtil por ano no lixo. */
export function Counter({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { width, portrait, pad } = useLayout();
  const v = interpolate(f, [14, 96], [0, TEXTILE_T], { ...clamp, easing: easeInOut });
  const settle = prog(f, 96, 20);
  const big = portrait ? 236 : 300;
  return (
    <AbsoluteFill style={{ background: C.noite, opacity: fadeOut(f, dur, 6) }}>
      <div style={{ position: 'absolute', left: pad, right: pad, top: portrait ? 470 : 290 }}>
        <div style={rise(f, 0)}>
          <Body size={portrait ? 40 : 36} color="rgba(244,241,234,0.75)">
            Em 2025, o concelho produziu cerca de <b style={{ color: C.linho, fontWeight: 600 }}>{num(Math.round(RSU_MUNICIPALITY_T / 10) * 10)} t</b> de lixo indiferenciado.{portrait ? <br /> : ' '}
            <b style={{ color: C.linho, fontWeight: 600 }}>5,86%</b> é têxtil.
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
        Vitrus, Relatório e Contas 2025, p. 8 (43 050,5 t = 84,0% do concelho); APA, RARU 2025, p. 24 (5,86% de têxtil). 51 250,6 t × 5,86% ≈ 3 003,3 t.
      </Source>
    </AbsoluteFill>
  );
}
