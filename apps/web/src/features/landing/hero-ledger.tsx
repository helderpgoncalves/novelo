import { ArrowRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { FACTS } from './facts';
import { HeroCount } from './hero-count';
import { GAP_T } from './hero-fio-model';
import { Estimate, statusLabel } from './layout';

const approxT = (n: number) => `≈ ${formatNumber(Math.round(n))} t`;
const tonnesOne = (n: number) => formatTonnes(n);
/** Momento (ms) em que cada linha assenta; o número conta a partir daí. Alinhado com o fio, que se desenha em 1,4 s. */
const AT = [380, 520, 760] as const;
const row = (i: number) => ({ '--i': i }) as CSSProperties;

/**
 * Livro-razão do hero: os três números do problema num painel no fluxo do texto (nunca por cima da fotografia, nunca preso
 * à geometria do campanário). Gerado (estimativa), recolhido à parte em 2025 (medido) com o fio em miniatura a 11,5 %, e o
 * que ainda vai para o lixo em destaque, com a ligação para o mapa. Fonte por baixo. Os valores finais estão sempre no HTML
 * (o contado é `aria-hidden`); a entrada é só opacidade e transform.
 */
export function HeroLedger() {
  const pct = formatPercent(FACTS.capturePct);
  return (
    <aside aria-labelledby="hs-ledger-title" className="lp-hsl">
      <p id="hs-ledger-title" className="lp-hsl-kicker lp-hsl-in" style={row(0)}>
        {m.landing_hero_ledger_title()}
      </p>
      <dl className="lp-hsl-list">
        <div className="lp-hsl-row lp-hsl-in" style={row(1)}>
          <dt className="lp-hsl-label">
            {m.landing_hero_ledger_generated()}
            <Estimate className="lp-hsl-tag" />
          </dt>
          <dd className="lp-hsl-v">
            <HeroCount value={FACTS.potentialT} format={approxT} delay={AT[0]} />
          </dd>
        </div>
        <div className="lp-hsl-row lp-hsl-in" style={row(2)}>
          <dt className="lp-hsl-label">
            {m.landing_hero_ledger_collected()}
            <span className="lp-hsl-tag" data-k="measured">
              {statusLabel('measured')}
            </span>
          </dt>
          <dd className="lp-hsl-v">
            <HeroCount value={FACTS.collectedT} format={tonnesOne} delay={AT[1]} />
          </dd>
          <dd className="lp-hsl-bar">
            <span
              role="img"
              aria-label={m.landing_hero_ledger_share({ pct })}
              className="lp-hsl-track"
              style={{ '--p': FACTS.capturePct / 100 } as CSSProperties}
            >
              <span className="lp-hsl-dash" />
              <span className="lp-hsl-solid" />
              <span className="lp-hsl-knot" />
              <svg className="lp-hsl-fray" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M1 12C6 11.5 8 7 13 6S20 3.5 23 1" />
                <path d="M1 12C7 12.5 11 10.5 15.5 11S20 13 23 16.5" />
                <path d="M1 12C5 14.5 6 18 9.5 20S15.5 22 18 23" />
              </svg>
            </span>
            <span aria-hidden="true" className="lp-hsl-share">
              {m.landing_hero_ledger_share({ pct })}
            </span>
          </dd>
        </div>
        <div className="lp-hsl-row lp-hsl-in" data-k="gap" style={row(3)}>
          <dt className="lp-hsl-label">
            {m.landing_hero_ledger_gap()}
            <Estimate className="lp-hsl-tag" />
          </dt>
          <dd className="lp-hsl-v">
            <HeroCount value={GAP_T} format={approxT} delay={AT[2]} duration={1400} />
          </dd>
        </div>
      </dl>
      <div className="lp-hsl-foot lp-hsl-in" style={row(4)}>
        <a href="#mapa" className="lp-hsl-hook">
          {m.landing_hero_ledger_hook()}
          <ArrowRight aria-hidden="true" className="size-4" />
        </a>
        <p className="lp-hsl-src">
          {m.landing_hero_ledger_source({
            rsu: formatTonnes(FACTS.rsuT, 0),
            share: formatPercent(FACTS.textileShareOfRsuPct),
          })}
        </p>
      </div>
    </aside>
  );
}
