import { inflateRawSync } from 'node:zlib';
import { expect, type Page, request } from '@playwright/test';

export const ADMIN = { email: 'admin@heldergoncalves.io', password: 'admin-novelo-dev-1' };
export const PASSWORD = 'uma-password-segura-123';

export const uniqueEmail = (prefix: string) =>
  `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@example.pt`;

export async function login(page: Page, credentials = ADMIN) {
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
