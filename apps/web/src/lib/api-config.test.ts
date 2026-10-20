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
