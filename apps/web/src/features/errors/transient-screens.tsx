import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';
import { ErrorScreen } from './error-screen';
import { useRecovery } from './use-recovery';

interface Props {
  /** Chamado quando a API volta a responder (ex.: repetir o carregamento da rota). */
  onRecover: () => void;
  layout?: 'page' | 'panel';
}

function RecoveryStatus({
  r,
  showAttempt = false,
}: {
  r: ReturnType<typeof useRecovery>;
  showAttempt?: boolean;
}) {
  return (
    <>
      {/* A contagem muda todos os segundos: fica fora do leitor de ecrã, que só ouve as tentativas. */}
      <p aria-hidden="true" className="text-xs tabular-nums">
        {r.checking ? m.err_retrying() : m.err_next_try({ seconds: String(r.secondsLeft) })}
        {showAttempt && r.attempt > 0 && (
          <span className="lowercase"> · {m.err_maint_attempt({ n: String(r.attempt + 1) })}</span>
        )}
      </p>
      <p role="status" className="sr-only">
        {r.checking ? m.err_retrying() : ''}
        {showAttempt && r.attempt > 0
          ? ` ${m.err_maint_attempt({ n: String(r.attempt + 1) })}`
          : ''}
      </p>
    </>
  );
}

function Actions({ r }: { r: ReturnType<typeof useRecovery> }) {
  return (
    <Button className="h-11" onClick={r.retryNow} disabled={r.checking} loading={r.checking}>
      {m.err_try_now()}
    </Button>
  );
}

/** Sem rede: reintenta sozinho (e logo que o browser avisa que voltou), sem recarregar a página. */
export function OfflineScreen({ onRecover, layout = 'panel' }: Props) {
  const r = useRecovery(onRecover);
  // `navigator.onLine` verdadeiro com a API muda: o problema não é a rede da pessoa, e o texto di-lo.
  const reachable = typeof navigator !== 'undefined' && navigator.onLine;
  return (
    <ErrorScreen
      layout={layout}
      eyebrow={m.err_offline_eyebrow()}
      title={reachable ? m.err_unreachable_title() : m.err_offline_title()}
      actions={<Actions r={r} />}
    >
      <p>{reachable ? m.err_unreachable_text() : m.err_offline_text()}</p>
      <RecoveryStatus r={r} />
    </ErrorScreen>
  );
}

/** API a reiniciar (redeploy): "a atualizar, volta já", com contagem e tentativas automáticas. */
export function MaintenanceScreen({ onRecover, layout = 'panel' }: Props) {
  const r = useRecovery(onRecover);
  return (
    <ErrorScreen
      layout={layout}
      eyebrow={m.err_maint_eyebrow()}
      title={m.err_maint_title()}
      actions={<Actions r={r} />}
    >
      <p>{m.err_maint_text()}</p>
      <RecoveryStatus r={r} showAttempt />
    </ErrorScreen>
  );
}
