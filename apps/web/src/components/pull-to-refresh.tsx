import type { RefObject } from 'react';
import { toast } from 'sonner';
import { BrandPullSymbol } from '@/components/brand-logo';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { getErrorMessage } from '@/lib/errors';
import { queryClient } from '@/lib/query-client';
import { m } from '@/paraglide/messages';

/**
 * Atualiza o que está no ecrã: as queries ativas voltam a pedir dados (as restantes ficam marcadas como
 * desatualizadas para a próxima visita). Os loaders das rotas só leem a cache (`ensureQueryData`), por isso
 * não é preciso invalidar o router.
 */
async function refreshActive(): Promise<void> {
  await queryClient.invalidateQueries({ refetchType: 'none' });
  await queryClient.refetchQueries({ type: 'active' }, { throwOnError: true });
}

/**
 * Puxar para atualizar (telemóvel e tablet): o símbolo da marca aparece por cima do conteúdo, os arcos rodam com o
 * dedo e, ao largar para lá do limiar, giram como o `BrandSpinner` até os dados chegarem. Também tem uma
 * alternativa sem gesto (botão que só se vê com o foco do teclado) e uma região `aria-live` para leitores de ecrã.
 * Desligado em rotas de ecrã inteiro (mapa, copiloto) e com movimento reduzido (aí fica só o botão e o estado).
 */
export function PullToRefresh({
  scrollRef,
  disabled = false,
}: {
  scrollRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
}) {
  const { clipRef, phase, trigger } = usePullToRefresh({
    scrollRef,
    disabled,
    refresh: refreshActive,
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  if (disabled) return null;

  return (
    <>
      <div ref={clipRef} className="ptr-clip" data-state="idle" aria-hidden="true">
        <div className="ptr">
          <BrandPullSymbol className="ptr-svg" />
        </div>
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {phase === 'refreshing' ? m.ptr_refreshing() : phase === 'done' ? m.ptr_done() : ''}
      </div>
      <button
        type="button"
        onClick={trigger}
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus-visible:not-sr-only focus-visible:fixed focus-visible:top-[calc(env(safe-area-inset-top)+0.5rem)] focus-visible:right-[calc(env(safe-area-inset-right)+0.5rem)]"
      >
        {m.ptr_refresh()}
      </button>
    </>
  );
}
