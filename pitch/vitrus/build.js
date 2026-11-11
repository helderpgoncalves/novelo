'use strict';
/** Constrói pitch/out/novelo-apresentacao-vitrus-completa.pptx e o guião em Markdown (mesma fonte). */
const path = require('node:path');
const L = require('./lib');
const SK = '/Users/hegs/.claude/skills/synced/9d5a91c2-f5f3-49e4-a6da-5caab6be060c_26c569a4-be57-4dd4-96c7-e02828e972f6/pptx';
const { applyTheme } = require(path.join(SK, 'scripts/apply_theme.js'));
const parts = ['./c1', './c2', './c3', './c4', './c5'].filter((p) => { try { require.resolve(p); return true; } catch { return false; } });
for (const p of parts) require(p)();
const out = path.join(__dirname, '../out/novelo-apresentacao-vitrus-completa.pptx');
(async () => {
  await L.pres.writeFile({ fileName: out });
  await applyTheme(out, L.THEME);
  require('fs').writeFileSync(path.join(__dirname, 'guiao.json'), JSON.stringify(L.GUIAO, null, 1));
  console.log('ok', out, L.GUIAO.length, 'diapositivos');
})();
