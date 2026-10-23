// Render final: node render.mjs [Landscape|Portrait|all] [--silent]
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const arg = process.argv[2] ?? 'all';
const silent = process.argv.includes('--silent');

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
mkdirSync('out', { recursive: true });
const browserExecutable = process.env.BROWSER ?? null; // por omissão o Remotion usa o seu Chrome headless
const NAMES = { Landscape: 'novelo-16x9', Portrait: 'novelo-9x16' };
for (const id of arg === 'all' ? ['Landscape', 'Portrait'] : [arg]) {
  const inputProps = { music: !silent };
  const composition = await selectComposition({ serveUrl, id, browserExecutable, inputProps });
  const out = `out/${NAMES[id]}${silent ? '-sem-som' : ''}.mp4`;
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    crf: 16,
    pixelFormat: 'yuv420p',
    audioBitrate: '192k',
    outputLocation: out,
    inputProps,
    browserExecutable,
    concurrency: 3,
    imageFormat: 'jpeg',
    jpegQuality: 92,
    muted: silent,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 20);
      if (p !== last) { last = p; console.log(id, `${p * 5}%`); }
    },
  });
  console.log('done', out);
}
