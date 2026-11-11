#!/usr/bin/env node
/** Ícones Lucide (da app web) em PNG nas cores da marca: pitch/vitrus/img/ic-<nome>-<cor>.png */
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const webReq = createRequire(path.join(__dirname, '../../apps/web/package.json'));
const React = webReq('react');
const { renderToStaticMarkup } = webReq('react-dom/server');
const L = webReq('lucide-react');
const sharp = createRequire(path.join(__dirname, '../package.json'))('sharp');
const OUT = path.join(__dirname, 'img');
const COLORS = { f: '#2E6B57', w: '#F4F1EA', a: '#C4A06A', t: '#14211D' };
const NAMES = ['Truck','MapPin','Route','Camera','QrCode','FileText','Scale','Euro','Recycle','Leaf','School','Building2','ShieldCheck','Database','BrainCircuit','Server','Users','Clock','CalendarCheck','TriangleAlert','CircleCheck','Search','Layers','ChartColumn','Package','Shirt','Factory','Landmark','Hotel','Handshake','GitBranch','Lock','Gauge','Calculator','Map','ListChecks','Smartphone','Globe','Target','Ruler','Shuffle','Wrench','BookOpen','MessageSquare','Eye','Trash2','Home','Send','CircleHelp','Flag','Repeat','ClipboardCheck','Coins','Hourglass','Link2','Code','Cpu','ArrowRight'];
(async () => {
  let ok = 0;
  for (const n of NAMES) {
    const Icon = L[n];
    if (!Icon) { console.log('sem ícone', n); continue; }
    for (const [k, c] of Object.entries(COLORS)) {
      const svg = renderToStaticMarkup(React.createElement(Icon, { color: c, size: 256, strokeWidth: 1.6 }));
      await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `ic-${n}-${k}.png`));
    }
    ok++;
  }
  console.log('ícones', ok);
})();
