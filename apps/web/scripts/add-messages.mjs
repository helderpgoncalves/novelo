// Junta mensagens novas a messages/pt-PT.json e messages/en.json e recompila o Paraglide.
// Uso: node scripts/add-messages.mjs <ficheiro.json>   com { "chave": ["texto pt-PT", "text en"] }
// As chaves existentes não são alteradas (falha se o texto for diferente, para apanhar colisões de nomes).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@inlang/paraglide-js';
import options from '../paraglide.options.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = JSON.parse(readFileSync(resolve(process.argv[2] ?? ''), 'utf8'));
const files = { pt: resolve(root, 'messages/pt-PT.json'), en: resolve(root, 'messages/en.json') };
const data = { pt: JSON.parse(readFileSync(files.pt, 'utf8')), en: JSON.parse(readFileSync(files.en, 'utf8')) };

let added = 0;
for (const [key, value] of Object.entries(input)) {
  if (!Array.isArray(value) || value.length !== 2) throw new Error(`${key}: esperado [pt, en]`);
  const [pt, en] = value;
  if (key in data.pt) {
    if (data.pt[key] !== pt || data.en[key] !== en) throw new Error(`${key}: já existe com outro texto`);
    continue;
  }
  data.pt[key] = pt;
  data.en[key] = en;
  added += 1;
}
// Relê antes de escrever para minimizar corridas com outro processo.
for (const lang of ['pt', 'en']) {
  const fresh = JSON.parse(readFileSync(files[lang], 'utf8'));
  writeFileSync(files[lang], `${JSON.stringify({ ...fresh, ...Object.fromEntries(Object.keys(input).map((k) => [k, data[lang][k]])) }, null, 2)}\n`);
}
await compile(options);
console.log(`${added} mensagens novas`);
