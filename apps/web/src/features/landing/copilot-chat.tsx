import { Link } from '@tanstack/react-router';
import {
  ArrowUp,
  Check,
  Cpu,
  ListChecks,
  MessageSquareText,
  RotateCcw,
  ShieldCheck,
  User,
} from 'lucide-react';
import { type CSSProperties, Fragment, useEffect, useRef, useState } from 'react';
import { BrandSymbol } from '@/components/brand-logo';
import { formatEur, formatNumber } from '@/lib/format';
import { motionAllowed, useInViewOnce } from '@/lib/motion';
import { m } from '@/paraglide/messages';
import { FACTS } from './facts';

/**
 * Janela do Copiloto da landing: uma conversa gravada que corre uma só vez ao entrar no ecrã (cerca de 8,5 s) e fica no
 * estado final. Tudo é CSS: o estado (`idle`, `run`, `done`) é uma classe na raiz e cada elemento tem o seu `--d` (atraso),
 * por isso não há temporizadores nem JS depois do fim, só transform e opacity. O conteúdo ocupa sempre o seu lugar (o que
 * está por mostrar fica transparente), logo a janela tem a altura final desde o início. Sem movimento (ou sem JS) aparece
 * já completa. Os números são os da Regra Zero: ver `copilot-demo.ts`.
 */

/** Custo anual do cenário base (40 000 €/ano de orçamento), calculado pelo otimizador: `FACTS.scenarioBase`. */
const BASE_COST_EUR = FACTS.scenarioBase.cost;
const T = {
  question: 0.3,
  think: 0.8,
  steps: [
    { s: 0.9, e: 1.7 },
    { s: 1.7, e: 2.5 },
    { s: 2.5, e: 4.2 },
    { s: 4.2, e: 5.0 },
  ],
  answer: 5.3,
  word: 0.042,
  card: 6.5,
  bars: 7.1,
  sources: 7.0,
  verify: 7.7,
  chips: 8.1,
  footer: 8.5,
} as const;

type Play = 'idle' | 'run' | 'done';
const vars = (o: Record<string, string | number>) => o as CSSProperties;
const at = (d: number) => vars({ '--d': `${d}s` });

/** Anel de «a trabalhar»: um arco que roda (transform) só enquanto o passo está ativo. */
function Ring({ s, e }: { s: number; e: number }) {
  return (
    <span
      aria-hidden="true"
      className="lp-cp-ring"
      style={vars({ '--s': `${s}s`, '--dur': `${e - s}s`, '--n': Math.ceil((e - s) / 0.9) })}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="10.5" />
      </svg>
    </span>
  );
}

interface Token {
  key: string;
  kind: 'space' | 'word' | 'num' | 'cite';
  text: string;
  d: number;
}

/** Parte a resposta em palavras (`**negrito**` para os números e `[n]` para as citações), cada uma com o seu atraso. */
function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let pos = 0;
  let n = 0;
  for (const seg of text
    .replace(/\s+(\[\d\])/g, '$1')
    .split(/(\*\*[^*]+\*\*|\[\d\])/)
    .filter(Boolean)) {
    const start = pos;
    pos += seg.length;
    const d = () => T.answer + n++ * T.word;
    if (seg.startsWith('**'))
      out.push({ key: `n${start}`, kind: 'num', text: seg.slice(2, -2), d: d() });
    else if (/^\[\d\]$/.test(seg))
      out.push({ key: `c${start}`, kind: 'cite', text: seg.slice(1, -1), d: d() });
    else {
      let at = start;
      for (const w of seg.split(/(\s+)/).filter(Boolean)) {
        const space = /^\s+$/.test(w);
        out.push({ key: `w${at}`, kind: space ? 'space' : 'word', text: w, d: space ? 0 : d() });
        at += w.length;
      }
    }
  }
  return out;
}

/** Texto da resposta em streaming: as palavras aparecem em cascata (só opacity). */
function Streamed({ text }: { text: string }) {
  return (
    <>
      {tokenize(text).map((t) => {
        if (t.kind === 'space') return <Fragment key={t.key}>{t.text}</Fragment>;
        if (t.kind === 'num')
          return (
            <strong key={t.key} className="lp-cp-w lp-cp-num" style={at(t.d)}>
              {t.text}
            </strong>
          );
        if (t.kind === 'cite')
          return (
            <sup key={t.key} className="lp-cp-w lp-cp-cite" style={at(t.d)}>
              {t.text}
            </sup>
          );
        return (
          <span key={t.key} className="lp-cp-w" style={at(t.d)}>
            {t.text}
          </span>
        );
      })}
    </>
  );
}

/** Intervalo P10 a P90 em SVG: faixa, ponto do caso central. Eixo 80 a 180 €/t. */
function RangeGauge() {
  const s = FACTS.scenario60k;
  const x = (v: number) => 4 + ((v - 80) / 100) * 192;
  return (
    <svg viewBox="0 0 200 20" className="lp-cp-gauge" aria-hidden="true" focusable="false">
      <line x1="4" x2="196" y1="10" y2="10" className="lp-cp-gauge-track" />
      <rect
        x={x(s.p10)}
        y="5"
        width={x(s.p90) - x(s.p10)}
        height="10"
        rx="5"
        className="lp-cp-gauge-band lp-cp-grow"
        style={at(T.bars)}
      />
      <circle
        cx={x(s.eurPerT)}
        cy="10"
        r="4.5"
        className="lp-cp-gauge-dot lp-cp-pop"
        style={at(T.bars + 0.35)}
      />
    </svg>
  );
}

export function CopilotChat() {
  const s60 = FACTS.scenario60k;
  const ref = useRef<HTMLElement>(null);
  const seen = useInViewOnce(ref, '0px 0px -30% 0px');
  const [play, setPlay] = useState<Play>(() => (motionAllowed() ? 'idle' : 'done'));

  useEffect(() => {
    if (seen && play === 'idle') setPlay('run');
  }, [seen, play]);

  const replay = () => {
    setPlay('idle');
    window.setTimeout(() => setPlay('run'), 60);
  };

  const question = m.landing_cp_question();
  const answer = m.landing_cp_answer();
  const steps = [
    { label: m.landing_cp_step_1(), Icon: MessageSquareText },
    { label: m.landing_cp_step_2(), Icon: ListChecks },
    { label: m.landing_cp_step_3(), Icon: Cpu },
    { label: m.landing_cp_step_4(), Icon: ShieldCheck },
  ];
  const costNow = formatEur(s60.cost);
  const delta = `+${formatEur(s60.cost - BASE_COST_EUR)}`;
  const eurT = `${formatNumber(s60.eurPerT, 1)} €/t`;
  const range = `${formatNumber(s60.p10, 1)} – ${formatNumber(s60.p90, 1)} €/t`;
  const thinkEnd = T.steps[3].e;

  return (
    <figure ref={ref} data-play={play} aria-label={m.landing_cp_label()} className="lp-cp">
      <div aria-hidden="true" className="lp-cp-bar">
        <BrandSymbol className="size-[18px]" />
        <span className="lp-cp-name">{m.landing_cp_title()}</span>
        <kbd className="lp-cp-kbd">⌘K</kbd>
        <span className="lp-cp-seal">{m.landing_cp_example()}</span>
      </div>

      <div aria-hidden="true" className="lp-cp-body">
        {/* a) pergunta */}
        <div className="lp-cp-row lp-cp-row-user lp-cp-a" style={at(T.question)}>
          <p className="lp-cp-bubble">{question}</p>
          <span className="lp-cp-avatar">
            <User className="size-4" strokeWidth={1.75} />
          </span>
        </div>

        {/* b) a pensar: linha do tempo vertical */}
        <div className="lp-cp-think lp-cp-a" style={at(T.think)}>
          <div className="lp-cp-think-head">
            <span className="lp-cp-spin">
              <Ring s={T.steps[0].s} e={thinkEnd} />
              <Check className="lp-cp-chk size-3.5" strokeWidth={2.5} style={at(thinkEnd)} />
            </span>
            <span className="lp-cp-swap">
              <span className="lp-cp-t-run" style={vars({ '--e': `${thinkEnd}s` })}>
                {m.landing_cp_thinking()}
              </span>
              <span className="lp-cp-t-done" style={vars({ '--e': `${thinkEnd}s` })}>
                {m.landing_cp_thought()}
              </span>
            </span>
          </div>
          <ol className="lp-cp-steps">
            {steps.map(({ label, Icon }, i) => {
              const { s, e } = T.steps[i] ?? { s: 0, e: 0 };
              return (
                <li
                  key={label}
                  className="lp-cp-step lp-cp-a"
                  style={vars({ '--d': `${s}s`, '--e': `${e}s` })}
                >
                  <span className="lp-cp-node">
                    <Ring s={s} e={e} />
                    <Icon className="lp-cp-ico size-3.5" strokeWidth={1.75} />
                    <Check className="lp-cp-chk size-3.5" strokeWidth={2.5} />
                  </span>
                  <span className="lp-cp-step-label">{label}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* c) resposta em streaming */}
        <div className="lp-cp-row lp-cp-row-ai">
          <span className="lp-cp-avatar lp-cp-avatar-ai lp-cp-a" style={at(T.answer - 0.2)}>
            <BrandSymbol className="size-4" />
          </span>
          <div className="lp-cp-ai">
            <p className="lp-cp-answer">
              <Streamed text={answer} />
            </p>
            <p className="lp-cp-sources lp-cp-a" style={at(T.sources)}>
              <span>
                <b>1</b>
                {m.landing_cp_source_1()}
              </span>
              <span>
                <b>2</b>
                {m.landing_cp_source_2()}
              </span>
            </p>

            {/* d) cartão de resultado */}
            <article className="lp-cp-card lp-cp-a" style={at(T.card)}>
              <header className="lp-cp-card-head">
                <h3>{m.landing_cp_card_title()}</h3>
                <span className="lp-cp-est">{m.landing_cp_estimate()}</span>
              </header>
              <dl className="lp-cp-kpis">
                <div>
                  <dt>{m.landing_cp_kpi_cost()}</dt>
                  <dd>{costNow}</dd>
                  <small className="lp-cp-delta">{m.landing_cp_kpi_delta({ value: delta })}</small>
                </div>
                <div>
                  <dt>{m.landing_cp_kpi_eurt()}</dt>
                  <dd>{eurT}</dd>
                  <small>P50 {formatNumber(s60.p50, 1)} €/t</small>
                </div>
                <div className="lp-cp-kpi-wide">
                  <dt>{m.landing_cp_kpi_range()}</dt>
                  <dd>{range}</dd>
                  <RangeGauge />
                </div>
              </dl>
              <div className="lp-cp-bars">
                <div className="lp-cp-bar-row">
                  <span>{m.landing_cp_base()}</span>
                  <i className="lp-cp-track">
                    <i
                      className="lp-cp-fill lp-cp-fill-base lp-cp-grow"
                      style={vars({
                        width: `${(BASE_COST_EUR / s60.budget) * 100}%`,
                        '--d': `${T.bars}s`,
                      })}
                    />
                  </i>
                  <b>{formatEur(BASE_COST_EUR)}</b>
                </div>
                <div className="lp-cp-bar-row">
                  <span>{m.landing_cp_scenario()}</span>
                  <i className="lp-cp-track">
                    <i
                      className="lp-cp-fill lp-cp-grow"
                      style={vars({
                        width: `${(s60.cost / s60.budget) * 100}%`,
                        '--d': `${T.bars + 0.15}s`,
                      })}
                    />
                  </i>
                  <b>{costNow}</b>
                </div>
              </div>
              <footer className="lp-cp-card-foot">
                <Cpu className="size-3.5" strokeWidth={1.75} />
                {m.landing_cp_calc()}
              </footer>
            </article>

            {/* e) verificação, uma só vez */}
            <p className="lp-cp-verify lp-cp-a" style={at(T.verify)}>
              <ShieldCheck className="size-[18px] shrink-0" strokeWidth={1.75} />
              <span>{m.landing_cp_verify()}</span>
              <em>{m.landing_cp_verify_tag()}</em>
            </p>
          </div>
        </div>
      </div>

      {/* f) seguimento: ligações reais, fora da parte decorativa */}
      <div className="lp-cp-chips lp-cp-a" style={at(T.chips)}>
        {[m.landing_cp_chip_1(), m.landing_cp_chip_2()].map((c) => (
          <Link key={c} to="/register" className="lp-cp-chip">
            {c}
          </Link>
        ))}
      </div>

      {/* g) campo de entrada */}
      <div className="lp-cp-foot lp-cp-a" style={at(T.footer)}>
        <Link to="/register" className="lp-cp-composer" aria-label={m.landing_cp_send()}>
          <span>{m.landing_cp_placeholder()}</span>
          <span className="lp-cp-send" aria-hidden="true">
            <ArrowUp className="size-4" strokeWidth={2.25} />
          </span>
        </Link>
        <div className="lp-cp-foot-row">
          <p>{m.landing_cp_note()}</p>
          <button
            type="button"
            className="lp-cp-replay lp-cp-a"
            style={at(T.footer + 0.2)}
            onClick={replay}
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget) setPlay('done');
            }}
          >
            <RotateCcw className="size-3.5" strokeWidth={2} aria-hidden="true" />
            {m.landing_cp_replay()}
          </button>
        </div>
      </div>

      {/* Transcrição final para leitores de ecrã: anunciada uma vez, quando a conversa termina. */}
      <div aria-live="polite" className="sr-only">
        {play === 'done' && (
          <>
            <p>
              {m.landing_cp_user()}: {question}
            </p>
            <ol aria-label={m.landing_cp_steps()}>
              {steps.map((st) => (
                <li key={st.label}>{st.label}</li>
              ))}
            </ol>
            <p>{answer.replaceAll('**', '')}</p>
            <p>
              {m.landing_cp_card_title()} ({m.landing_cp_estimate()}): {m.landing_cp_kpi_cost()}{' '}
              {costNow}, {m.landing_cp_kpi_delta({ value: delta })}; {m.landing_cp_kpi_eurt()}{' '}
              {eurT}; {m.landing_cp_kpi_range()} {range}. {m.landing_cp_calc()}.
            </p>
            <p>{m.landing_cp_verify()}</p>
          </>
        )}
      </div>
    </figure>
  );
}
