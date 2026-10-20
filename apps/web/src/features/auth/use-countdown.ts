import { useEffect, useState } from 'react';
import { secondsLeft } from './passwordless';

/** Segundos que faltam desde `sentAt` (ms); atualiza a cada segundo e pára em zero. */
export function useCountdown(sentAt: number, cooldown?: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (secondsLeft(sentAt, t, cooldown) === 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [sentAt, cooldown]);
  return secondsLeft(sentAt, now, cooldown);
}
