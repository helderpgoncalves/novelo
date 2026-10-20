// Compila messages/*.json para src/paraglide com as mesmas opções do plugin do Vite.
// Só recompila se as mensagens, as opções ou a versão do Paraglide mudaram (carimbo em src/paraglide/.stamp):
// poupa ~7 s a cada `typecheck`/`test`. `pnpm i18n --force` obriga a recompilar.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import options from '../paraglide.options.mjs';

const read = (path) => (existsSync(path) ? readFileSync(path) : '');
const hash = createHash('sha1');
for (const file of readdirSync('messages').sort()) hash.update(file).update(read(`messages/${file}`));
hash.update(read('project.inlang/settings.json'));
hash.update(read('paraglide.options.mjs'));
hash.update(read('node_modules/@inlang/paraglide-js/package.json'));
const stamp = hash.digest('hex');
const stampFile = `${options.outdir}/.stamp`;

if (
  !process.argv.includes('--force') &&
  existsSync(`${options.outdir}/messages.js`) &&
  read(stampFile).toString() === stamp
) {
  console.log('i18n: mensagens sem alterações, nada a compilar');
} else {
  const { compile } = await import('@inlang/paraglide-js');
  await compile(options);
  writeFileSync(stampFile, stamp);
}
