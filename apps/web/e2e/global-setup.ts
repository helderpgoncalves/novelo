import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { type FullConfig, request } from '@playwright/test';
import { ADMIN, ADMIN_SESSION_FILE } from './helpers';

// Um único login do admin por execução. Guarda só o cookie de acesso (15 min): o de renovação rodaria
// se fosse partilhado por vários workers. Se falhar (API em baixo, captcha), cada teste faz o login normal.
export default async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use.baseURL ?? process.env.E2E_BASE_URL ?? 'http://localhost:3190';
  const api = await request.newContext({ baseURL });
  try {
    const res = await api.post('/api/v1/auth/login', {
      data: ADMIN,
      // Chave de teste da Cloudflare: o dev aceita qualquer token com o secret de teste.
      headers: { 'X-Turnstile-Token': 'XXXX.DUMMY.TOKEN.XXXX' },
    });
    if (!res.ok()) return;
    const { cookies } = await api.storageState();
    mkdirSync(dirname(ADMIN_SESSION_FILE), { recursive: true });
    writeFileSync(
      ADMIN_SESSION_FILE,
      JSON.stringify({
        savedAt: Date.now(),
        cookies: cookies.filter((c) => c.name === 'access_token'),
      }),
    );
  } catch {
    // sem stack a correr: os testes falham com a mensagem normal
  } finally {
    await api.dispose();
  }
}
