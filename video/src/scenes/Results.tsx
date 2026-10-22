import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, easeInOut, easeOut, fadeOut, prog, rise } from '../anim';
import { Body, Estimate, Eyebrow, Source, Title } from '../components/Type';
import { num } from '../format';
import { useLayout } from '../layout';
import { CAPTURE_AFTER, CAPTURE_NOW, K, N, TREATMENT_EUR_PER_T } from '../numbers';
import { C, FONT } from '../theme';

/** 9. O resultado de 60 000 €/ano: toneladas, €/t, reutilizável, a viatura; a poupança no tratamento paga a operação; a curva. */
export function Results({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { width, portrait, pad } = useLayout();
  const roll = (to: number, at: number) => interpolate(f, [at, at + 40], [0, to], { ...clamp, easing: easeOut });
  const tiles = [
    { v: `${num(roll(K.tonnes_year, 20), 1)} t`, l: 'desviadas do lixo por ano', at: 20, hero: true },
    { v: `${num(roll(K.annual_cost_eur / K.tonnes_year, 30), 1)} €/t`, l: 'custo por tonelada', at: 30 },
    { v: `${num(roll(K.reusable_t, 40), 1)} t`, l: `reutilizáveis (${num(K.reusable_t_low)} a ${num(K.reusable_t_high)} t)`, at: 40 },
    { v: `${K.vehicles} viatura`, l: `nova, só para o têxtil: ${num(K.vehicle_capex_eur)} €, ${num(K.vehicle_days_week, 1)} dias/semana`, at: 50 },
  ];

  // a poupança no tratamento contra o custo anual
  const barMax = Math.max(K.annual_cost_eur, K.avoided_treatment_eur);
  const grow = interpolate(f, [110, 160], [0, 1], { ...clamp, easing: easeInOut });
  const barW = portrait ? width - pad * 2 : 760;
  const bar = (label: string, value: number, color: string, at: number, text: string) => (
    <div style={{ marginTop: 22, opacity: prog(f, at, 12) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', font: `500 ${portrait ? 26 : 24}px/1.2 Inter`, color: C.tinta, width: barW }}>
        <span>{label}</span>
        <b style={{ fontWeight: 600 }}>{num(value * grow)} €</b>
      </div>
      <div style={{ height: 30, width: barW * (value / barMax) * grow, background: color, borderRadius: 8, marginTop: 10 }} />
      <div style={{ font: `400 ${portrait ? 21 : 19}px/1.3 Inter`, color: C.pedra, marginTop: 8 }}>{text}</div>
    </div>
  );

  // curva €/t contra toneladas (cenários por freguesia a vários orçamentos)
  const curve = N.curve;
  const cw = portrait ? width - pad * 2 : 760;
  const ch = portrait ? 360 : 380;
  const tMin = 200;
  const tMax = 760;
  const xs = (t: number) => ((t - tMin) / (tMax - tMin)) * cw;
  const ys = (e: number) => ch - (e / 220) * ch;
  const curveT = interpolate(f, [200, 270], [0, 1], { ...clamp, easing: easeInOut });
  const d = curve.map((p, i) => `${i ? 'L' : 'M'}${xs(p.tonnes)} ${ys(p.eurPerT)}`).join(' ');
  return (
    <AbsoluteFill style={{ background: C.linho, opacity: fadeOut(f, dur, 6) }}>
      <div style={{ position: 'absolute', left: pad, right: pad, top: portrait ? 130 : 84 }}>
        <div style={{ ...rise(f, 0), display: 'flex', alignItems: 'center', gap: 22 }}>
          <Eyebrow>O resultado</Eyebrow>
          <Estimate size={16} />
        </div>
        <div style={{ ...rise(f, 6), marginTop: 20 }}>
          <Title size={portrait ? 70 : 64}>Com 60 000 € por ano, sem um único contentor novo:</Title>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: portrait ? '1fr 1fr' : '1.2fr 1fr 1fr 1.25fr', gap: portrait ? 20 : 22, marginTop: portrait ? 44 : 40 }}>
          {tiles.map((t) => (
            <div key={t.l} style={{ ...rise(f, t.at), background: t.hero ? C.floresta : '#FBF9F4', border: `1px solid ${t.hero ? C.floresta : C.linha}`, borderRadius: 18, padding: '24px 28px' }}>
              <div style={{ font: `500 ${portrait ? 60 : t.hero ? 66 : 56}px/1 ${FONT.title}`, color: t.hero ? C.linho : C.tinta, fontVariantNumeric: 'tabular-nums lining-nums', whiteSpace: 'nowrap' }}>{t.v}</div>
              <div style={{ font: `400 ${portrait ? 23 : 20}px/1.3 Inter`, color: t.hero ? 'rgba(244,241,234,0.82)' : C.pedra, marginTop: 10 }}>{t.l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: portrait ? 'column' : 'row', gap: portrait ? 56 : 90, marginTop: portrait ? 56 : 44 }}>
          <div style={{ flex: portrait ? undefined : `0 0 ${barW}px` }}>
            <div style={rise(f, 100)}>
              <Title size={portrait ? 46 : 40}>A poupança no tratamento paga a operação.</Title>
            </div>
            {bar('Custo anual da rede', K.annual_cost_eur, C.pedra, 110, 'viatura nova, recolhas e km (pressupostos da equipa)')}
            {bar('Tratamento evitado', K.avoided_treatment_eur, C.floresta, 118, `${num(K.tonnes_year, 1)} t × ${num(TREATMENT_EUR_PER_T, 2)} €/t de aterro (TGR + Resinorte, dado da Vitrus)`)}
            <div style={{ marginTop: 22, font: `600 ${portrait ? 28 : 25}px/1.3 Inter`, color: C.floresta, opacity: prog(f, 170, 14) }}>
              Custo líquido: {num(K.net_annual_cost_eur)} € por ano · captura de {num(CAPTURE_NOW, 1)}% para {num(CAPTURE_AFTER, 1)}%
            </div>
          </div>
          <div style={{ flex: 1, opacity: prog(f, 190, 14) }}>
            <Body size={portrait ? 26 : 23} color={C.pedra} style={{ marginBottom: 14 }}>
              Custo por tonelada (€/t) a cada orçamento
            </Body>
            <svg width={cw} height={ch + 30} style={{ overflow: 'visible' }}>
              <line x1={0} y1={ch} x2={cw} y2={ch} stroke={C.linha} strokeWidth={2} />
              <path d={d} fill="none" stroke={C.floresta} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - curveT} />
              {curve.map((p, i) => {
                const on = prog(f, 200 + i * 14, 12);
                const hero = p.budget === 60000;
                const below = i % 2 === 0;
                // o ponto a seguir ao primeiro fica perto do de 60 000 €: etiqueta à esquerda
                const anchor = i === 1 ? 'end' : 'middle';
                const dx = i === 1 ? -18 : 0;
                return (
                  <g key={p.budget} opacity={on}>
                    <circle cx={xs(p.tonnes)} cy={ys(p.eurPerT)} r={hero ? 13 : 9} fill={hero ? C.floresta : C.tinta} />
                    <text x={xs(p.tonnes) + dx} y={ys(p.eurPerT) + (below ? 42 : -38)} textAnchor={anchor} style={{ font: `600 ${hero ? 23 : 20}px Inter`, fill: hero ? C.floresta : C.tinta }}>
                      {num(p.eurPerT, 1)} €/t
                    </text>
                    <text x={xs(p.tonnes) + dx} y={ys(p.eurPerT) + (below ? 66 : -16)} textAnchor={anchor} style={{ font: `400 18px Inter`, fill: C.pedra }}>
                      {num(p.budget / 1000)} mil € · {num(p.tonnes)} t
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
      <Source style={{ left: pad, right: pad, bottom: portrait ? 70 : 30, opacity: prog(f, 30, 12) }}>
        Otimizador Novelo (OR-Tools) sobre os dados da Vitrus, cenários por freguesia de 22 out 2026; tratamento: Vitrus (40 €/t TGR + 65,64 €/t Resinorte); estimativas.
      </Source>
    </AbsoluteFill>
  );
}
