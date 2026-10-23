// Recursos do deck: mapa dos contentores (de video/src/data/geo.json) e recortes das capturas da produção (docs/img).
// Corre com: node assets.js
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');

const V = path.join(__dirname, '../video');
const OUT = path.join(__dirname, 'assets');
fs.mkdirSync(OUT, { recursive: true });
const geo = JSON.parse(fs.readFileSync(path.join(V, 'src/data/geo.json'), 'utf8'));
const C = { linho: '#F4F1EA', tinta: '#14211D', noite: '#0F1815', floresta: '#2E6B57', florestaClara: '#7FB39C', areia: '#C4A06A', pedra: '#5E6B66', linha: '#DCD5C8' };

function mapSvg({ dark, containers, network }) {
  const stroke = dark ? 'rgba(244,241,234,0.5)' : 'rgba(20,33,29,0.45)';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 ${geo.width + 20} ${geo.height + 20}" width="${(geo.width + 20) * 2}" height="${(geo.height + 20) * 2}">`;
  for (const p of geo.parishes) {
    let fill = 'none';
    let op = 0;
    if (network && p.onDemand) { fill = dark ? C.florestaClara : C.floresta; op = 0.85; }
    else if (network && p.existing) { fill = C.areia; op = 0.8; }
    s += `<path d="${p.d}" fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/>`;
  }
  if (containers) {
    for (const [x, y, kind] of geo.containers) {
      const organic = kind.startsWith('organic') || kind === 'green_waste';
      s += `<circle cx="${x}" cy="${y}" r="3" fill="${organic ? (dark ? C.florestaClara : C.floresta) : C.areia}" opacity="0.9"/>`;
    }
  }
  if (network) {
    for (const r of geo.routes) {
      const pts = [geo.depot, ...r.stops, geo.depot].map((q) => q.join(',')).join(' ');
      s += `<polyline points="${pts}" fill="none" stroke="${dark ? C.linho : C.tinta}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>`;
    }
    for (const [x, y] of geo.schools) s += `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" rx="2" fill="${dark ? C.linho : C.tinta}" transform="rotate(45 ${x} ${y})"/>`;
    const [dx, dy] = geo.depot;
    s += `<circle cx="${dx}" cy="${dy}" r="13" fill="${dark ? C.linho : C.tinta}"/><circle cx="${dx}" cy="${dy}" r="5.5" fill="${dark ? C.noite : C.linho}"/>`;
  }
  return `${s}</svg>`;
}

async function crop(src, out, { top, height, left = 0, width, scale = 2 }) {
  const img = sharp(path.join(V, 'public/shots', src));
  const meta = await img.metadata();
  const w = width ? width * scale : meta.width - left * scale;
  await img.extract({ left: left * scale, top: top * scale, width: Math.min(w, meta.width - left * scale), height: Math.min(height * scale, meta.height - top * scale) }).png().toFile(path.join(OUT, out));
  console.log(out);
}

(async () => {
  await sharp(Buffer.from(mapSvg({ dark: true, containers: true }))).png().toFile(path.join(OUT, 'mapa-contentores.png'));
  console.log('mapas');
  // Capturas reais da produção (23 out 2026), recortadas das páginas de docs/img (geradas por scripts/docs/page-shots.cjs).
  const D = path.join(__dirname, '../docs/img');
  const cut = async (src, out, left, top, width, height) => {
    await sharp(path.join(D, src)).extract({ left, top, width, height }).png().toFile(path.join(OUT, out));
    console.log(out);
  };
  await cut('pagina-rotas.png', 'rotas-mapa.png', 372, 1366, 1120, 584);
  await cut('pagina-rotas.png', 'rotas-kpis.png', 372, 600, 1120, 330);
  await cut('pagina-rastreio.png', 'passaporte.png', 1110, 305, 420, 1738);
  await cut('pagina-rastreio.png', 'lote.png', 73, 976, 981, 1067);
  await cut('pagina-triagem.png', 'triagem-telemovel.png', 1106, 370, 419, 1535);
  await cut('pagina-triagem.png', 'triagem.png', 273, 1055, 497, 585);
  await cut('pagina-copiloto.png', 'copilot-panel.png', 850, 420, 677, 795);
  await cut('pagina-cobertura.png', 'cobertura.png', 73, 330, 1454, 1500);
  await cut('pagina-incerteza.png', 'incerteza.png', 73, 330, 1454, 1700);
  await cut('pagina-relatorio.png', 'relatorio.png', 73, 330, 1454, 800);
  fs.copyFileSync(path.join(__dirname, '../brand/redes/novelo-capa-1920x1080-escuro.png'), path.join(OUT, 'capa.png'));
  // QR para https://novelo.helder.si, nas cores da marca (gerado uma vez com a biblioteca qrcode do Python).
  fs.copyFileSync(path.join(__dirname, 'qr-novelo.png'), path.join(OUT, 'qr-novelo.png'));
  // Vídeo para o diapositivo de plano B: versão leve do render final (video/out), se existir.
  const video = path.join(V, 'out/novelo-16x9.mp4');
  if (fs.existsSync(video)) {
    const { execFileSync } = require('node:child_process');
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video, '-c:v', 'libx264', '-crf', '26', '-preset', 'slow', '-vf', 'scale=1600:-2', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', path.join(OUT, 'novelo-16x9-deck.mp4')]);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '131', '-i', video, '-frames:v', '1', '-vf', 'scale=1600:-2', path.join(OUT, 'video-capa.png')]);
    console.log('vídeo do deck');
  }
  console.log('ok');
})();
