import { lazy, Suspense, useEffect, useRef } from 'react';
import type { MeOut } from '@/client';
import { STORY_TOTAL } from './story-model';
import {
  canResumeTour,
  consumeTourPending,
  openTour,
  readTourProgress,
  shouldAutoOpenTour,
  useTourState,
} from './tour-store';
import { useOnboarding } from './use-onboarding';

// A apresentação (passos, mapa e dados) só se descarrega quando abre: quem já a viu nunca a paga.
const OnboardingStory = lazy(() => import('./onboarding-story'));
const AUTO_OPEN_DELAY_MS = 700;

/**
 * Abre a apresentação sozinha na primeira entrada de uma conta nova (registo, convite, QR, link por email ou Google),
 * retomando o ponto onde ficou; nunca em impersonação nem para as contas que entram por palavra-passe sem o sinal de
 * registo (o administrador semeado e as contas dos testes, que a pedem com `markTourPending`).
 */
export function OnboardingGate({ user }: { user: MeOut }) {
  const { open } = useTourState();
  const { me } = useOnboarding(user);
  const pendingRef = useRef<boolean | null>(null);
  const autoRef = useRef(false);

  useEffect(() => {
    if (pendingRef.current === null) pendingRef.current = consumeTourPending();
    if (autoRef.current) return;
    if (!shouldAutoOpenTour(me, pendingRef.current)) return;
    const id = window.setTimeout(() => {
      autoRef.current = true;
      openTour(canResumeTour(me.id, STORY_TOTAL) ? readTourProgress(me.id) : 0);
    }, AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [me]);

  // Foco: guardado ao abrir e devolvido ao fechar (o diálogo desmonta-se logo, por isso faz-se aqui). Sem um elemento
  // válido (ex.: abriu sozinha), vai para o conteúdo da página.
  const returnTo = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const active = document.activeElement;
      returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const el = returnTo.current;
    returnTo.current = null;
    const id = window.setTimeout(() => {
      const target = el?.isConnected ? el : document.getElementById('content');
      target?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <OnboardingStory user={user} />
    </Suspense>
  );
}
