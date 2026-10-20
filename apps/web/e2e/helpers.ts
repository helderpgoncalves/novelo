import { existsSync, readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { type APIRequestContext, expect, type Page, request } from '@playwright/test';

export const ADMIN = { email: 'admin@heldergoncalves.io', password: 'admin-novelo-dev-1' };
export const PASSWORD = 'uma-password-segura-123';

export const uniqueEmail = (prefix: string) =>
  `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@example.pt`;

/** Sessão do admin guardada por `global-setup.ts` (só o cookie de acesso; o de renovação nunca é partilhado). */
export const ADMIN_SESSION_FILE = 'node_modules/.cache/e2e-admin-session.json';
const SESSION_MAX_AGE_MS = 10 * 60_000; // o cookie de acesso dura 15 min

async function restoreAdminSession(page: Page): Promise<boolean> {
  if (process.env.E2E_FRESH_LOGIN || !existsSync(ADMIN_SESSION_FILE)) return false;
  try {
    const saved = JSON.parse(readFileSync(ADMIN_SESSION_FILE, 'utf8')) as {
      savedAt: number;
      cookies: Parameters<ReturnType<Page['context']>['addCookies']>[0];
    };
    if (Date.now() - saved.savedAt > SESSION_MAX_AGE_MS) return false;
    await page.context().addCookies(saved.cookies);
    await page.goto('/pt/');
    await expect(page.locator('#content h1').first()).toBeVisible({ timeout: 8_000 });
    return !/\/login/.test(page.url());
  } catch {
    await page.context().clearCookies();
    return false;
  }
}

export async function login(page: Page, credentials = ADMIN) {
  // O admin reutiliza a sessão criada uma vez no global-setup (poupa o formulário e o argon2 a cada teste).
  if (credentials === ADMIN && (await restoreAdminSession(page))) return;
  await page.goto('/pt/login?method=password');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pt\/?$/);
  // Espera pelo conteúdo: antes disso o layout ainda está a ser montado e os cliques perdem-se.
  await expect(page.locator('#content h1').first()).toBeVisible();
}

/** Último email enviado a um endereço (caixa de saída de desenvolvimento da API). */
export async function lastEmail(to: string): Promise<{ subject: string; text: string }> {
  const api = await request.newContext({
    baseURL: process.env.E2E_API_URL ?? 'http://localhost:8190',
  });
  for (let i = 0; i < 20; i++) {
    const res = await api.get('/api/v1/dev/emails', { params: { to } });
    const emails = (await res.json()) as { subject: string; text: string }[];
    if (emails[0]) return emails[0];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Nenhum email para ${to}`);
}

export const linkFrom = (text: string): string => {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) throw new Error('Sem link no email');
  return match[0];
};

/** Lê um ficheiro de dentro de um ZIP (XLSX): suficiente para verificar o conteúdo descarregado. */
export function readZipEntry(zip: Buffer, name: string): string | null {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return null;
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(offset + 10);
    const packed = zip.readUInt32LE(offset + 20);
    const nameLen = zip.readUInt16LE(offset + 28);
    const extraLen = zip.readUInt16LE(offset + 30);
    const commentLen = zip.readUInt16LE(offset + 32);
    const local = zip.readUInt32LE(offset + 42);
    const entry = zip.subarray(offset + 46, offset + 46 + nameLen).toString('utf8');
    if (entry === name) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const body = zip.subarray(start, start + packed);
      return (method === 8 ? inflateRawSync(body) : body).toString('utf8');
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

// --- contas: registo, aprovação e convites via API ------------------------------------------------------

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8190';
// Chave de teste da Cloudflare: o dev aceita qualquer token com o secret de teste.
const TURNSTILE = { 'X-Turnstile-Token': 'XXXX.DUMMY.TOKEN.XXXX' };

/** Cliente da API autenticado como administrador (reutiliza o cookie do global-setup; senão faz login). */
export async function adminApi(): Promise<APIRequestContext> {
  if (!process.env.E2E_FRESH_LOGIN && existsSync(ADMIN_SESSION_FILE)) {
    try {
      const saved = JSON.parse(readFileSync(ADMIN_SESSION_FILE, 'utf8')) as {
        savedAt: number;
        cookies: { name: string; value: string; domain: string; path: string }[];
      };
      if (Date.now() - saved.savedAt < SESSION_MAX_AGE_MS) {
        const ctx = await request.newContext({
          baseURL: API_URL,
          storageState: {
            cookies: saved.cookies.map((c) => ({
              ...c,
              domain: 'localhost',
              path: '/',
              expires: -1,
              httpOnly: true,
              secure: false,
              sameSite: 'Lax' as const,
            })),
            origins: [],
          },
        });
        if ((await ctx.get('/api/v1/auth/me')).ok()) return ctx;
        await ctx.dispose();
      }
    } catch {
      // cai no login normal
    }
  }
  const ctx = await request.newContext({ baseURL: API_URL });
  const res = await ctx.post('/api/v1/auth/login', { data: ADMIN, headers: TURNSTILE });
  expect(res.ok(), 'login do administrador via API').toBeTruthy();
  return ctx;
}

export type UserRow = {
  id: string;
  email: string;
  role: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  is_active: boolean;
};

export async function findUser(
  admin: APIRequestContext,
  email: string,
): Promise<UserRow | undefined> {
  const res = await admin.get('/api/v1/users');
  const users = (await res.json()) as UserRow[];
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

/** Aprova uma conta pendente (como um administrador faria em /users), sem email. */
export async function approveByEmail(
  email: string,
  role: 'operator' | 'admin' | 'guest' = 'operator',
) {
  const admin = await adminApi();
  try {
    const user = await findUser(admin, email);
    expect(user, `conta ${email} existe`).toBeTruthy();
    const res = await admin.post(`/api/v1/users/${user?.id}/approve`, {
      data: { role, notify: false, confirm_admin: role === 'admin' },
    });
    expect(res.ok(), 'aprovar a conta').toBeTruthy();
  } finally {
    await admin.dispose();
  }
}

/** Regista uma conta pela API (fica por aprovar) e devolve-a já aprovada, pronta a entrar. */
export async function createApprovedUser(
  email: string,
  options: { name?: string; password?: string; role?: 'operator' | 'admin' | 'guest' } = {},
) {
  const api = await request.newContext({ baseURL: API_URL });
  const res = await api.post('/api/v1/auth/register', {
    data: {
      email,
      password: options.password ?? PASSWORD,
      name: options.name ?? 'Teste E2E',
      locale: 'pt-PT',
    },
    headers: TURNSTILE,
  });
  expect(res.ok(), 'registar a conta').toBeTruthy();
  await api.dispose();
  await approveByEmail(email, options.role);
  return { email, password: options.password ?? PASSWORD };
}

/** Elimina uma conta de teste (limpeza); ignora se já não existe. */
export async function deleteByEmail(email: string) {
  const admin = await adminApi();
  try {
    const user = await findUser(admin, email);
    if (user) await admin.delete(`/api/v1/users/${user.id}`, { data: { confirm_email: email } });
  } finally {
    await admin.dispose();
  }
}
