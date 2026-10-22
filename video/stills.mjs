// Fotogramas de revisão: node stills.mjs Landscape 100,260,... → out/stills/
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const [id = 'Landscape', list = '100'] = process.argv.slice(2);
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id, browserExecutable });
mkdirSync('out/stills', { recursive: true });
for (const frame of list.split(',').map(Number)) {
  const output = `out/stills/${id}-${String(frame).padStart(4, '0')}.jpg`;
  await renderStill({ composition, serveUrl, frame, output, browserExecutable, imageFormat: 'jpeg', jpegQuality: 80, scale: 0.5 });
  console.log(output);
}
