import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, easeInOut, fadeOut, prog, rise } from '../anim';
import { GEO, GuimaraesMap } from '../components/GuimaraesMap';
import { Eyebrow, Source, Title } from '../components/Type';
import { num } from '../format';
import { useLayout } from '../layout';
import { C, FONT } from '../theme';

const existing = GEO.modes.find((m) => m.mode === 'existing');
const onDemand = GEO.modes.find((m) => m.mode === 'on_demand');

const STAGES = [
  {
    at: 24,
    n: '1',
    title: 'Uma viatura só para o têxtil, sem compactação.',
    stats: ['1 viatura nova', `${GEO.routes.length} circuitos por estrada`, `${num(GEO.kpis.km_year)} km/ano`],
    note: 'O meio novo de recolha que a Vitrus pede, a sair de Polvoreira. As rotas seguem as estradas reais (OpenStreetMap).',
    color: C.linho,
  },
  {
    at: 120,
    n: '2',
    title: 'Saco fechado à porta, num dia fixo por freguesia.',
    stats: [`${onDemand?.zones ?? 0} freguesias`, `${num(onDemand?.tonnes ?? 0, 1)} t/ano`],
    note: 'Limpo e seco, como a reutilização exige.',
    color: C.florestaClara,
  },
  {
    at: 206,
    n: '3',
    title: 'Paragem nos locais por onde já se passa, sem contentor novo.',
    stats: [`${existing?.points ?? 0} pontos`, `${num(existing?.tonnes ?? 0, 1)} t/ano`],
    note: 'Locais municipais da Vitrus, com o saco entregue em mão.',
    color: C.areia,
  },
  {
    at: 282,
    n: '4',
    title: 'E as escolas, como pontos com pessoas.',
    stats: [`${GEO.schools.length} escolas`],
    note: 'Candidatas na rede por locais reais.',
    color: C.linho,
  },
];

/** 8. A rede sem contentores, desenhada no mapa a partir do cenário de 60 000 €/ano. */
export function Network({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { width, height, portrait, pad } = useLayout();
  const mapW = portrait ? 840 : 820;
  const s = {
    outline: 1,
    containers: 0,
    routes: interpolate(f, [24, 110], [0, 1], { ...clamp, easing: easeInOut }),
    pap: interpolate(f, [120, 180], [0, 1], { ...clamp, easing: easeInOut }),
    existing: interpolate(f, [206, 266], [0, 1], { ...clamp, easing: easeInOut }),
    schools: interpolate(f, [282, 330], [0, 1], clamp),
  };
  const active = STAGES.reduce((acc, st, i) => (f >= st.at ? i : acc), -1);
  return (
    <AbsoluteFill style={{ background: C.noite, opacity: fadeOut(f, dur, 6) }}>
      <div style={{ position: 'absolute', ...(portrait ? { left: (width - 840) / 2, top: 430 } : { right: 110, top: (height - (mapW * GEO.height) / GEO.width) / 2 }) }}>
        <GuimaraesMap width={mapW} s={s} />
      </div>
      <div style={{ position: 'absolute', left: pad, top: portrait ? 170 : 120, width: portrait ? width - pad * 2 : 820 }}>
        <div style={rise(f, 0)}>
          <Eyebrow color={C.areia}>A rede · 60 000 €/ano</Eyebrow>
        </div>
        <div style={{ ...rise(f, 6), marginTop: 24 }}>
          <Title size={portrait ? 64 : 60} color={C.linho}>
            Em cada freguesia, o canal mais barato que funciona.
          </Title>
        </div>
      </div>
      <div style={{ position: 'absolute', left: pad, ...(portrait ? { right: pad, bottom: 190 } : { top: 400, width: 800 }) }}>
        {STAGES.map((st, i) => {
          const on = i === active;
          const seen = f >= st.at;
          if (portrait && !on) return null;
          return (
            <div
              key={st.n}
              style={{
                display: 'flex',
                gap: 26,
                marginBottom: portrait ? 0 : 34,
                opacity: seen ? (on ? 1 : 0.38) * prog(f, st.at, 14) : 0,
                transform: `translateY(${(1 - prog(f, st.at, 18)) * 30}px)`,
              }}
            >
              <div style={{ flex: '0 0 auto', width: 54, height: 54, borderRadius: '50%', background: st.color, color: C.noite, font: `600 26px/54px Inter`, textAlign: 'center' }}>{st.n}</div>
              <div>
                <div style={{ font: `500 ${portrait ? 44 : 38}px/1.15 ${FONT.title}`, color: C.linho }}>{st.title}</div>
                {(on || portrait) && (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 28px', marginTop: 14, font: `600 ${portrait ? 30 : 27}px/1.2 Inter`, color: st.color }}>
                      {st.stats.map((x) => (
                        <span key={x}>{x}</span>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, font: `400 ${portrait ? 24 : 22}px/1.35 Inter`, color: 'rgba(244,241,234,0.66)' }}>{st.note}</div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Source dark style={{ left: pad, right: pad, bottom: portrait ? 120 : 64, opacity: prog(f, 30, 12) }}>
        Cenário de referência por freguesia, 60 000 €/ano (otimizador Novelo, estimativa); depósito e respostas da Vitrus de 22 out 2026; INE; CAOP 2019.
      </Source>
    </AbsoluteFill>
  );
}
