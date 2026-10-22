import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, kf, prog, rise } from '../anim';
import { AppScreen, BrowserChrome, PhoneChrome } from '../components/AppScreen';
import { Body, Eyebrow, Title } from '../components/Type';
import { useLayout } from '../layout';
import { num } from '../format';
import { COVER_OTHER, COVER_URBAN, MC } from '../numbers';
import { C } from '../theme';

type Key = Array<[number, number]>;
/** Movimento de um ecrã: scroll (px CSS) e câmara (ponto focado em px CSS do ecrã, zoom), por fotogramas-chave. */
type Move = { shot: string; url: string; scroll: Key; cx?: Key; cy?: Key; z?: Key };

type Shot = {
  eyebrow: string;
  title: string;
  sub: string;
  desktop?: Move;
  mobile?: Move;
  special?: 'lot' | 'report' | 'copilot';
};

// Posições medidas na stack de dev (1440 × 900 e 390 × 844), 22 out 2026.
export const SHOTS: Shot[] = [
  {
    eyebrow: 'Decidir',
    title: 'O simulador: entra o orçamento, sai a rede.',
    sub: 'Maximizar toneladas com 60 000 € por ano. O otimizador decide freguesia a freguesia.',
    desktop: { shot: 'sim-desktop', url: '/pt/simulator', scroll: [[14, 0], [50, 1030]], cx: [[50, 720], [86, 800]], cy: [[50, 450], [86, 560]], z: [[50, 1], [86, 1.28]] },
    mobile: { shot: 'sim-mobile', url: '', scroll: [[14, 0], [56, 1130]] },
  },
  {
    eyebrow: 'Decidir',
    title: 'A rede no mapa, com as rotas.',
    sub: 'Paragens em locais existentes e o saco à porta onde compensa, com a viatura de têxtil.',
    desktop: { shot: 'sim-desktop', url: '/pt/simulator', scroll: [[0, 2010], [90, 2030]], cx: [[10, 720], [90, 850]], cy: [[10, 450], [90, 420]], z: [[10, 1], [90, 1.32]] },
    mobile: { shot: 'sim-mobile', url: '', scroll: [[0, 2450], [40, 2600]] },
  },
  {
    eyebrow: 'Decidir',
    title: 'O plano da viatura: dia, ronda e quilos.',
    sub: 'Freguesia a freguesia, a partir do estaleiro de Polvoreira, com a capacidade da viatura.',
    desktop: { shot: 'scenario-desktop', url: '/pt/scenarios/…', scroll: [[0, 1120], [40, 1320]], cx: [[40, 720], [86, 700]], cy: [[40, 450], [86, 420]], z: [[40, 1], [86, 1.3]] },
    mobile: { shot: 'scenario-mobile', url: '', scroll: [[0, 2030], [50, 2270]] },
  },
  {
    eyebrow: 'Decidir',
    title: 'Só conta o que se pode reutilizar.',
    sub: 'Toneladas reutilizáveis e custo por tonelada reutilizável, em cada cenário, com o intervalo entre entidades.',
    desktop: { shot: 'scenario-desktop', url: '/pt/scenarios/…', scroll: [[0, 580], [40, 760]], cx: [[40, 720], [86, 700]], cy: [[40, 450], [86, 290]], z: [[40, 1], [86, 1.32]] },
    mobile: { shot: 'scenario-mobile', url: '', scroll: [[0, 1080], [40, 1310]] },
  },
  {
    eyebrow: 'Provar',
    title: 'A cobertura que a diretiva exige.',
    sub: `${num(COVER_URBAN, 1)}% da população servida nas freguesias urbanas e ${num(COVER_OTHER, 1)}% fora delas (art. 22.º-C, n.º 9, b); estimativa).`,
    desktop: { shot: 'coverage-desktop', url: '/pt/scenarios/…?tab=coverage', scroll: [[0, 560], [50, 590], [92, 940]] },
    mobile: { shot: 'coverage-mobile', url: '', scroll: [[0, 930], [44, 940], [86, 1460]] },
  },
  {
    eyebrow: 'Provar',
    title: 'E se os pressupostos estiverem errados?',
    sub: `Tornado e 500 simulações: em 8 de cada 10, o custo fica entre ${num(MC.p10, 1)} e ${num(MC.p90, 1)} €/t.`,
    desktop: { shot: 'uncertainty-desktop', url: '/pt/scenarios/…?tab=uncertainty', scroll: [[0, 580], [36, 600], [80, 1050]] },
    mobile: { shot: 'uncertainty-mobile', url: '', scroll: [[0, 940], [36, 950], [80, 1800]] },
  },
  { eyebrow: 'Perguntar', title: 'Pergunta em português. Responde o otimizador.', sub: 'A IA nunca faz contas: um verificador rejeita qualquer número que não venha da origem.', special: 'copilot' },
  { eyebrow: 'Operar', title: 'Do saco ao lote, com passaporte.', sub: 'Triagem por foto confirmada pelo operador; lote com QR e passaporte público para quem recebe.', special: 'lot' },
  { eyebrow: 'Prestar contas', title: 'O relatório RAP, num clique.', sub: 'Custo por tipo de território, toneladas por destino, marcas e fontes: o dossiê para a mesa onde se fixa o custo.', special: 'report' },
];

function Screen({ move, f, width, mobile }: { move: Move; f: number; width: number; mobile: boolean }) {
  const screen = (
    <AppScreen
      shot={move.shot}
      width={width}
      scroll={kf(f, move.scroll)}
      cx={move.cx ? kf(f, move.cx) : undefined}
      cy={move.cy ? kf(f, move.cy) : undefined}
      z={move.z ? kf(f, move.z) : 1}
    />
  );
  return mobile ? <PhoneChrome width={width + width * 0.064}>{screen}</PhoneChrome> : <BrowserChrome width={width} url={move.url}>{screen}</BrowserChrome>;
}

function ShotView({ shot, dur, index }: { shot: Shot; dur: number; index: number }) {
  const f = useCurrentFrame();
  const { width, height, portrait, pad } = useLayout();
  const enter = prog(f, 0, 10);
  const exit = interpolate(f, [dur - 6, dur], [1, 0], clamp);
  const frameW = portrait ? 540 : 1220;

  let stage: React.ReactNode = null;
  const move = portrait ? shot.mobile : shot.desktop;
  if (move) {
    stage = <Screen move={move} f={f} width={frameW} mobile={portrait} />;
  } else if (shot.special === 'copilot') {
    // Troca real com o copiloto (stack de dev com OpenRouter, 22 out 2026): pergunta, resposta e cartões do otimizador.
    stage = portrait ? (
      <div style={{ width: width - pad * 2, borderRadius: 22, overflow: 'hidden', border: `1px solid ${C.linha}`, boxShadow: '0 2px 4px rgba(20,33,29,.08), 0 50px 90px -40px rgba(20,33,29,.45)', height: 1180 }}>
        <Img src={staticFile('shots/copilot-panel.png')} style={{ width: width - pad * 2, display: 'block', transform: `translateY(${-kf(f, [[20, 0], [80, 40]])}px)` }} />
      </div>
    ) : (
      <BrowserChrome width={frameW} url="/pt/scenarios/…">
        <div style={{ width: frameW, height: frameW * 0.625, overflow: 'hidden' }}>
          <Img src={staticFile('shots/copilot-desktop.png')} style={{ width: frameW, display: 'block', transform: `scale(${kf(f, [[16, 1], [70, 1.55]])})`, transformOrigin: '100% 22%' }} />
        </div>
      </BrowserChrome>
    );
  } else if (shot.special === 'lot') {
    const phoneW = portrait ? 520 : 330;
    stage = (
      <div style={{ position: 'relative', width: portrait ? width - pad * 2 : frameW, height: portrait ? 1100 : 820 }}>
        {portrait ? (
          <div style={{ position: 'absolute', left: 0, top: 30 }}>
            <PhoneChrome width={480}>
              <AppScreen shot="lot-mobile" width={480 / 1.064} scroll={kf(f, [[10, 0], [80, 300]])} />
            </PhoneChrome>
          </div>
        ) : (
          <BrowserChrome width={1000} url="/pt/lots/NOV-M9Z34P">
            <AppScreen shot="lot-desktop" width={1000} scroll={kf(f, [[10, 0], [80, 60]])} />
          </BrowserChrome>
        )}
        <div style={{ position: 'absolute', right: portrait ? 0 : -10, bottom: portrait ? 0 : 0, transform: `translateY(${(1 - prog(f, 16, 20)) * 80}px)`, opacity: prog(f, 16, 14) }}>
          <PhoneChrome width={phoneW}>
            <Img src={staticFile('shots/m-passport.png')} style={{ width: phoneW / 1.064, display: 'block' }} />
          </PhoneChrome>
        </div>
      </div>
    );
  } else if (shot.special === 'report') {
    const pw = portrait ? 640 : 500;
    const W = portrait ? width - pad * 2 : frameW;
    stage = (
      <div style={{ position: 'relative', width: W, height: portrait ? 1100 : 800 }}>
        {['p-1.png', 'p-2.png', 'p-3.png'].map((p, i) => {
          const t = prog(f, 4 + i * 8, 20);
          const rot = [-5, 0, 5][i] ?? 0;
          const dx = (portrait ? [-150, 0, 150][i] ?? 0 : [-360, 0, 360][i] ?? 0) * t;
          const dy = portrait ? ([60, 0, 60][i] ?? 0) * t : ([30, 0, 30][i] ?? 0) * t;
          return (
            <div
              key={p}
              style={{
                position: 'absolute',
                left: W / 2 - pw / 2 + dx,
                top: (portrait ? 20 : 10) + dy,
                width: pw,
                transform: `rotate(${rot * t}deg)`,
                boxShadow: '0 2px 4px rgba(20,33,29,.12), 0 40px 70px -30px rgba(20,33,29,.45)',
                borderRadius: 4,
                overflow: 'hidden',
                background: '#fff',
                zIndex: i === 1 ? 3 : 1,
              }}
            >
              <Img src={staticFile(`shots/${p}`)} style={{ width: pw, display: 'block' }} />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <div style={{ position: 'absolute', ...(portrait ? { left: pad, right: pad, top: 130 } : { left: pad, top: 0, bottom: 0, width: 440, display: 'flex', flexDirection: 'column', justifyContent: 'center' }) }}>
        <div style={rise(f, 2)}>
          <Eyebrow>
            {String(index + 1).padStart(2, '0')} · {shot.eyebrow}
          </Eyebrow>
        </div>
        <div style={{ ...rise(f, 6), marginTop: 22 }}>
          <Title size={portrait ? 64 : 54}>{shot.title}</Title>
        </div>
        <div style={{ ...rise(f, 14), marginTop: 20 }}>
          <Body size={portrait ? 28 : 24}>{shot.sub}</Body>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          ...(portrait ? { left: 0, right: 0, top: 610, display: 'flex', justifyContent: 'center' } : { right: 70, top: 0, bottom: 0, display: 'flex', alignItems: 'center' }),
          opacity: enter,
          transform: `translateY(${(1 - enter) * 50}px)`,
        }}
      >
        {stage}
      </div>
      {void height}
    </AbsoluteFill>
  );
}

/** 10. A app real, ecrã a ecrã (capturas da stack de dev com os dados de 22 out 2026). */
export function Montage({ per }: { per: number }) {
  return (
    <AbsoluteFill style={{ background: C.linho }}>
      {SHOTS.map((shot, i) => (
        <Sequence key={shot.title} from={i * per} durationInFrames={per} layout="none">
          <ShotView shot={shot} dur={per} index={i} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
