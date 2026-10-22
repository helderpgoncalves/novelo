import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, easeInOut, easeOut, fadeOut, prog, rise } from '../anim';
import { GEO } from '../components/GuimaraesMap';
import { Body, Estimate, Eyebrow, Source, Title } from '../components/Type';
import { num } from '../format';
import { useLayout } from '../layout';
import { C, FONT } from '../theme';

const K = GEO.kpis;
// Cenários por freguesia de 22 out 2026 (docs/projeto/visao-geral.md e features/landing/facts.ts): €/t contra toneladas.
const CURVE = [
  { label: '40 000 €/ano', t: 323.9, eur: 85.6 },
  { label: '60 000 €/ano', t: 396.5, eur: 120.6 },
  { label: 'teto sem contentores', t: 597.7, eur: 232.3 },
];
const GENERATED_T = 2626.0;
const COLLECTED_T = 301.3;

/** 9. O resultado de 60 000 €/ano e a curva do custo por tonelada. */
export function Results({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { width, portrait, pad } = useLayout();
  const roll = (to: number, at: number) => interpolate(f, [at, at + 40], [0, to], { ...clamp, easing: easeOut });
  const tiles = [
    { v: `${num(roll(K.tonnes_year, 20), 1)} t`, l: 'desviadas do lixo por ano', at: 20, hero: true },
    { v: `${num(roll(K.annual_cost_eur / K.tonnes_year, 30), 1)} €/t`, l: 'custo por tonelada', at: 30 },
    { v: `${num(roll(K.reusable_t, 40), 1)} t`, l: 'reutilizáveis (198 a 289 t)', at: 40 },
    { v: `${num(roll(K.capex_eur, 50))} €`, l: `de investimento, ${K.points} pontos`, at: 50 },
  ];
  const capture = ((COLLECTED_T + K.tonnes_year) / GENERATED_T) * 100;
  const capNow = (COLLECTED_T / GENERATED_T) * 100;
  const capT = interpolate(f, [120, 170], [0, 1], { ...clamp, easing: easeInOut });
  const capV = capNow + (capture - capNow) * capT;

  // curva
  const cw = portrait ? width - pad * 2 : 760;
  const ch = portrait ? 420 : 440;
  const xs = (t: number) => ((t - 280) / (640 - 280)) * cw;
  const ys = (e: number) => ch - (e / 260) * ch;
  const curveT = interpolate(f, [190, 260], [0, 1], { ...clamp, easing: easeInOut });
  const d = CURVE.map((p, i) => `${i ? 'L' : 'M'}${xs(p.t)} ${ys(p.eur)}`).join(' ');
  return (
    <AbsoluteFill style={{ background: C.linho, opacity: fadeOut(f, dur, 6) }}>
      <div style={{ position: 'absolute', left: pad, right: pad, top: portrait ? 150 : 100 }}>
        <div style={{ ...rise(f, 0), display: 'flex', alignItems: 'center', gap: 22 }}>
          <Eyebrow>O resultado</Eyebrow>
          <Estimate size={16} />
        </div>
        <div style={{ ...rise(f, 6), marginTop: 22 }}>
          <Title size={portrait ? 76 : 72}>Com 60 000 € por ano, sem viaturas nem contentores novos:</Title>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: portrait ? '1fr 1fr' : '1.25fr 1fr 1fr 1fr', gap: portrait ? 22 : 24, marginTop: portrait ? 56 : 50 }}>
          {tiles.map((t) => (
            <div key={t.l} style={{ ...rise(f, t.at), background: t.hero ? C.floresta : '#FBF9F4', border: `1px solid ${t.hero ? C.floresta : C.linha}`, borderRadius: 18, padding: portrait ? '28px 30px' : '26px 30px' }}>
              <div style={{ font: `500 ${portrait ? 66 : t.hero ? 74 : 62}px/1 ${FONT.title}`, color: t.hero ? C.linho : C.tinta, fontVariantNumeric: 'tabular-nums lining-nums', whiteSpace: 'nowrap' }}>{t.v}</div>
              <div style={{ font: `400 ${portrait ? 25 : 22}px/1.3 Inter`, color: t.hero ? 'rgba(244,241,234,0.8)' : C.pedra, marginTop: 10 }}>{t.l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: portrait ? 'column' : 'row', gap: portrait ? 70 : 90, marginTop: portrait ? 70 : 60 }}>
          <div style={{ flex: 1, opacity: prog(f, 110, 14) }}>
            <Body size={portrait ? 30 : 26} color={C.pedra}>
              Captura do têxtil gerado
            </Body>
            <div style={{ font: `500 ${portrait ? 120 : 110}px/1 ${FONT.title}`, color: C.floresta, marginTop: 10, fontVariantNumeric: 'tabular-nums lining-nums' }}>
              {num(capV, 1)}%
            </div>
            <div style={{ position: 'relative', height: 18, background: C.linha, borderRadius: 9, marginTop: 20, maxWidth: 760 }}>
              <div style={{ position: 'absolute', inset: 0, width: `${capNow}%`, background: C.pedra, borderRadius: 9 }} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${capNow}%`, width: `${(capV - capNow)}%`, background: C.floresta, borderRadius: '0 9px 9px 0' }} />
            </div>
            <Body size={portrait ? 24 : 22} style={{ marginTop: 14 }}>
              hoje 11,5% · com o cenário, cerca de {num(capture, 0)}%
            </Body>
          </div>
          <div style={{ flex: portrait ? undefined : `0 0 ${cw}px`, opacity: prog(f, 180, 14) }}>
            <Body size={portrait ? 30 : 26} color={C.pedra} style={{ marginBottom: 20 }}>
              Custo por tonelada (€/t) contra toneladas por ano
            </Body>
            <svg width={cw} height={ch + 40} style={{ overflow: 'visible' }}>
              <line x1={0} y1={ch} x2={cw} y2={ch} stroke={C.linha} strokeWidth={2} />
              <path d={d} fill="none" stroke={C.floresta} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - curveT} />
              {CURVE.map((p, i) => {
                const on = prog(f, 195 + i * 22, 12);
                const anchor = i === 0 ? 'start' : 'end';
                const lx = xs(p.t) + (i === 0 ? 22 : -24);
                const ly = ys(p.eur) + (i === 0 ? 40 : -34);
                return (
                  <g key={p.label} opacity={on}>
                    <circle cx={xs(p.t)} cy={ys(p.eur)} r={i === 1 ? 14 : 10} fill={i === 1 ? C.floresta : C.tinta} />
                    <text x={lx} y={ly} textAnchor={anchor} style={{ font: `600 25px Inter`, fill: C.tinta }}>
                      {num(p.eur, 1)} €/t
                    </text>
                    <text x={lx} y={ly + 26} textAnchor={anchor} style={{ font: `400 21px Inter`, fill: C.pedra }}>
                      {p.label} · {num(p.t, 1)} t
                    </text>
                  </g>
                );
              })}
            </svg>
            <Body size={portrait ? 28 : 25} color={C.tinta} style={{ marginTop: 18, opacity: prog(f, 270, 14), fontWeight: 500 }}>
              As últimas toneladas custam quase o dobro. É esta curva que deixa decidir com números.
            </Body>
          </div>
        </div>
      </div>
      <Source style={{ left: pad, right: pad, bottom: portrait ? 90 : 40, opacity: prog(f, 30, 12) }}>
        Otimizador Novelo (OR-Tools CP-SAT e VRP) sobre os dados da Vitrus; cenários de 22 out 2026; estimativas. Captura = (301,3 + 396,5) ÷ 2 626,0 t.
      </Source>
    </AbsoluteFill>
  );
}
