import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { m } from '@/paraglide/messages';

/** Avisa quando o dispositivo perde a rede: a app (PWA) continua a abrir, mas os dados precisam de ligação. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-areia/40 border-b bg-areia/15 px-4 py-2 text-sm sm:px-6 lg:px-8"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      {m.offline_banner()}
    </div>
  );
}
