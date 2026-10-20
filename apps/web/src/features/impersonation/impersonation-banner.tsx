import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Eye, LogOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { stopImpersonation } from '@/client';
import { getMeOptions } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';
import { announceMark, formatCountdown, secondsUntil } from './countdown';
import { useImpersonation } from './use-impersonation';

// Partilhado pela faixa e pelo menu da conta: só um dos dois termina a sessão, o outro apenas vê o resultado.
let endingNow = false;

/** Termina a impersonação do lado do web: limpa tudo o que era da outra pessoa e volta à administração. */
export function useEndImpersonation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [ending, setEnding] = useState(false);
  const running = useRef(false);

  const end = useCallback(
    async (reason: 'stopped' | 'expired') => {
      if (running.current || endingNow) return;
      running.current = true;
      endingNow = true;
      setEnding(true);
      try {
        // Pede ao servidor para fechar a sessão. Se já expirou, o pedido renova a sessão do administrador sozinho
        // (o cookie de renovação é o dele) e a resposta de "nada para terminar" é irrelevante.
        await stopImpersonation({ throwOnError: false });
        queryClient.clear();
        await queryClient
          .fetchQuery({ ...getMeOptions(), staleTime: 0, retry: false })
          .catch(() => undefined);
        if (reason === 'expired') toast.info(m.imp_ended_toast());
        await navigate({ to: '/users', search: { tab: 'accounts' }, replace: true });
      } finally {
        running.current = false;
        setEnding(false);
        window.setTimeout(() => {
          endingNow = false;
        }, 1500);
      }
    },
    [queryClient, navigate],
  );
  return { end, ending };
}

/**
 * Faixa global, acima de tudo: nunca se esquece que se está a ver como outra pessoa. Contagem decrescente até ao
 * fim fixo da sessão; ao zero volta ao administrador sem ecrã de erro. Anuncia só os marcos (5 min, 1 min, 30 s).
 */
export function ImpersonationBanner({ viewedName }: { viewedName: string }) {
  const imp = useImpersonation();
  const { end, ending } = useEndImpersonation();
  const [now, setNow] = useState(() => Date.now());

  // Se a sessão terminar por outra via (renovação silenciosa, outro separador), `/auth/me` deixa de a mostrar.
  useQuery({
    ...getMeOptions(),
    enabled: imp.active,
    refetchInterval: imp.active ? 60_000 : false,
    staleTime: 0,
    retry: false,
  });
  const wasActive = useRef(imp.active);
  useEffect(() => {
    if (wasActive.current && !imp.active && !endingNow) void end('expired');
    wasActive.current = imp.active;
  }, [imp.active, end]);

  useEffect(() => {
    if (!imp.active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [imp.active]);

  const remaining = secondsUntil(imp.expiresAt, now);
  useEffect(() => {
    if (imp.active && remaining === 0) void end('expired');
  }, [imp.active, remaining, end]);

  const mark = announceMark(remaining);
  if (!imp.active) return null;
  const time = remaining === null ? '--:--' : formatCountdown(remaining);

  return (
    <section
      aria-label={m.imp_region()}
      data-testid="impersonation-banner"
      // Cor fixa da marca (areia sobre tinta): o aviso tem de gritar igual em claro e escuro.
      className="relative z-40 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-[#14211d] border-b-2 bg-areia px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-[#14211d] sm:px-6"
    >
      <Eye className="size-5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm leading-snug">
        <strong className="break-words font-semibold">{m.imp_banner({ name: viewedName })}</strong>
        <span aria-hidden="true">
          {' · '}
          <span className="tabular-nums" data-testid="impersonation-countdown">
            {m.imp_expires({ time })}
          </span>
        </span>
        {imp.adminName && (
          <span className="hidden text-[#14211d]/75 md:inline">
            {' '}
            · {m.imp_admin({ admin: imp.adminName })}
          </span>
        )}
      </p>
      {mark !== null && (
        <span className="sr-only" role="status" aria-live="polite" key={mark}>
          {m.imp_expiring_sr({ time })}
        </span>
      )}
      <Button
        type="button"
        size="sm"
        className="h-10 shrink-0 bg-[#14211d] font-semibold text-areia hover:bg-[#14211d]/90 sm:h-9"
        loading={ending}
        onClick={() => void end('stopped')}
      >
        <LogOut aria-hidden="true" />
        {m.imp_exit()}
      </Button>
    </section>
  );
}
