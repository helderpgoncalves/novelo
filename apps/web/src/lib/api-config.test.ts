import { afterEach, describe, expect, it, vi } from 'vitest';
import { authFetch, getLastApiFailure } from './api-config';

afterEach(() => vi.unstubAllGlobals());

const stub = (res: Response) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));

describe('authFetch: erros do proxy', () => {
  it('um 502 em HTML (API a reiniciar) passa a service_unavailable tipado', async () => {
    stub(
      new Response('<html>Bad Gateway</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      }),
    );
    const res = await authFetch('/api/v1/network/fleet');
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: 'service_unavailable' });
  });

  it('um 503 JSON da nossa API (ex.: IA desligada) não é tocado', async () => {
    stub(
      new Response(JSON.stringify({ code: 'feature_disabled', message: 'x' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const res = await authFetch('/api/v1/copilot/stream');
    expect(await res.json()).toMatchObject({ code: 'feature_disabled' });
  });

  it('guarda o x-request-id do último pedido falhado para o ecrã de erro', async () => {
    stub(
      new Response('{}', {
        status: 500,
        headers: { 'content-type': 'application/json', 'x-request-id': 'req-abc' },
      }),
    );
    await authFetch('/api/v1/network/fleet');
    expect(getLastApiFailure()).toMatchObject({ status: 500, requestId: 'req-abc' });
  });
});

describe('authFetch: contas por aprovar e impersonação', () => {
  const forbidden = (code: string) =>
    new Response(JSON.stringify({ code, message: 'x' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  const listen = (name: string) => {
    const calls: unknown[] = [];
    const handler = (e: Event) => calls.push((e as CustomEvent).detail ?? true);
    window.addEventListener(name, handler);
    return { calls, stop: () => window.removeEventListener(name, handler) };
  };

  it('403 account_pending avisa a app e deixa o corpo intacto para o cliente', async () => {
    stub(forbidden('account_pending'));
    const seen = listen('novelo:approval-blocked');
    const res = await authFetch('/api/v1/network/fleet');
    seen.stop();
    expect(seen.calls).toEqual(['account_pending']);
    expect(await res.json()).toMatchObject({ code: 'account_pending' });
  });

  it('403 account_rejected leva o código da variante rejeitada', async () => {
    stub(forbidden('account_rejected'));
    const seen = listen('novelo:approval-blocked');
    await authFetch('/api/v1/network/fleet');
    seen.stop();
    expect(seen.calls).toEqual(['account_rejected']);
  });

  it('403 impersonation_blocked dispara o aviso global de segurança', async () => {
    stub(forbidden('impersonation_blocked'));
    const seen = listen('novelo:impersonation-blocked');
    await authFetch('/api/v1/auth/change-password');
    seen.stop();
    expect(seen.calls).toHaveLength(1);
  });

  it('um 403 normal (sem papel) não dispara nenhum dos dois', async () => {
    stub(forbidden('forbidden'));
    const approval = listen('novelo:approval-blocked');
    const blocked = listen('novelo:impersonation-blocked');
    await authFetch('/api/v1/users');
    approval.stop();
    blocked.stop();
    expect(approval.calls).toHaveLength(0);
    expect(blocked.calls).toHaveLength(0);
  });
});
