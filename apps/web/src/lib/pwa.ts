import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';
import { hasSessionHint, SESSION_EVENT } from '@/lib/session-hint';
import { m } from '@/paraglide/messages';

const UPDATE_CHECK_MS = 60 * 60 * 1000;
const UPDATE_TOAST_ID = 'pwa-update';

let started = false;

/** Visitante sem sessão: não precisa de service worker (a landing vem sempre fresca da rede). Retira o que houver. */
function retireServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  void navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .then(() => caches.keys())
    .then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('workbox-')).map((k) => caches.delete(k))),
    )
    .catch(() => undefined);
}

/**
 * Regista o service worker SÓ para quem tem sessão (a app instalada e o uso offline), e só quando o browser está
 * livre: quem apenas vê a landing não descarrega o precache nem fica preso a uma versão antiga da casca depois de
 * cada atualização. Quando há versão nova mostra um aviso fixo com "Atualizar" (a app só recarrega por vontade da
 * pessoa) e volta a procurar versões de hora a hora e sempre que a app regressa ao primeiro plano.
 */
export function registerPwa() {
  if (!hasSessionHint()) {
    retireServiceWorker();
    // Quando a pessoa entrar, o login avisa e o service worker regista-se nessa altura.
    window.addEventListener(SESSION_EVENT, registerPwa, { once: true });
    return;
  }
  if (started) return;
  started = true;
  const start = () => startServiceWorker();
  if (typeof window.requestIdleCallback === 'function')
    window.requestIdleCallback(start, { timeout: 5000 });
  else window.setTimeout(start, 2000);
}

function startServiceWorker() {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast(m.pwa_update_title(), {
        id: UPDATE_TOAST_ID,
        description: m.pwa_update_text(),
        duration: Number.POSITIVE_INFINITY,
        action: { label: m.pwa_update_action(), onClick: () => void updateSW(true) },
      });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => undefined);
      };
      window.setInterval(check, UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

/** Guarda o `beforeinstallprompt` logo no arranque: o evento dispara cedo, antes de o menu existir. */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

export const subscribeInstall = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getInstallEvent = () => deferred;

export async function promptInstall() {
  const event = deferred;
  if (!event) return;
  deferred = null;
  emit();
  await event.prompt();
}

/** Já está a correr como app instalada (Android/desktop `display-mode`, iOS `navigator.standalone`). */
export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: minimal-ui)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone/iPad (incluindo iPadOS, que se apresenta como Mac com ecrã tátil). */
export const isIosDevice = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
