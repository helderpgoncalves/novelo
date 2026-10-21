import { useEffect, useState } from 'react';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

/** 17 de abril de 2028 (Diretiva (UE) 2025/1892): a meia-noite local do dia do prazo. */
const DEADLINE = new Date(2028, 3, 17);
const DAY_MS = 86_400_000;

/** Dias que faltam até ao prazo (0 se já passou). Só corre no cliente: o HTML pré-renderizado leva apenas a data. */
export function daysUntilDeadline(now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((DEADLINE.getTime() - today.getTime()) / DAY_MS));
}

/**
 * Gancho de urgência: a data do prazo do regime europeu de responsabilidade do produtor têxtil e, só no cliente, a
 * contagem de dias. O que faltar de data nunca é inventado: vem da diretiva citada no texto «O problema».
 */
export function HeroDeadline({ className }: { className?: string }) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const left = daysUntilDeadline();
    setDays(left > 0 ? left : null);
  }, []);
  return (
    <p className={`lp-hs-deadline ${className ?? ''}`}>
      <time dateTime="2028-04-17" className="lp-hs-deadline-date">
        {m.landing_hero_deadline_date()}
      </time>
      <span className="lp-hs-deadline-text">{m.landing_hero_deadline_text()}</span>
      <span className="lp-hs-deadline-days" data-ready={days !== null}>
        {days !== null && m.landing_hero_deadline_days({ days: formatNumber(days) })}
      </span>
    </p>
  );
}
