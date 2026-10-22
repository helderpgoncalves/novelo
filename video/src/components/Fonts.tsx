import { useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

const FACES: Array<[string, string, string, string?]> = [
  ['Newsreader', 'newsreader-latin-standard-normal.woff2', 'normal'],
  ['Newsreader', 'newsreader-latin-ext-standard-normal.woff2', 'normal', 'U+0100-024F,U+1E00-1EFF,U+20AC'],
  ['Newsreader', 'newsreader-latin-standard-italic.woff2', 'italic'],
  ['Inter', 'inter-latin-standard-normal.woff2', 'normal'],
  ['Inter', 'inter-latin-ext-standard-normal.woff2', 'normal', 'U+0100-024F,U+1E00-1EFF,U+20AC'],
];

let loading: Promise<unknown> | null = null;

/** Carrega as fontes da marca (brand/fontes) antes do primeiro fotograma. */
export function useBrandFonts() {
  const [handle] = useState(() => delayRender('fontes'));
  if (!loading) {
    loading = Promise.all(
      FACES.map(async ([family, file, style, range]) => {
        const face = new FontFace(family, `url(${staticFile(`brand/${file}`)}) format('woff2')`, {
          style,
          weight: '100 900',
          ...(range ? { unicodeRange: range } : {}),
        });
        await face.load();
        document.fonts.add(face);
      }),
    );
  }
  loading.then(() => continueRender(handle)).catch((e) => {
    console.error(e);
    continueRender(handle);
  });
}
