// Deck do pitch do Novelo (Hack4Guimarães 2035, Desafio 5 TexVitrus). Corre com: node assets.js && node build.js
// Todos os números vêm dos dados da Vitrus, do otimizador (cenários de referência de 22 out 2026) ou dos docs
// (docs/projeto/visao-geral.md, apps/web/src/features/landing/facts.ts). Estimativas levam a palavra "estimativa".
const pptxgen = require('pptxgenjs');
const path = require('node:path');
const fs = require('node:fs');
// applyTheme vem da skill de pptx do Claude (PPTX_SKILL aponta para a pasta da skill).
const { applyTheme } = require(path.join(process.env.PPTX_SKILL ?? '', 'scripts/apply_theme.js'));

const A = (f) => path.join(__dirname, 'assets', f);
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const THEME = {
  name: 'Novelo',
  headFontFace: 'Newsreader Medium',
  bodyFontFace: 'Inter',
  colors: {
    dk1: '14211D', // tinta
    lt1: 'F4F1EA', // linho
    dk2: '0F1815', // fundo escuro
    lt2: 'FFFFFF',
    accent1: '2E6B57', // floresta
    accent2: 'C4A06A', // areia
    accent3: '7FB39C', // floresta clara
    accent4: '5E6B66', // pedra
    accent5: 'DCD5C8', // linha
    accent6: 'A2452F', // rejeito
    hlink: '2E6B57',
    folHlink: '5E6B66',
  },
};
// Hex só onde a opção não aceita cor do tema (sombras, grelhas).
const HEX = { tinta: '14211D', linho: 'F4F1EA', noite: '0F1815', floresta: '2E6B57', areia: 'C4A06A', pedra: '5E6B66', linha: 'DCD5C8', clara: '7FB39C', branco: 'FFFFFF', rejeito: 'A2452F' };

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13,333 × 7,5 pol.
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'Novelo: pitch Hack4Guimarães 2035';
pres.author = 'Hélder Gonçalves e Flávio Fernandes';
pres.subject = 'Desafio 5 TexVitrus: recolha seletiva de têxteis em Guimarães';
const C = pres.SchemeColor;

// `just check` de 22 out 2026 (verde) e `just eval-copilot` (155 perguntas ao modelo real, 100% dos números verificados).
const TESTS = { api: '1 037', web: '437', evals: '155' };

const W = 13.333;
const M = 0.6; // margem

// ------------------------------------------------------------------------------------------------ esquemas
const titlePh = (color) => ({
  placeholder: {
    options: { name: 'title', type: 'title', x: M, y: 0.95, w: W - 2 * M, h: 1.15, fontFace: THEME.headFontFace, fontSize: 34, color, align: 'left', valign: 'top', margin: 0, lineSpacingMultiple: 0.95 },
    text: '',
  },
});
const eyebrowPh = (color) => ({
  placeholder: {
    options: { name: 'eyebrow', type: 'body', x: M, y: 0.55, w: 9, h: 0.3, fontFace: THEME.bodyFontFace, fontSize: 11, bold: true, charSpacing: 3, color, margin: 0 },
    text: '',
  },
});
const num = (color) => ({ x: W - M - 0.6, y: 7.5 - 0.45, w: 0.6, h: 0.25, fontFace: THEME.bodyFontFace, fontSize: 9, color, align: 'right' });

pres.defineSlideMaster({ title: 'CLARO', background: { color: HEX.linho }, objects: [eyebrowPh(C.accent1), titlePh(C.text1)], slideNumber: num(C.accent4) });
pres.defineSlideMaster({ title: 'ESCURO', background: { color: HEX.noite }, objects: [eyebrowPh(C.accent2), titlePh(C.background1)], slideNumber: num(C.accent4) });
pres.defineSlideMaster({ title: 'CAPA', background: { path: A('capa.png') }, objects: [] });
pres.defineSlideMaster({ title: 'ESCURO_LIVRE', background: { color: HEX.noite }, objects: [], slideNumber: num(C.accent4) });

// ------------------------------------------------------------------------------------------------ ajudas
const shadow = () => ({ type: 'outer', color: HEX.tinta, blur: 18, offset: 6, angle: 90, opacity: 0.18 });

function source(slide, text, dark = false) {
  slide.addText([{ text: 'FONTE  ', options: { bold: true, charSpacing: 2, fontSize: 8 } }, { text, options: { fontSize: 9 } }], {
    x: M, y: 7.5 - 0.5, w: W - 2 * M - 0.9, h: 0.3, fontFace: THEME.bodyFontFace, color: dark ? C.accent4 : C.accent4, margin: 0, valign: 'middle', isTextBox: true, objectName: 'Fonte',
  });
}

function estimate(slide, x, y, dark = false) {
  slide.addText('ESTIMATIVA', {
    shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.5, x, y, w: 1.05, h: 0.26, fontFace: THEME.bodyFontFace, fontSize: 8, bold: true, charSpacing: 2,
    color: dark ? C.accent2 : C.text1, fill: { color: C.accent2, transparency: dark ? 82 : 70 }, line: { color: C.accent2, width: 0.75 }, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: 'Estimativa',
  });
}

function stat(slide, { x, y, w, value, label, dark = false, size = 40, color }) {
  slide.addText(value, { x, y, w, h: size / 72 + 0.12, fontFace: THEME.headFontFace, fontSize: size, color: color ?? (dark ? C.accent2 : C.text1), margin: 0, valign: 'bottom', isTextBox: true, objectName: `Número ${value}` });
  slide.addText(label, { x, y: y + size / 72 + 0.16, w, h: 0.5, fontFace: THEME.bodyFontFace, fontSize: 12, color: dark ? C.accent5 : C.accent4, margin: 0, valign: 'top', isTextBox: true, objectName: `Legenda ${value}` });
}

function card(slide, { x, y, w, h, fill = 'FBF9F4', name }) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: C.accent5, width: 0.75 }, objectName: name });
}

function image(slide, file, { x, y, w, h, name, frame = true }) {
  if (frame) slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.04, y: y - 0.04, w: w + 0.08, h: h + 0.08, rectRadius: 0.08, fill: { color: C.background1 }, line: { color: C.accent5, width: 0.75 }, shadow: shadow(), objectName: `Moldura ${name}` });
  slide.addImage({ path: A(file), x, y, w, h, objectName: name, altText: name });
}

function body(slide, text, opts) {
  slide.addText(text, { fontFace: THEME.bodyFontFace, fontSize: 15, color: C.accent4, margin: 0, valign: 'top', isTextBox: true, paraSpaceAfter: 6, ...opts });
}

// Tamanho de imagem que cabe em (w, h) mantendo a proporção.
function fit(file, maxW, maxH) {
  const buf = fs.readFileSync(A(file));
  // PNG: largura e altura nos bytes 16..24
  const iw = buf.readUInt32BE(16);
  const ih = buf.readUInt32BE(20);
  const k = Math.min(maxW / iw, maxH / ih);
  return { w: iw * k, h: ih * k };
}

// ================================================================================================ PITCH
pres.addSection({ title: 'Pitch (5 minutos)' });

// 1. Capa ------------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CAPA', sectionTitle: 'Pitch (5 minutos)' });
  s.addText('HACK4GUIMARÃES 2035 · DESAFIO 5 TEXVITRUS', { x: M + 0.13, y: 0.6, w: 8, h: 0.3, fontFace: THEME.bodyFontFace, fontSize: 11, bold: true, charSpacing: 3, color: C.accent2, margin: 0, isTextBox: true, objectName: 'Desafio' });
  s.addText('Do saco ao fio', { x: M + 0.13, y: 4.55, w: 6.5, h: 0.7, fontFace: THEME.headFontFace, fontSize: 30, color: C.background1, margin: 0, isTextBox: true, objectName: 'Frase' });
  s.addText('Hélder Gonçalves · Flávio Fernandes  ·  novelo.helder.si', { x: M + 0.13, y: 6.6, w: 8, h: 0.3, fontFace: THEME.bodyFontFace, fontSize: 12, color: C.accent5, margin: 0, isTextBox: true, objectName: 'Equipa' });
  s.addNotes(
    'Abrir com o número, sem apresentar a equipa.\n' +
      '«Em Guimarães, quase 9 em cada 10 quilos de têxtil que deitamos fora vão para o lixo indiferenciado. O Novelo desenha a recolha que os traz de volta, ao menor custo e sem um único contentor novo.»',
  );
}

// 2. Problema ------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch (5 minutos)' });
  s.addText('O PROBLEMA', { placeholder: 'eyebrow' });
  s.addText('Quase 9 em cada 10 quilos de têxtil acabam no lixo', { placeholder: 'title' });
  s.addText('2 324,8 t', { x: M, y: 2.35, w: 6, h: 1.3, fontFace: THEME.headFontFace, fontSize: 88, color: C.accent1, margin: 0, valign: 'bottom', isTextBox: true, objectName: 'Número principal' });
  body(s, 'de têxtil por ano no lixo indiferenciado: 43 051 t de RSU recolhidas pela Vitrus em 2025 × 5,4% de têxtil (APA).', { x: M, y: 3.75, w: 5.6, h: 0.8, fontSize: 16, color: C.text1 });
  estimate(s, M, 4.65);
  stat(s, { x: M, y: 5.2, w: 2.6, value: '301,3 t', label: 'recolhidas à parte em 2025, por 4 entidades', size: 30 });
  stat(s, { x: M + 2.9, y: 5.2, w: 2.6, value: '11,5%', label: 'do têxtil gerado chega à recolha seletiva (estimativa)', size: 30, color: C.accent1 });
  // 200 pontos: 23 recolhidos à parte (11,5%), 177 no lixo. Cada ponto ≈ 13 t.
  const cols = 20;
  const cell = 0.305;
  const x0 = 6.75;
  const y0 = 2.45;
  for (let i = 0; i < 200; i++) {
    const cx = x0 + (i % cols) * cell;
    const cy = y0 + Math.floor(i / cols) * cell;
    s.addShape(pres.shapes.OVAL, { x: cx, y: cy, w: cell * 0.74, h: cell * 0.74, fill: { color: i < 23 ? C.accent1 : C.text1, transparency: i < 23 ? 0 : 10 }, line: { type: 'none' }, objectName: `Ponto ${i + 1}` });
  }
  s.addShape(pres.shapes.OVAL, { x: x0, y: y0 + 10 * cell + 0.15, w: 0.17, h: 0.17, fill: { color: C.accent1 }, line: { type: 'none' }, objectName: 'Legenda recolhido' });
  body(s, 'recolhido à parte', { x: x0 + 0.25, y: y0 + 10 * cell + 0.1, w: 1.8, h: 0.3, fontSize: 12 });
  s.addShape(pres.shapes.OVAL, { x: x0 + 2.2, y: y0 + 10 * cell + 0.15, w: 0.17, h: 0.17, fill: { color: C.text1 }, line: { type: 'none' }, objectName: 'Legenda lixo' });
  body(s, 'no lixo indiferenciado (cada ponto ≈ 13 t)', { x: x0 + 2.45, y: y0 + 10 * cell + 0.1, w: 3.6, h: 0.3, fontSize: 12 });
  source(s, 'Vitrus Ambiente (RSU e têxtil recolhido em 2025); APA (5,4% de têxtil no RSU, indicado pela Vitrus). Captura = 301,3 ÷ (2 324,8 + 301,3) t.');
  s.addNotes(
    '«Em 2025 a Vitrus recolheu 43 051 toneladas de lixo indiferenciado. 5,4% é têxtil: são cerca de 2 325 toneladas por ano que vão para aterro. Recolhidas à parte, só 301. Ou seja, 11,5% do que se gera.»\n' +
      'Dizer «estimativa» uma vez: o 5,4% é a composição média da APA, indicada pela própria Vitrus. A procura é conservadora: as 43 051 t são 84% do indiferenciado do concelho (R&C 2025 da Vitrus).',
  );
}

// 3. Valor na reutilização --------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch (5 minutos)' });
  s.addText('O QUE INTERESSA', { placeholder: 'eyebrow' });
  s.addText('O valor está na reutilização, e a reutilização exige têxtil limpo', { placeholder: 'title' });
  const labels = ['Ultriplo (134,1 t)', 'H Sarah Trading (118,6 t)', 'Nova Etapa (42,9 t)', 'Vitrus (5,6 t)', 'Total (301,3 t)'];
  s.addChart(
    pres.charts.BAR,
    [
      { name: 'Reutilização', labels, values: [72.9, 50.0, 50.0, 9.2, 59.4] },
      { name: 'Reciclagem', labels, values: [12.7, 37.0, 40.0, 34.0, 26.5] },
      { name: 'Rejeito', labels, values: [14.5, 13.0, 10.0, 56.9, 14.1] },
    ],
    {
      x: M, y: 2.3, w: 8.2, h: 4.1, barDir: 'bar', barGrouping: 'percentStacked', barGapWidthPct: 45,
      chartColors: [HEX.floresta, HEX.pedra, HEX.rejeito], showValue: true, dataLabelPosition: 'ctr', dataLabelColor: HEX.linho, dataLabelFontSize: 11, dataLabelFontFace: '+mn-lt', dataLabelFormatCode: '0.0',
      catAxisLabelColor: HEX.tinta, catAxisLabelFontSize: 12, catAxisLabelFontFace: '+mn-lt', catAxisOrientation: 'maxMin', catAxisLineShow: false,
      valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
      showLegend: true, legendPos: 't', legendFontSize: 11, legendFontFace: '+mn-lt', legendColor: HEX.tinta,
      showTitle: false, objectName: 'Destino por entidade',
    },
  );
  card(s, { x: 9.2, y: 2.4, w: 3.53, h: 3.9, name: 'Leitura' });
  s.addText('59,4%', { x: 9.45, y: 2.6, w: 3.1, h: 0.85, fontFace: THEME.headFontFace, fontSize: 44, color: C.accent1, margin: 0, isTextBox: true, objectName: 'Reutilização total' });
  body(s, 'do que se recolheu em 2025 foi reutilizado. A reciclagem custa mais do que a fibra virgem: o valor está no têxtil limpo e seco.', { x: 9.45, y: 3.5, w: 3.05, h: 1.4, fontSize: 13, color: C.text1 });
  body(s, 'A qualidade depende de como se recolhe: 72,9% reutilizado na Ultriplo, 9,2% no pouco têxtil recolhido pela Vitrus, com 56,9% de rejeito.', { x: 9.45, y: 4.85, w: 3.05, h: 1.4, fontSize: 13 });
  source(s, 'Vitrus Ambiente, destinos de 2025 por entidade (pesagem na Ultriplo e na H Sarah Trading; percentagens declaradas na Nova Etapa e na Vitrus); mentor da Vitrus, 21 out 2026.');
  s.addNotes(
    '«Do pouco que se recolhe, 59% é reutilizado. A Vitrus disse-nos que a reciclagem custa mais do que a fibra virgem: por isso o Novelo mede toneladas reutilizáveis, não só toneladas.»\n' +
      'Se perguntarem pelo 9,2% da Vitrus: é o pouco têxtil que a Vitrus recolheu, com 56,9% de rejeito. É o que acontece quando o têxtil chega sujo.',
  );
}

// 4. Lei -----------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch (5 minutos)' });
  s.addText('A LEI', { placeholder: 'eyebrow' });
  s.addText('A recolha já é obrigatória. Hoje paga o município; em 2028, só o custo eficiente', { placeholder: 'title' });
  const lx = M + 0.2;
  const lw = W - 2 * M - 0.4;
  const ly = 3.35;
  const at = (days) => lx + (lw * days) / 1202; // 1 jan 2025 → 17 abr 2028
  s.addShape(pres.shapes.LINE, { x: lx - 0.2, y: ly, w: lw + 0.4, h: 0, line: { color: C.accent5, width: 2 }, objectName: 'Linha do tempo' });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: at(0), y: ly - 0.09, w: at(1202) - at(0), h: 0.18, rectRadius: 0.5, fill: { color: C.accent2, transparency: 45 }, line: { type: 'none' }, objectName: 'Paga o município' });
  s.addText('HOJE PAGA O MUNICÍPIO', { x: at(120), y: ly - 0.5, w: 3.2, h: 0.3, fontFace: THEME.bodyFontFace, fontSize: 10, bold: true, charSpacing: 2, color: '7A5F33', margin: 0, isTextBox: true, objectName: 'Etiqueta município' });
  const marks = [
    { d: 0, date: '1 JAN 2025', title: 'Recolha seletiva de têxteis obrigatória', text: 'Diretiva 2008/98/CE e regime geral de gestão de resíduos. Não há entidade gestora de têxteis.', color: C.accent1, align: 'left' },
    { d: 1202, date: '17 ABR 2028', title: 'Responsabilidade alargada do produtor', text: 'Os produtores pagam só as peças vendidas depois da lei nacional (art. 22.º-A, n.º 11), e só o custo eficiente (n.º 12).', color: C.text1, align: 'right' },
  ];
  for (const mk of marks) {
    const x = at(mk.d);
    s.addShape(pres.shapes.OVAL, { x: x - 0.11, y: ly - 0.11, w: 0.22, h: 0.22, fill: { color: mk.color }, line: { color: C.background1, width: 2 }, objectName: `Marco ${mk.date}` });
    const bw = mk.align === 'center' ? 2.4 : 4.3;
    const bx = mk.align === 'left' ? x - 0.11 : mk.align === 'right' ? x + 0.11 - bw : x - bw / 2;
    s.addText(
      [
        { text: mk.date, options: { fontSize: 10, bold: true, charSpacing: 2, color: mk.color, breakLine: true } },
        { text: mk.title, options: { fontFace: THEME.headFontFace, fontSize: 18, color: C.text1, breakLine: true } },
        { text: mk.text, options: { fontSize: 12, color: C.accent4 } },
      ],
      { x: bx, y: ly + 0.3, w: bw, h: 1.6, fontFace: THEME.bodyFontFace, align: mk.align, valign: 'top', margin: 0, paraSpaceAfter: 4, isTextBox: true, objectName: `Texto ${mk.date}` },
    );
  }
  s.addShape(pres.shapes.OVAL, { x: at(897) - 0.09, y: ly - 0.09, w: 0.18, h: 0.18, fill: { color: C.accent4 }, line: { color: C.background1, width: 2 }, objectName: 'Marco transposição' });
  s.addText([{ text: '17 JUN 2027 · ', options: { bold: true, charSpacing: 2, color: C.accent4 } }, { text: 'prazo de transposição', options: { color: C.accent4 } }], { x: at(897) - 1.6, y: ly - 0.5, w: 3.2, h: 0.3, fontFace: THEME.bodyFontFace, fontSize: 10, align: 'center', margin: 0, isTextBox: true, objectName: 'Transposição' });
  card(s, { x: M, y: 5.45, w: W - 2 * M, h: 1.15, fill: 'ECE7DC', name: 'Conclusão' });
  s.addText(
    [
      { text: 'Quem chegar à mesa sem saber quanto custa cada tonelada não tem como defender o seu número. ', options: { fontFace: THEME.headFontFace, fontSize: 19, color: C.text1 } },
      { text: 'O custo eficiente é fixado «entre os intervenientes relevantes», entre eles as autoridades locais (art. 22.º-A, n.º 7 e 12).', options: { fontSize: 12, color: C.accent4 } },
    ],
    { x: M + 0.3, y: 5.55, w: W - 2 * M - 0.6, h: 0.95, fontFace: THEME.bodyFontFace, valign: 'middle', margin: 0, isTextBox: true, objectName: 'Mensagem' },
  );
  source(s, 'Diretiva (UE) 2025/1892, art. 22.º-A, n.º 7, 11 e 12; APA, perguntas frequentes sobre têxteis (dez 2025).');
  s.addNotes(
    '«Desde janeiro de 2025 a recolha seletiva de têxteis é obrigatória e não há entidade gestora: paga a câmara. A diretiva de 2025 cria a responsabilidade do produtor até abril de 2028, mas só para as peças vendidas depois da lei nacional, e só o custo eficiente, negociado com as autoridades locais.»\n' +
      'Não dizer «em 2028 os produtores pagam tudo». As peças que já estão nas casas continuam anos a pesar no município.',
  );
}

// 5. Onde se perde ---------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Pitch (5 minutos)' });
  s.addText('ONDE SE PERDE', { placeholder: 'eyebrow' });
  s.addText('O têxtil perde-se onde o camião já passa', { placeholder: 'title' });
  const { w, h } = fit('mapa-contentores.png', 6.4, 6.0);
  s.addImage({ path: A('mapa-contentores.png'), x: W - M - w + 0.2, y: 7.5 - h - 0.35, w, h, objectName: 'Mapa dos contentores', altText: 'Mapa de Guimarães com as 48 freguesias e os contentores municipais' });
  stat(s, { x: M, y: 2.35, w: 4, value: '2 751', label: 'contentores municipais de indiferenciado, orgânico e seletivo', dark: true, size: 54 });
  stat(s, { x: M, y: 3.85, w: 4, value: '2 026', label: 'locais por onde a viatura já passa', dark: true, size: 40 });
  stat(s, { x: M, y: 5.0, w: 4, value: '40 · 29', label: 'circuitos e viaturas da Vitrus', dark: true, size: 40 });
  source(s, 'Vitrus Ambiente: pacote QGIS de contentores (20 out 2026; 2 722 com coordenadas no mapa), circuitos e turnos; DGT, CAOP 2019.', true);
  s.addNotes('«O têxtil não desaparece longe: perde-se nos 2 751 contentores municipais, exatamente onde a viatura da Vitrus já passa todos os dias. Usámos o inventário real da Vitrus como base geográfica.»');
}

// 6. Ouvimos a Vitrus --------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch (5 minutos)' });
  s.addText('21 DE OUTUBRO', { placeholder: 'eyebrow' });
  s.addText('Ouvimos a Vitrus e refizemos o modelo em 24 horas', { placeholder: 'title' });
  const rows = [
    ['Não tem contentores de têxtil e não os quer: o têxtil de contentor vem contaminado', 'A rede deixou de ter contentores de têxtil'],
    ['Contem 5,4% de têxtil nas 43 051 t de RSU de 2025', 'A procura passou a 2 324,8 t por ano (estimativa)'],
    ['A reciclagem é muito mais cara do que a fibra virgem', 'Cada cenário mostra as toneladas reutilizáveis'],
    ['Os ficheiros QGIS têm todos os contentores', 'Os 2 751 contentores são a base geográfica'],
  ];
  const head = (t) => ({ text: t, options: { bold: true, fontSize: 11, charSpacing: 2, color: C.accent1, fill: { color: 'ECE7DC' } } });
  s.addTable(
    [[head('A VITRUS DISSE'), head('O QUE MUDOU NO NOVELO')], ...rows.map(([a, b]) => [{ text: a, options: { color: C.text1 } }, { text: b, options: { color: C.text1, bold: true } }])],
    { x: M, y: 2.3, w: 8.6, colW: [4.6, 4.0], fontFace: THEME.bodyFontFace, fontSize: 14, border: { type: 'solid', pt: 0.75, color: HEX.linha }, fill: { color: 'FBF9F4' }, margin: [0.12, 0.16, 0.12, 0.16], valign: 'middle', rowH: [0.45, 0.85, 0.75, 0.75, 0.75], objectName: 'O que mudou' },
  );
  s.addText('24 h', { x: 9.7, y: 2.35, w: 3.0, h: 1.5, fontFace: THEME.headFontFace, fontSize: 96, color: C.accent1, margin: 0, align: 'center', valign: 'middle', isTextBox: true, objectName: '24 horas' });
  body(s, 'Uma rede sem um único contentor novo, sobre os circuitos e as viaturas que já existem.', { x: 9.75, y: 4.0, w: 2.9, h: 1.2, fontSize: 15, color: C.text1, align: 'center' });
  source(s, 'Email do mentor da Vitrus, 21 out 2026; registo de alterações do repositório.');
  s.addNotes('«A 21 de outubro o mentor da Vitrus respondeu-nos: não querem contentores de têxtil, porque o têxtil de contentor chega contaminado. Nesse mesmo dia refizemos o modelo: a rede proposta deixou de ter contentores.» Isto mostra que ouvimos o cliente e que o produto é flexível.');
}

// 7. A rede -------------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Pitch (5 minutos)' });
  s.addText('A RESPOSTA', { placeholder: 'eyebrow' });
  s.addText('Uma rede sem contentores, sobre o que já existe', { placeholder: 'title' });
  const { w, h } = fit('mapa-rede.png', 5.6, 5.4);
  s.addImage({ path: A('mapa-rede.png'), x: W - M - w + 0.1, y: 7.5 - h - 0.5, w, h, objectName: 'Mapa da rede', altText: 'Mapa do cenário de 60 000 euros por ano: freguesias com porta a porta, locais existentes, rotas e escolas' });
  const items = [
    { n: '1', color: C.accent3, title: 'Saco fechado à porta, no dia em que o camião já passa', text: '20 freguesias no cenário · 129,3 t/ano · 0 km novos. 22 das 48 têm porta a porta com viatura.' },
    { n: '2', color: C.accent2, title: 'Paragem nos locais por onde a viatura já passa', text: '55 pontos sem contentor novo · 267,2 t/ano · 3 circuitos, 3 223 km/ano.' },
    { n: '3', color: C.background1, title: 'Escolas como pontos com pessoas', text: '86 escolas candidatas: o saco é entregue em mão.' },
    { n: 'B', color: C.accent4, title: 'E se o saco não puder ir no compactador?', text: 'Numa tarde de dia útil há pelo menos 15 viaturas sem circuito (turnos da Vitrus).' },
  ];
  items.forEach((it, i) => {
    const y = 2.3 + i * 1.12;
    s.addText(it.n, { shape: pres.shapes.OVAL, x: M, y, w: 0.46, h: 0.46, fill: { color: it.color }, color: C.text2, fontFace: THEME.bodyFontFace, fontSize: 14, bold: true, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: `Canal ${it.n}` });
    s.addText(
      [
        { text: it.title, options: { fontFace: THEME.headFontFace, fontSize: 18, color: C.background1, breakLine: true } },
        { text: it.text, options: { fontSize: 12, color: C.accent5 } },
      ],
      { x: M + 0.65, y: y - 0.05, w: 6.3, h: 1.0, fontFace: THEME.bodyFontFace, valign: 'top', margin: 0, paraSpaceAfter: 3, isTextBox: true, objectName: `Texto canal ${it.n}` },
    );
  });
  source(s, 'Cenário de referência por freguesia, 60 000 €/ano (otimizador Novelo, 22 out 2026, estimativa); circuitos e turnos da Vitrus (19 a 25 set 2026); INE; CAOP 2019.', true);
  s.addNotes(
    '«Não propomos um contentor melhor. Propomos usar o que já existe: o saco fechado à porta no dia em que o camião do porta a porta já passa, zero quilómetros novos; paragens nos locais por onde a viatura já passa; e as escolas.»\n' +
      'Plano B, se perguntarem pelo compactador: numa tarde de dia útil há pelo menos 15 viaturas sem circuito. Falta validar a caixa e a equipa com a Vitrus.',
  );
}

// 8. Resultado -------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch (5 minutos)' });
  s.addText('O RESULTADO · 60 000 €/ANO', { placeholder: 'eyebrow' });
  s.addText('396,5 t por ano fora do lixo, a 120,6 €/t, sem viaturas nem contentores novos', { placeholder: 'title' });
  const tiles = [
    { v: '396,5 t', l: 'desviadas do lixo por ano', hero: true },
    { v: '120,6 €/t', l: 'custo por tonelada (P10 a P90: 96,9 a 154,7)' },
    { v: '235,6 t', l: 'reutilizáveis (198 a 289 t)' },
    { v: '13 750 €', l: 'de investimento em 55 pontos' },
  ];
  const tw = 2.85;
  tiles.forEach((t, i) => {
    const x = M + i * (tw + 0.2);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.3, w: tw, h: 1.25, rectRadius: 0.1, fill: { color: t.hero ? C.accent1 : 'FBF9F4' }, line: { color: t.hero ? C.accent1 : C.accent5, width: 0.75 }, objectName: `Cartão ${t.v}` });
    s.addText(t.v, { x: x + 0.2, y: 2.38, w: tw - 0.4, h: 0.65, fontFace: THEME.headFontFace, fontSize: 30, color: t.hero ? C.background1 : C.text1, margin: 0, valign: 'bottom', isTextBox: true, objectName: `Valor ${t.v}` });
    s.addText(t.l, { x: x + 0.2, y: 3.05, w: tw - 0.4, h: 0.42, fontFace: THEME.bodyFontFace, fontSize: 11, color: t.hero ? C.background1 : C.accent4, margin: 0, valign: 'top', isTextBox: true, objectName: `Legenda ${t.v}` });
  });
  estimate(s, W - M - 1.05, 0.55);
  // curva custo por tonelada
  s.addChart(
    pres.charts.LINE,
    [{ name: '€ por tonelada', labels: ['40 000 €/ano\n323,9 t · 85,6 €/t', '60 000 €/ano\n396,5 t · 120,6 €/t', 'Teto sem contentores\n597,7 t · 232,3 €/t'], values: [85.6, 120.6, 232.3] }],
    {
      x: M, y: 3.85, w: 7.4, h: 2.9, chartColors: [HEX.floresta], lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 11,
      catAxisLabelColor: HEX.tinta, catAxisLabelFontSize: 11, catAxisLabelFontFace: '+mn-lt', valAxisLabelColor: HEX.pedra, valAxisLabelFontSize: 10, valAxisLabelFontFace: '+mn-lt',
      valAxisMinVal: 0, valAxisMaxVal: 250, valAxisMajorUnit: 50, valGridLine: { color: HEX.linha, size: 0.75 }, catGridLine: { style: 'none' },
      showValue: false, showLegend: false, showTitle: true, title: 'Custo por tonelada (€/t) em três orçamentos', titleFontSize: 12, titleColor: HEX.tinta, titleFontFace: '+mn-lt',
      objectName: 'Curva de custo',
    },
  );
  card(s, { x: 8.3, y: 3.85, w: W - M - 8.3, h: 2.9, name: 'Captura' });
  s.addText('Captura do têxtil gerado', { x: 8.55, y: 4.0, w: 4, h: 0.3, fontFace: THEME.bodyFontFace, fontSize: 12, color: C.accent4, margin: 0, isTextBox: true });
  s.addText([{ text: '11,5%', options: { color: C.accent4 } }, { text: '  →  ', options: { color: C.accent4, fontSize: 24 } }, { text: '≈ 27%', options: { color: C.accent1 } }], { x: 8.55, y: 4.35, w: 4, h: 0.9, fontFace: THEME.headFontFace, fontSize: 40, margin: 0, valign: 'middle', isTextBox: true, objectName: 'Captura de 11,5% para 27%' });
  body(s, 'As primeiras toneladas são as do porta a porta que já existe; as últimas exigem desvios longos e custam quase o dobro. É esta curva que deixa decidir com números.', { x: 8.55, y: 5.35, w: W - M - 8.8, h: 1.3, fontSize: 12, color: C.text1 });
  source(s, 'Otimizador Novelo (OR-Tools CP-SAT e VRP) sobre os dados da Vitrus; cenários de referência de 22 out 2026; Monte Carlo com 500 amostras. Captura = (301,3 + 396,5) ÷ 2 626,0 t.');
  s.addNotes(
    '«Com 60 000 € por ano, o otimizador desvia 396,5 toneladas por ano a 120,6 € por tonelada, das quais cerca de 236 reutilizáveis. A captura sobe de 11,5% para cerca de 27%. Em 8 de cada 10 simulações, o custo fica entre 97 e 155 € por tonelada.»\n' +
      'Frase-âncora: «396 toneladas por ano a 121 € por tonelada». Todos estes números são estimativas sobre os dados reais da Vitrus; os custos unitários da Vitrus ainda não chegaram.',
  );
}

// 9. Demo -------------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch (5 minutos)' });
  s.addText('DEMO AO VIVO · NOVELO.HELDER.SI', { placeholder: 'eyebrow' });
  s.addText('Do orçamento ao relatório, em dois minutos', { placeholder: 'title' });
  const { w, h } = fit('sim-kpis.png', 7.6, 4.5);
  image(s, 'sim-kpis.png', { x: M, y: 2.35, w, h, name: 'Simulador: resultado do cenário de 60 000 €/ano' });
  const steps = [
    ['Decidir', 'Orçamento entra; o otimizador escolhe freguesias, canais e rotas.'],
    ['Provar', 'Cobertura do art. 22.º-C e incerteza calculada.'],
    ['Perguntar', '«E se...?» em português; o copiloto corre o otimizador.'],
    ['Operar', 'Triagem por foto, lote com QR e passaporte público.'],
    ['Prestar contas', 'Relatório RAP em PDF, num clique.'],
  ];
  steps.forEach(([t, d], i) => {
    const y = 2.35 + i * 0.86;
    s.addText(String(i + 1), { shape: pres.shapes.OVAL, x: 8.75, y, w: 0.4, h: 0.4, fill: { color: C.accent1 }, color: C.background1, fontFace: THEME.bodyFontFace, fontSize: 12, bold: true, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: `Passo ${i + 1}` });
    s.addText([{ text: t, options: { bold: true, color: C.text1, breakLine: true } }, { text: d, options: { color: C.accent4, fontSize: 12 } }], { x: 9.3, y: y - 0.05, w: W - M - 9.3, h: 0.8, fontFace: THEME.bodyFontFace, fontSize: 14, margin: 0, valign: 'top', isTextBox: true, objectName: `Texto passo ${i + 1}` });
  });
  source(s, 'Captura da app (stack de dev com os dados de 22 out 2026). Plano B: vídeo da demo no diapositivo 17.');
  s.addNotes(
    'Demo de 2 minutos em novelo.helder.si (ou na stack local):\n' +
      '1. Simulador: 60 000 €/ano, ver toneladas, €/t e mapa.\n2. Plano de recolha: circuito, dia, viatura, kg por ronda.\n3. Separador Cobertura e Incerteza.\n4. Copiloto: um jurado faz a pergunta «E se...?».\n5. Lote com QR: o jurado lê o passaporte no telemóvel.\n6. Relatório RAP em PDF.\n' +
      'Se a rede falhar: vídeo no último diapositivo e o PDF RAP pré-gerado.',
  );
}

// 10. IA ---------------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Pitch (5 minutos)' });
  s.addText('O COPILOTO', { placeholder: 'eyebrow' });
  s.addText('A IA conduz o otimizador. Nunca faz contas', { placeholder: 'title' });
  const flow = [
    ['Pergunta em português', '«E se o orçamento fosse 80 000 € por ano?»'],
    ['Alteração estruturada', 'O modelo devolve JSON validado; não calcula nada.'],
    ['Otimizador', 'CP-SAT e VRP recalculam o cenário.'],
    ['Verificador', 'Rejeita qualquer número que não exista no resultado.'],
  ];
  flow.forEach(([t, d], i) => {
    const y = 2.3 + i * 1.13;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y, w: 6.2, h: 0.92, rectRadius: 0.1, fill: { color: '1B2A25' }, line: { color: '2F4A40', width: 0.75 }, objectName: `Etapa ${i + 1}` });
    s.addText(String(i + 1), { x: M + 0.22, y: y + 0.2, w: 0.5, h: 0.5, fontFace: THEME.headFontFace, fontSize: 26, color: C.accent2, margin: 0, valign: 'middle', isTextBox: true });
    s.addText([{ text: t, options: { bold: true, color: C.background1, breakLine: true } }, { text: d, options: { color: C.accent5, fontSize: 12 } }], { x: M + 0.85, y: y + 0.12, w: 5.2, h: 0.75, fontFace: THEME.bodyFontFace, fontSize: 15, margin: 0, valign: 'middle', isTextBox: true, objectName: `Texto etapa ${i + 1}` });
  });
  const { w, h } = fit('copilot-panel.png', 5.3, 4.45);
  image(s, 'copilot-panel.png', { x: W - M - w, y: 2.3, w, h, name: 'Troca real com o copiloto' });
  source(s, 'Troca real na stack de dev com OpenRouter (22 out 2026); números dos cartões calculados pelo otimizador. Sem IA, o simulador e o relatório continuam a funcionar.', true);
  s.addNotes(
    '«O decisor pergunta como falaria a um colega. A IA só traduz a pergunta num pedido estruturado; quem faz as contas é o otimizador, e um verificador recusa qualquer número que não esteja no resultado.»\n' +
      'Perguntas prováveis: «e se a IA se engana?» (o verificador recusa a resposta); «e se a IA falha?» (tudo o resto funciona sem IA).',
  );
}

// 11. Critérios --------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch (5 minutos)' });
  s.addText('OS CRITÉRIOS DO JÚRI', { placeholder: 'eyebrow' });
  s.addText('Cada critério, com a sua prova', { placeholder: 'title' });
  const rows = [
    ['30%', 'Impacto e relevância', '+396,5 t por ano fora do lixo, 235,6 t reutilizáveis; captura de 11,5% para cerca de 27%; cobertura de todo o território, não só onde rende (estimativas).'],
    ['25%', 'Inovação e originalidade', 'Uma rede sem contentores, sobre os circuitos que já existem; o otimizador decide canal a canal; a IA conduz o modelo e um verificador impede-a de inventar números.'],
    ['25%', 'Viabilidade técnica', 'Em produção com os dados reais da Vitrus; zero viaturas e contentores novos; pressupostos visíveis; incerteza calculada; testes automáticos em cada entrega.'],
    ['20%', 'Apresentação e continuidade', 'Piloto de 3 meses em duas freguesias, escolhidas pelo Novelo; replicável em qualquer município com o seu inventário de contentores.'],
  ];
  rows.forEach(([w8, name, proof], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * 6.15;
    const y = 2.3 + row * 2.2;
    card(s, { x, y, w: 5.95, h: 2.0, name: `Critério ${name}` });
    s.addText(w8, { x: x + 0.25, y: y + 0.2, w: 1.55, h: 0.9, fontFace: THEME.headFontFace, fontSize: 40, color: C.accent1, margin: 0, valign: 'top', isTextBox: true, objectName: `Peso ${name}` });
    s.addText([{ text: name, options: { bold: true, color: C.text1, fontSize: 15, breakLine: true } }, { text: proof, options: { color: C.accent4, fontSize: 12 } }], { x: x + 1.8, y: y + 0.22, w: 3.95, h: 1.65, fontFace: THEME.bodyFontFace, margin: 0, valign: 'top', paraSpaceAfter: 4, isTextBox: true, objectName: `Prova ${name}` });
  });
  source(s, 'Pesos: Hack4Guimarães 2035, critérios de avaliação. Provas na app em novelo.helder.si e no código aberto.');
  s.addNotes('Diapositivo de transição para o pedido. Se o júri quiser a prova de um critério, abrir a app nesse ecrã.');
}

// 12. Pedido -----------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Pitch (5 minutos)' });
  s.addText('O PRÓXIMO PASSO', { placeholder: 'eyebrow' });
  s.addText('Pedimos um piloto de 3 meses em duas freguesias', { placeholder: 'title' });
  const steps = [
    ['O Novelo escolhe as duas freguesias', 'Para aprender o máximo pelo menor custo: contraste urbano e rural, densidade, circuitos porta a porta e custo de arranque.'],
    ['Mede contra o previsto', 'Toneladas, €/t e rejeito. Para a medição valer, pelo menos 1,71 t em 3 meses (tamanho da amostra).'],
    ['Troca pressupostos por dados', 'Cada lote triado calibra as taxas de captura; o modelo fica com números medidos.'],
    ['Escala', 'A obrigação é a mesma em todos os municípios; o Novelo usa os dados abertos de cada concelho.'],
  ];
  steps.forEach(([t, d], i) => {
    const y = 2.3 + i * 1.1;
    s.addText(String(i + 1), { shape: pres.shapes.OVAL, x: M, y, w: 0.46, h: 0.46, fill: { color: C.accent2 }, color: C.text2, fontFace: THEME.bodyFontFace, fontSize: 14, bold: true, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: `Passo piloto ${i + 1}` });
    s.addText([{ text: t, options: { fontFace: THEME.headFontFace, fontSize: 18, color: C.background1, breakLine: true } }, { text: d, options: { fontSize: 12, color: C.accent5 } }], { x: M + 0.65, y: y - 0.05, w: 7.2, h: 1.0, fontFace: THEME.bodyFontFace, margin: 0, valign: 'top', paraSpaceAfter: 3, isTextBox: true, objectName: `Texto piloto ${i + 1}` });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 9.3, y: 2.3, w: 3.43, h: 4.35, rectRadius: 0.12, fill: { color: C.background1 }, line: { type: 'none' }, objectName: 'Cartão QR' });
  s.addImage({ path: A('qr-novelo.png'), x: 9.6, y: 2.55, w: 2.83, h: 2.83, objectName: 'QR novelo.helder.si', altText: 'Código QR para novelo.helder.si' });
  s.addText([{ text: 'Experimentem já', options: { fontFace: THEME.headFontFace, fontSize: 18, color: C.text1, breakLine: true } }, { text: 'novelo.helder.si', options: { fontSize: 13, bold: true, color: C.accent1 } }], { x: 9.5, y: 5.5, w: 3.03, h: 0.95, fontFace: THEME.bodyFontFace, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: 'Endereço' });
  source(s, 'Proposta da equipa; tamanho da amostra calculado pelo recomendador de piloto do Novelo (estimativa).', true);
  s.addNotes(
    'Frase-âncora antes do pedido: «396 toneladas por ano a 121 € por tonelada, sem um único contentor novo.»\n' +
      '«Pedimos um piloto de três meses em duas freguesias, escolhidas pelo próprio Novelo, para trocar os pressupostos por números medidos.» Agradecer e parar.',
  );
}

// ================================================================================================ APOIO
pres.addSection({ title: 'Apoio (perguntas do júri)' });

// 13. Provar ---------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Apoio (perguntas do júri)' });
  s.addText('PROVAR', { placeholder: 'eyebrow' });
  s.addText('A cobertura que a diretiva exige, e a incerteza à vista', { placeholder: 'title' });
  const a = fit('cobertura.png', 5.9, 4.0);
  image(s, 'cobertura.png', { x: M, y: 2.3, w: a.w, h: a.h, name: 'Separador Cobertura' });
  const b = fit('incerteza.png', 5.6, 4.0);
  image(s, 'incerteza.png', { x: W - M - b.w, y: 2.3, w: b.w, h: b.h, name: 'Separador Incerteza' });
  body(s, [{ text: '76,0% contra 68,8%: ', options: { bold: true, color: C.text1 } }, { text: 'população servida dentro e fora das freguesias predominantemente urbanas (art. 22.º-C, n.º 9, b); estimativa).' }], { x: M, y: 2.3 + a.h + 0.25, w: 5.9, h: 0.6, fontSize: 13 });
  body(s, [{ text: '96,9 a 154,7 €/t: ', options: { bold: true, color: C.text1 } }, { text: 'em 8 de cada 10 de 500 simulações; o tornado mostra que pressuposto pesa mais.' }], { x: W - M - b.w, y: 2.3 + b.h + 0.25, w: b.w, h: 0.6, fontSize: 13 });
  s.addNotes('Para a pergunta «e se os pressupostos estiverem errados?» e «a rede só serve as zonas fáceis?». Os custos unitários da Vitrus ainda não chegaram: a incerteza é um resultado, não uma nota de rodapé.');
}

// 14. Operar e prestar contas -------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Apoio (perguntas do júri)' });
  s.addText('OPERAR E PRESTAR CONTAS', { placeholder: 'eyebrow' });
  s.addText('Do saco ao lote com passaporte, e o relatório RAP num clique', { placeholder: 'title' });
  const l = fit('lote.png', 4.5, 3.4);
  image(s, 'lote.png', { x: M, y: 2.3, w: l.w, h: l.h, name: 'Lote com QR' });
  const p = fit('m-passport.png', 1.6, 3.4);
  image(s, 'm-passport.png', { x: M + l.w + 0.25, y: 2.3, w: p.w, h: p.h, name: 'Passaporte público no telemóvel' });
  ['p-1.png', 'p-2.png', 'p-3.png'].forEach((f, i) => {
    const r = fit(f, 1.95, 2.75);
    image(s, f, { x: 7.35 + i * 1.85, y: 2.3 + (i === 1 ? 0 : 0.15), w: r.w, h: r.h, name: `Relatório RAP, página ${i + 1}` });
  });
  body(s, 'Triagem por foto (estado, fibra, marca) confirmada pelo operador; lote com QR e passaporte público, com quase os campos que a diretiva pede por fardo exportado (art. 22.º-D, n.º 9).', { x: M, y: 5.95, w: 6.3, h: 0.9, fontSize: 13 });
  body(s, 'Relatório RAP: custo por tipo de território (INE), material por destino, marcas e as fontes de cada número.', { x: 7.35, y: 5.95, w: W - M - 7.35, h: 0.9, fontSize: 13 });
  s.addNotes('A indústria do Vale do Ave tem capacidade; faltam lotes limpos e rastreáveis. A foto não vê a fibra: a etiqueta sim, e o operador confirma.');
}

// 15. Rigor ---------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Apoio (perguntas do júri)' });
  s.addText('RIGOR', { placeholder: 'eyebrow' });
  s.addText('Nenhum número sem fonte', { placeholder: 'title' });
  const rows = [
    ['301,3 t recolhidas em 2025 e destino (59,4 / 26,5 / 14,1%)', 'Vitrus Ambiente', 'Dado'],
    ['43 051 t de RSU em 2025 e 5,4% de têxtil', 'Vitrus Ambiente (21 out 2026); APA', 'Dado; 2 324,8 t é estimativa'],
    ['40 circuitos, 29 viaturas, 101 turnos, 82 localidades', 'Vitrus Ambiente', 'Dado'],
    ['2 751 contentores municipais em 2 026 locais', 'Vitrus Ambiente (pacote QGIS)', 'Dado'],
    ['População e tipologia de cada freguesia', 'INE; CAOP 2019 (DGT)', 'Dado'],
    ['Custos por recolha e por km, captura por canal', 'Pressupostos da equipa, visíveis no ecrã', 'Por validar com a Vitrus'],
  ];
  const head = (t) => ({ text: t, options: { bold: true, fontSize: 11, charSpacing: 2, color: C.accent1, fill: { color: 'ECE7DC' } } });
  s.addTable([[head('DADO'), head('FONTE'), head('ESTADO')], ...rows.map((r) => r.map((t, i) => ({ text: t, options: { color: i === 2 ? C.accent1 : C.text1, bold: i === 2 } })))], {
    x: M, y: 2.3, w: W - 2 * M, colW: [5.6, 3.9, 2.63], fontFace: THEME.bodyFontFace, fontSize: 12, border: { type: 'solid', pt: 0.75, color: HEX.linha }, fill: { color: 'FBF9F4' }, margin: [0.08, 0.16, 0.08, 0.16], valign: 'middle', rowH: 0.46, objectName: 'Fontes',
  });
  body(s, 'A procura é conservadora: as 43 051 t da Vitrus são 84,0% do indiferenciado do concelho (Relatório e Contas 2025 da Vitrus, p. 8). Todo o valor estimado leva a palavra «estimativa» no ecrã, e os pressupostos mudam-se no ecrã com recálculo imediato.', { x: M, y: 6.15, w: W - 2 * M, h: 0.8, fontSize: 12 });
  s.addNotes('O que ainda não sabemos, dizemo-lo: o custo por km da Vitrus, se o saco pode ir no camião compactador, e quanto se poupa no tratamento de cada tonelada que sai do lixo.');
}

// 16. Como foi feito ---------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Apoio (perguntas do júri)' });
  s.addText('COMO FOI FEITO', { placeholder: 'eyebrow' });
  s.addText('Em produção, com código aberto e testes em cada entrega', { placeholder: 'title' });
  const cols = [
    ['Web', 'React, Vite, TanStack Router e Query, Tailwind v4, shadcn/ui. Aplicação instalável, pt-PT e inglês, acessibilidade AA, pensada para o telemóvel.'],
    ['API e otimização', 'FastAPI (Python 3.12), PostgreSQL, OR-Tools: CP-SAT para a localização, VRP para as rotas. Contrato OpenAPI com o cliente TypeScript gerado.'],
    ['IA identificada e limitada', 'Copiloto e triagem via OpenRouter, com JSON validado e verificador de números. Desenvolvido com Claude Code e GLM (Z.ai) como assistentes de programação.'],
  ];
  cols.forEach(([t, d], i) => {
    const x = M + i * 4.1;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.35, w: 3.9, h: 2.55, rectRadius: 0.1, fill: { color: '1B2A25' }, line: { color: '2F4A40', width: 0.75 }, objectName: `Bloco ${t}` });
    s.addText([{ text: t, options: { fontFace: THEME.headFontFace, fontSize: 20, color: C.accent2, breakLine: true } }, { text: d, options: { fontSize: 13, color: C.accent5 } }], { x: x + 0.25, y: 2.55, w: 3.4, h: 2.25, fontFace: THEME.bodyFontFace, margin: 0, valign: 'top', paraSpaceAfter: 8, isTextBox: true, objectName: `Texto ${t}` });
  });
  [[TESTS.api, 'testes da API'], [TESTS.web, 'testes da web'], [TESTS.evals, 'perguntas de avaliação ao copiloto, 100% dos números verificados']].forEach(([v, l], i) => {
    s.addText([{ text: v, options: { fontFace: THEME.headFontFace, fontSize: 30, color: C.accent2 } }, { text: `  ${l}`, options: { fontSize: 13, color: C.accent5 } }], { x: M + i * 4.1, y: 5.05, w: 3.9, h: 0.95, fontFace: THEME.bodyFontFace, margin: 0, valign: 'middle', isTextBox: true, objectName: `Testes ${l}` });
  });
  s.addText([{ text: 'novelo.helder.si', options: { bold: true, color: C.accent3 } }, { text: '   ·   github.com/helderpgoncalves/novelo', options: { color: C.accent5 } }], { x: M, y: 6.2, w: W - 2 * M, h: 0.45, fontFace: THEME.bodyFontFace, fontSize: 16, margin: 0, isTextBox: true, objectName: 'Ligações' });
  s.addNotes('Se perguntarem pela qualidade: a verificação completa (lint, tipos, testes da API com os limites reais do solver, testes da web, marca e contrato) corre antes de cada entrega, e há testes de ponta a ponta no browser.');
}

// 17. Vídeo -------------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Apoio (perguntas do júri)' });
  s.addText('PLANO B', { placeholder: 'eyebrow' });
  s.addText('O Novelo em dois minutos', { placeholder: 'title' });
  const video = path.join(__dirname, 'assets', 'novelo-16x9-deck.mp4');
  if (fs.existsSync(video)) {
    const vw = 8.6;
    s.addMedia({ type: 'video', path: video, cover: `data:image/png;base64,${fs.readFileSync(A('video-capa.png')).toString('base64')}`, x: (W - vw) / 2, y: 2.25, w: vw, h: (vw * 9) / 16, objectName: 'Vídeo do Novelo' });
  }
  s.addNotes('Se a demo ao vivo falhar (rede, API), passar este vídeo e o PDF RAP pré-gerado.');
}

(async () => {
  const file = path.join(OUT, 'novelo-pitch.pptx');
  await pres.writeFile({ fileName: file });
  await applyTheme(file, THEME);
  console.log(file);
})();
