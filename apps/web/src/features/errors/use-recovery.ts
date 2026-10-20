import { useCallback, useEffect, useRef, useState } from 'react';
import { health } from '@/client';

/** Esperas entre tentativas (s): começa curto, porque um redeploy costuma acabar em segundos. */
const DELAYS_S = [4, 6, 10, 15, 20, 30];

export interface Recovery {
  attempt: number;
  secondsLeft: number;
  checking: boolean;
  /** Tenta já, sem esperar pela contagem. */
  retryNow: () => void;
}

/**
 * Para falhas de infraestrutura (sem rede, API a reiniciar): pergunta à API se já voltou, com contagem
 * visível, e chama `onRecover` quando responde. Também reage ao evento `online` do browser.
 */
export function useRecovery(onRecover: () => void, enabled = true): Recovery {
  const [attempt, setAttempt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(DELAYS_S[0] ?? 4);
  const [checking, setChecking] = useState(false);
  const recover = useRef(onRecover);
  recover.current = onRecover;
  const busy = useRef(false);
  const tries = useRef(0);
  const deadline = useRef(Date.now() + (DELAYS_S[0] ?? 4) * 1000);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    let alive = false;
    try {
      const result = await health({ throwOnError: false });
      alive = result.response?.ok === true;
    } catch {
      alive = false;
    }
    busy.current = false;
    setChecking(false);
    if (alive) {
      recover.current();
      return;
    }
    tries.current += 1;
    const wait = DELAYS_S[Math.min(tries.current, DELAYS_S.length - 1)] ?? 30;
    deadline.current = Date.now() + wait * 1000;
    setAttempt(tries.current);
    setSecondsLeft(wait);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (busy.current) return;
      const left = Math.ceil((deadline.current - Date.now()) / 1000);
      if (left > 0) setSecondsLeft(left);
      else if (!document.hidden) void check();
    }, 1000);
    const onOnline = () => void check();
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('online', onOnline);
    };
  }, [enabled, check]);

  return { attempt, secondsLeft, checking, retryNow: () => void check() };
}
