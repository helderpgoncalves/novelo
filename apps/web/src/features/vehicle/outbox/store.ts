/** Persistência da fila em IndexedDB (o dispositivo aguenta fechar a app, a rede não).
 *
 * Costura fina, sem dependências: um object store com as operações; o ecrã substitui tudo a cada mudança
 * (dezenas de operações por dia). A lógica vive no reducer (`queue.ts`) — aqui só I/O.
 */
import type { StopOp } from './queue';

const DB_NAME = 'novelo-viatura';
const DB_VERSION = 1;
const STORE = 'ops';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB indisponível'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error ?? new Error('Transação IndexedDB abortada'));
    });
  } finally {
    db.close();
  }
}

/** Todas as operações guardadas (feitas incluídas: o ecrã reconcilia por cima). */
export async function loadOps(): Promise<StopOp[]> {
  if (typeof indexedDB === 'undefined') return [];
  return withStore('readonly', (store) => store.getAll()).then((ops) =>
    (ops as StopOp[]).sort((a, b) => a.at - b.at),
  );
}

/** Substitui o conteúdo da loja pelo estado atual da fila (uma transação; simples e suficiente). */
export async function replaceOps(ops: StopOp[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.clear();
      for (const op of ops) store.put(op);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Transação IndexedDB abortada'));
    });
  } finally {
    db.close();
  }
}
