/** Gatilhos da sincronização: o despejo corre quando a rede volta, o ecrã regressa ou o Background Sync acorda.
 *
 * O tag do Background Sync (`novelo-outbox`) é tratado no service worker (`public/sw-sync.js`), que avisa as
 * janelas abertas; se a API não existir (Safari/iOS), o evento `online` cobre o caso visível. A app exige
 * Android + Chrome na viatura — documentado no ecrã e em `docs/engenharia/features.md` §12.
 */
const SYNC_TAG = 'novelo-outbox';
const FLUSH_MESSAGE = 'novelo-outbox-flush';

async function registerBackgroundSync(): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    // Sem Background Sync (Safari): não é erro — o evento `online` cobre o caso visível.
    const backgroundSync = (
      registration as unknown as { sync?: { register(tag: string): Promise<unknown> } }
    ).sync;
    await backgroundSync?.register(SYNC_TAG);
  } catch {
    // Registo indisponível (primeira visita, SW por atualizar): segue-se com os gatilhos locais.
  }
}

/** Liga os gatilhos e devolve a função de limpeza (para o cleanup do efeito). */
export function initOutboxSync(flush: () => void): () => void {
  const onOnline = () => {
    void registerBackgroundSync();
    flush();
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') flush();
  };
  const onMessage = (event: MessageEvent) => {
    const data: unknown = event.data;
    if (
      typeof data === 'object' &&
      data !== null &&
      'type' in data &&
      (data as { type?: unknown }).type === FLUSH_MESSAGE
    ) {
      flush();
    }
  };

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  navigator.serviceWorker?.addEventListener('message', onMessage);
  void registerBackgroundSync();

  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    navigator.serviceWorker?.removeEventListener('message', onMessage);
  };
}
