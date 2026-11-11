'use strict';
/**
 * Biblioteca do deck «Novelo · apresentação completa à Vitrus e ao Município».
 * Tema, layouts, componentes e recolha das notas do orador (a mesma fonte alimenta o PPTX e o guião em Markdown).
 */
const path = require('node:path');
const fs = require('node:fs');
const pptxgen = require('pptxgenjs');

const IMG = path.join(__dirname, 'img');
const img = (n) => path.join(IMG, n);
const ic = (name, color = 'f') => img(`ic-${name}-${color}.png`);

// Paleta da marca (docs/marca/guia-de-marca.md): Linho, Tinta, Floresta, Areia + apoio.
const H = {
  linho: 'F4F1EA', tinta: '14211D', floresta: '2E6B57', florestaEsc: '1F4A3C', areia: 'C4A06A',
  branco: 'FFFFFF', florestaTint: 'E3EDE8', areiaTint: 'F1E8D8', cinza: '6B6F68', linha: 'DDD7C8',
  laranja: 'D9822B', terra: 'A94438', verdeClaro: '7FA896', bronze: '8A6A30',
};

const THEME = {
  name: 'Novelo Vitrus',
  headFontFace: 'Cambria',
  bodyFontFace: 'Arial',
  colors: {
    dk1: H.tinta, lt1: H.branco, dk2: H.florestaEsc, lt2: H.linho,
    accent1: H.floresta, accent2: H.areia, accent3: H.laranja, accent4: H.verdeClaro, accent5: H.cinza, accent6: H.terra,
    hlink: H.floresta, folHlink: H.cinza,
  },
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13,333" × 7,5"
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'Novelo: apresentação completa à Vitrus e ao Município de Guimarães';
pres.author = 'Flávio Fernandes e Hélder Gonçalves';
pres.company = 'Novelo';
pres.subject = 'Rede de recolha de têxteis de Guimarães ao menor custo';
const C = pres.SchemeColor;
const W = 13.333;
const HEIGHT = 7.5;
const MX = 0.6;
const CW = W - 2 * MX;

const FOOT = { x: MX, y: 6.98, w: 10.6, h: 0.36 };

pres.defineSlideMaster({
  title: 'CONTEUDO',
  background: { color: C.background2 },
  slideNumber: { x: 12.2, y: 7.02, w: 0.55, h: 0.3, fontFace: 'Arial', fontSize: 10, color: H.cinza, align: 'right' },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: MX, y: 0.5, w: CW, h: 1.05, fontFace: THEME.headFontFace, fontSize: 28, bold: true, color: C.text1, valign: 'top', align: 'left', margin: 0 }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'ESCURO',
  background: { color: C.text2 },
  slideNumber: { x: 12.2, y: 7.02, w: 0.55, h: 0.3, fontFace: 'Arial', fontSize: 10, color: H.verdeClaro, align: 'right' },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: MX, y: 0.5, w: CW, h: 1.05, fontFace: THEME.headFontFace, fontSize: 28, bold: true, color: C.background2, valign: 'top', align: 'left', margin: 0 }, text: '' } },
  ],
});
pres.defineSlideMaster({ title: 'CAPA', background: { color: C.text2 }, objects: [] });

// ---------------------------------------------------------------- notas do orador (fonte única do PPTX e do guião)
const GUIAO = [];
let slideNo = 0;
let currentSection = '';
const nextSection = () => currentSection;
function bump() { slideNo += 1; return slideNo; }

/** Abre um separador de secção e regista-o no guião. */
function section(num, title, subtitle, notes, time) {
  pres.addSection({ title: `${num} · ${title}` });
  currentSection = `${num} · ${title}`;
  const s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: currentSection });
  slideNo += 1;
  s.addText(num, { x: MX, y: 2.2, w: 3, h: 1.4, fontFace: THEME.headFontFace, fontSize: 80, color: H.areia, margin: 0, isTextBox: true, objectName: 'secao-numero' });
  s.addText(title, { x: MX, y: 3.55, w: 11.5, h: 1.0, fontFace: THEME.headFontFace, fontSize: 40, bold: true, color: C.background2, margin: 0, valign: 'top', isTextBox: true, objectName: 'secao-titulo' });
  if (subtitle) s.addText(subtitle, { x: MX, y: 4.65, w: 10.5, h: 1.2, fontFace: THEME.bodyFontFace, fontSize: 18, color: H.verdeClaro, margin: 0, valign: 'top', isTextBox: true, objectName: 'secao-subtitulo' });
  s.addNotes(notes);
  GUIAO.push({ n: slideNo, kind: 'secao', section: currentSection, title: `${num} · ${title}`, time, notes, app: null });
  return s;
}

/**
 * Diapositivo de conteúdo. opts: kicker, title, notes, time, sources, app (instruções de demo), dark.
 * Devolve o slide; o conteúdo põe-se a seguir com os componentes.
 */
function slide({ kicker, title, notes, time, sources, app, dark = false, numbers, core = false }) {
  const s = pres.addSlide({ masterName: dark ? 'ESCURO' : 'CONTEUDO', sectionTitle: currentSection || undefined });
  slideNo += 1;
  if (kicker) s.addText(kicker, { x: W - MX - 6, y: 0.22, w: 6, h: 0.25, fontFace: THEME.bodyFontFace, fontSize: 10, color: dark ? H.verdeClaro : H.cinza, align: 'right', margin: 0, isTextBox: true, objectName: 'cabecalho-corrente' });
  s.addText(title, { placeholder: 'title' });
  if (sources) s.addText(`Fontes: ${sources}`, { x: FOOT.x, y: FOOT.y, w: FOOT.w, h: FOOT.h, fontFace: THEME.bodyFontFace, fontSize: 10, color: dark ? H.verdeClaro : H.cinza, margin: 0, valign: 'top', isTextBox: true, objectName: 'fontes' });
  const appTxt = app ? `\n\n▶ NA APP (${app.route}):\n${app.steps.map((t, i) => `${i + 1}. ${t}`).join('\n')}${app.planB ? `\nPlano B: ${app.planB}` : ''}` : '';
  s.addNotes(`${notes || ''}${appTxt}`);
  GUIAO.push({ n: slideNo, kind: 'slide', section: currentSection, title, kicker, time, notes: notes || '', app: app || null, sources: sources || '', numbers: numbers || null, core });
  return s;
}

// ---------------------------------------------------------------- componentes
// Sistema visual editorial: filetes finos, números sem cartão, tabelas de relatório, sem sombras, sem cantos
// arredondados, sem ícones decorativos, sem etiquetas por cima dos títulos.

function text(s, str, o = {}) {
  s.addText(str, Object.assign({ fontFace: THEME.bodyFontFace, fontSize: 14, color: C.text1, margin: 0, valign: 'top', isTextBox: true }, o));
}

/** Filete horizontal. */
function rule(s, x, y, w, o = {}) {
  s.addShape(pres.ShapeType.line, { x, y, w, h: 0, line: { color: o.color || H.tinta, width: o.width || 0.75, dashType: o.dash }, objectName: 'filete' });
}
/** Filete vertical. */
function vrule(s, x, y, h, o = {}) {
  s.addShape(pres.ShapeType.line, { x, y, w: 0, h, line: { color: o.color || H.linha, width: o.width || 0.75 }, objectName: 'filete-vertical' });
}

/** Painel plano (retângulo branco, sem sombra nem borda) só para agrupar texto quando é mesmo preciso. */
function card(s, x, y, w, h, o = {}) {
  s.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color: o.fill || C.background1 }, line: { color: o.fill || C.background1, width: 0 }, objectName: o.name || 'painel' });
}

/** Número grande com legenda e nota, sobre um filete. Sem cartão. */
function stat(s, x, y, w, h, big, label, sub, o = {}) {
  rule(s, x, y, w, { color: o.ruleColor || H.tinta, width: 0.75 });
  const fitSize = Math.min(o.bigSize || 34, Math.floor((w * 72) / (String(big).length * 0.6)));
  text(s, big, { x, y: y + 0.1, w, h: Math.max(0.5, h * 0.42), fontFace: THEME.headFontFace, fontSize: fitSize, bold: true, color: o.color === C.accent2 ? H.bronze : o.color || C.accent1, valign: 'middle' });
  text(s, label, { x, y: y + 0.1 + Math.max(0.5, h * 0.42), w, h: 0.3, fontSize: o.labelSize || 13.5, bold: true, valign: 'top' });
  if (sub) text(s, sub, { x, y: y + 0.45 + Math.max(0.5, h * 0.42), w, h: Math.max(0.3, h - (0.5 + Math.max(0.5, h * 0.42))), fontSize: o.subSize || 11, color: H.cinza, valign: 'top' });
}

/** Linha de texto com filete superior: título a negrito e descrição. (O parâmetro de ícone é ignorado de propósito.) */
function iconRow(s, x, y, w, _icon, title, desc, o = {}) {
  rule(s, x, y, w, { color: H.linha, width: 0.75 });
  text(s, title, { x, y: y + 0.1, w, h: 0.3, fontSize: o.titleSize || 14, bold: true });
  if (desc) text(s, desc, { x, y: y + 0.42, w, h: o.h ? Math.max(0.3, o.h - 0.5) : 0.7, fontSize: o.descSize || 12, color: o.descColor || H.cinza });
}

/** Lista de pontos (bullets reais). */
function bullets(s, items, o = {}) {
  const runs = items.map((it, i) => {
    const isObj = typeof it === 'object' && !Array.isArray(it);
    const t = isObj ? it.text : it;
    const base = { bullet: { indent: 14 }, breakLine: i < items.length - 1, paraSpaceAfter: o.gap ?? 7, fontSize: o.size || 14, color: o.color || C.text1 };
    return { text: t, options: Object.assign(base, isObj ? it.options : {}) };
  });
  s.addText(runs, { x: o.x, y: o.y, w: o.w, h: o.h, fontFace: THEME.bodyFontFace, margin: 0, valign: 'top', isTextBox: true, objectName: o.name || 'lista' });
}

/** Etiqueta de texto simples com contorno fino (sem pílula). */
function pill(s, str, x, y, w, o = {}) {
  s.addShape(pres.ShapeType.rect, { x, y, w, h: o.h || 0.3, fill: { color: o.fill || C.background1 }, line: { color: o.line || H.tinta, width: 0.75 }, objectName: 'etiqueta' });
  text(s, str, { x, y, w, h: o.h || 0.3, fontSize: o.size || 11, bold: true, color: o.color || C.text1, align: 'center', valign: 'middle' });
}

/** Tabela de relatório: cabeçalho sem preenchimento com filete inferior forte, linhas com filete fino, sem zebra. */
function table(s, rows, o) {
  const fs = o.size || 12;
  const none = { type: 'none' };
  const head = rows[0].map((c, ci) => ({ text: String(c), options: { bold: true, color: C.text1, fontSize: fs, align: o.align?.[ci] ?? 'left', valign: 'bottom', fill: { color: C.background2 }, border: [none, none, { type: 'solid', pt: 1.25, color: H.tinta }, none] } }));
  const body = rows.slice(1).map((r) =>
    r.map((c, ci) => {
      const cell = typeof c === 'object' && c !== null && !Array.isArray(c) ? c : { text: String(c) };
      const opt = Object.assign({ fontSize: fs, color: C.text1, fill: { color: C.background2 }, align: o.align?.[ci] ?? 'left', valign: 'middle', bold: o.boldFirst === true && ci === 0, border: [none, none, { type: 'solid', pt: 0.5, color: H.linha }, none] }, cell.options || {});
      return { text: cell.text, options: opt };
    }),
  );
  s.addTable([head, ...body], { x: o.x, y: o.y, w: o.w, colW: o.cols, rowH: o.rowH || 0.38, fontFace: THEME.bodyFontFace, margin: [0.04, 0.12, 0.04, 0], autoPage: false, objectName: o.name || 'tabela' });
}

/** Seta/linha com ponta. */
function arrow(s, x1, y1, x2, y2, o = {}) {
  s.addShape(pres.ShapeType.line, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1, line: { color: o.color || H.tinta, width: o.width || 1, endArrowType: o.noHead ? undefined : 'triangle', dashType: o.dash }, objectName: 'seta',
  });
}

/** Caixa de passo para diagramas: contorno fino, numeral opcional (o.n), título e descrição. Sem ícones. */
function stepBox(s, x, y, w, h, _icon, title, sub, o = {}) {
  s.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color: o.dark ? C.text2 : C.background1 }, line: { color: o.dark ? C.text2 : H.tinta, width: 0.75 }, objectName: 'passo' });
  const fg = o.dark ? C.background2 : C.text1;
  if (o.n) text(s, String(o.n), { x: x + 0.15, y: y + 0.1, w: 0.6, h: 0.5, fontFace: THEME.headFontFace, fontSize: 26, bold: true, color: o.dark ? H.areia : C.accent1, valign: 'top' });
  text(s, title, { x: x + 0.15, y: y + (o.n ? 0.68 : 0.15), w: w - 0.3, h: 0.5, fontSize: o.titleSize || 13.5, bold: true, color: fg });
  if (sub) text(s, sub, { x: x + 0.15, y: y + (o.n ? 1.2 : 0.7), w: w - 0.3, h: h - (o.n ? 1.28 : 0.8), fontSize: o.subSize || 11, color: o.dark ? H.verdeClaro : H.cinza });
}

/** Imagem de ecrã da app, com filete fino. Mantém a proporção 16:9 das capturas (1600 × 900). */
function shot(s, file, x, y, w, caption) {
  const h = (w * 9) / 16;
  s.addImage({ path: img(file), x, y, w, h, line: { color: H.linha, width: 0.75 }, altText: caption || file });
  if (caption) text(s, caption, { x, y: y + h + 0.08, w, h: 0.4, fontSize: 10.5, color: H.cinza });
  return h;
}

/** Formato pt-PT com espaço de milhares (também em números de 4 dígitos) e vírgula decimal. */
function nf(n, d = 0) {
  const v = Number(n).toFixed(d);
  const [i, f] = v.replace('-', '').split('.');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${n < 0 ? '−' : ''}${g}${f ? ',' + f : ''}`;
}

/** Moldura de telemóvel (390 × 844) com captura. h = altura da moldura. */
function phone(s, file, x, y, h, caption) {
  const w = h * (390 / 844);
  s.addShape(pres.ShapeType.roundRect, { x: x - 0.07, y: y - 0.07, w: w + 0.14, h: h + 0.14, rectRadius: 0.1, fill: { color: C.text1 }, line: { color: C.text1, width: 0.5 }, objectName: 'moldura-telemovel' });
  s.addImage({ path: img(file), x, y, w, h, altText: caption || file });
  if (caption) text(s, caption, { x: x - 0.1, y: y + h + 0.16, w: w + 0.4, h: 0.5, fontSize: 10.5, color: H.cinza });
}

/** Imagem solta com moldura, qualquer proporção. */
function framed(s, file, x, y, w, h, caption) {
  s.addImage({ path: img(file), x, y, w, h, sizing: { type: 'contain', w, h }, line: { color: H.linha, width: 0.75 }, altText: caption || file });
  if (caption) text(s, caption, { x, y: y + h + 0.08, w, h: 0.45, fontSize: 10.5, color: H.cinza });
}

const chartBase = () => ({
  catAxisLabelFontFace: 'Arial', valAxisLabelFontFace: 'Arial', dataLabelFontFace: 'Arial', legendFontFace: 'Arial', titleFontFace: 'Arial',
  catAxisLabelColor: H.tinta, valAxisLabelColor: H.cinza, dataLabelColor: H.tinta,
  catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, dataLabelFontSize: 11, legendFontSize: 11,
  valGridLine: { color: H.linha, size: 0.5 }, catGridLine: { style: 'none' },
});

module.exports = {
  bump, rule, vrule, nf, phone, framed, pres, C, H, THEME, W, HEIGHT, MX, CW, FOOT, GUIAO, img, ic, section, slide, card, stat, iconRow, bullets, pill, table, arrow, stepBox, shot, text, chartBase, nextSection,
};
