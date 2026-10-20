import { useSyncExternalStore } from 'react';
import {
  getInstallEvent,
  isIosDevice,
  isStandalone,
  promptInstall,
  subscribeInstall,
} from '@/lib/pwa';

/**
 * Instalar o Novelo como app:
 * - `canInstall`: o browser (Chrome/Edge/Android) ofereceu o diálogo nativo;
 * - `needsIosSteps`: iPhone/iPad, onde não há diálogo e é preciso "Adicionar ao ecrã principal";
 * - `installed`: já corre instalada, não se oferece nada.
 */
export function useInstallPrompt() {
  const event = useSyncExternalStore(subscribeInstall, getInstallEvent, () => null);
  const installed = isStandalone();
  return {
    installed,
    canInstall: !installed && event !== null,
    needsIosSteps: !installed && event === null && isIosDevice(),
    install: promptInstall,
  };
}
