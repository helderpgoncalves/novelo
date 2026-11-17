// Sincronização em fundo da fila da viatura (#58) — carregado pelo service worker gerado
// (workbox.importScripts em vite.config.ts). O tag é registado pela app em
// `src/features/viatura/outbox/sync-trigger.ts`; o esvaziamento corre na janela aberta (a lógica
// vive na app, em `outbox/flush.ts`) — o worker só acorda quem está a ouvir.
self.addEventListener('sync', (event) => {
  if (event.tag !== 'novelo-outbox') return;
  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then((clients) =>
        Promise.all(clients.map((client) => client.postMessage({ type: 'novelo-outbox-flush' }))),
      ),
  );
});
