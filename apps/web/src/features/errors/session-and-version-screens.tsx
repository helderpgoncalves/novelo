import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';
import { ErrorScreen } from './error-screen';

const RELOAD_KEY = 'novelo:chunk-reload';

/** Marca o recarregamento para, se o erro voltar logo a seguir, avisarmos que o deploy pode ainda estar a acabar. */
export function reloadForNewVersion() {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage indisponível (modo privado): recarrega na mesma.
  }
  window.location.reload();
}

const reloadedRecently = () => {
  try {
    return Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) < 60_000;
  } catch {
    return false;
  }
};

/** ChunkLoadError depois de um deploy novo: a única cura é carregar a versão nova. */
export function NewVersionScreen({ layout = 'panel' }: { layout?: 'page' | 'panel' }) {
  return (
    <ErrorScreen
      layout={layout}
      eyebrow={m.err_chunk_eyebrow()}
      title={m.err_chunk_title()}
      actions={
        <Button className="h-11" onClick={reloadForNewVersion}>
          {m.err_chunk_reload()}
        </Button>
      }
    >
      <p>{m.err_chunk_text()}</p>
      {reloadedRecently() && <p className="text-xs">{m.err_chunk_again()}</p>}
    </ErrorScreen>
  );
}

/** Sessão terminada: leva ao login guardando a página atual para voltar a ela depois de entrar. */
export function SessionExpiredScreen({ layout = 'panel' }: { layout?: 'page' | 'panel' }) {
  const navigate = useNavigate();
  const next = useRouterState({ select: (s) => s.location.href });
  const login = () =>
    void navigate({ to: '/login', search: { next, reason: 'expired' }, replace: true });
  // Sem ação da pessoa também: a sessão já acabou, esperar só atrasa.
  // biome-ignore lint/correctness/useExhaustiveDependencies: redireciona uma vez, à entrada.
  useEffect(() => {
    const id = window.setTimeout(login, 2500);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <ErrorScreen
      layout={layout}
      eyebrow={m.err_session_eyebrow()}
      title={m.err_session_title()}
      actions={
        <Button className="h-11" onClick={login}>
          {m.err_session_login()}
        </Button>
      }
    >
      <p>{m.err_session_text()}</p>
    </ErrorScreen>
  );
}
