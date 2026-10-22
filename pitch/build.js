// Deck do pitch do Novelo (Hack4Guimarães 2035, Desafio 5 TexVitrus). Corre com: node assets.js && node build.js
// Todos os números vêm dos dados da Vitrus, do otimizador (cenários de referência de 22 out 2026) ou dos docs
// (docs/projeto/visao-geral.md, apps/web/src/features/landing/facts.ts). Estimativas levam a palavra "estimativa".
const pptxgen = require('pptxgenjs');
const path = require('node:path');
const fs = require('node:fs');
// applyTheme vem da skill de pptx do Claude (PPTX_SKILL aponta para a pasta da skill).
const { applyTheme } = require(path.join(process.env.PPTX_SKILL ?? '', 'scripts/apply_theme.js'));

const A = (f) => path.join(__dirname, 'assets', f);
// Números do cenário de 60 000 €/ano, da curva, da cobertura, do Monte Carlo e do piloto: tirados da API de dev por
// video/scripts/prepare-numbers.mjs (o vídeo usa o mesmo ficheiro). Nada escrito à mão.
const NUM = require('../video/src/data/numbers.json');
const K = NUM.scenario60.kpis;
const MC = NUM.sensitivity.eur_per_tonne;
const MODE = Object.fromEntries(NUM.scenario60.modes.map((m) => [m.mode, m]));
const GENERATED_T = K.potential_t + K.baseline_observed_t;
const CAPTURE_AFTER = ((K.baseline_observed_t + K.tonnes_year) / GENERATED_T) * 100;
const coverShare = (urban) => {
  const ps = NUM.coverage.parishes.filter((p) => (p.tipau === 'apu') === urban);
  return (ps.reduce((a, p) => a + p.covered_population, 0) / ps.reduce((a, p) => a + p.population, 0)) * 100;
};
const n = (v, d = 0) => {
  const [i, f] = Math.abs(v).toFixed(d).split('.');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return `${v < 0 ? '−' : ''}${f ? `${g},${f}` : g}`;
};
const PILOT_NAMES = NUM.pilot.zones.map((z) => z.parish_name.replace('União das freguesias de ', '')).join(' e ');
const OUT = path.join(__dirname, 'out');
// Guião: cada diapositivo do pitch tem o tempo, a fala e uma nota de palco; vai para as notas do orador e para
// docs/projeto/guiao-do-pitch.md (gerado, para ensaiar).
const GUIAO = [];
function talk(slide, { time, title, say, cue }) {
  slide.addNotes(`[${time}] ${say}${cue ? `\n\nPalco: ${cue}` : ''}`);
  GUIAO.push({ time, title, say, cue });
}
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
const TESTS = { api: '1 054', web: '432', evals: '155' };

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
pres.addSection({ title: 'Pitch' });

// 1. Capa ------------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CAPA', sectionTitle: 'Pitch' });
  s.addText('HACK4GUIMARÃES 2035 · DESAFIO 5 TEXVITRUS', { x: M + 0.13, y: 0.6, w: 8, h: 0.3, fontFace: THEME.bodyFontFace, fontSize: 11, bold: true, charSpacing: 3, color: C.accent2, margin: 0, isTextBox: true, objectName: 'Desafio' });
  s.addText('Do saco ao fio', { x: M + 0.13, y: 4.55, w: 6.5, h: 0.7, fontFace: THEME.headFontFace, fontSize: 30, color: C.background1, margin: 0, isTextBox: true, objectName: 'Frase' });
  s.addText('Hélder Gonçalves · Flávio Fernandes  ·  novelo.helder.si', { x: M + 0.13, y: 6.6, w: 8, h: 0.3, fontFace: THEME.bodyFontFace, fontSize: 12, color: C.accent5, margin: 0, isTextBox: true, objectName: 'Equipa' });
  talk(s, {
    time: '0:00–0:15',
    title: 'Capa',
    say: 'Em Guimarães, mais de nove em cada dez quilos de têxtil que deitamos fora acabam no lixo comum. Somos o Novelo: desenhamos a recolha que os traz de volta, do saco ao fio, ao menor custo.',
    cue: 'Começar logo pelo número, sem apresentações. Os nomes estão na capa.',
  });
}

// 2. Problema ------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch' });
  s.addText('O PROBLEMA', { placeholder: 'eyebrow' });
  s.addText('Mais de 9 em cada 10 quilos de têxtil acabam no lixo', { placeholder: 'title' });
  s.addText('3 003,3 t', { x: M, y: 2.35, w: 6, h: 1.3, fontFace: THEME.headFontFace, fontSize: 88, color: C.accent1, margin: 0, valign: 'bottom', isTextBox: true, objectName: 'Número principal' });
  body(s, 'de têxtil por ano no lixo indiferenciado: cerca de 51 250 t de indiferenciado no concelho em 2025 × 5,86% de têxtil (APA).', { x: M, y: 3.75, w: 5.6, h: 0.8, fontSize: 16, color: C.text1 });
  estimate(s, M, 4.65);
  stat(s, { x: M, y: 5.2, w: 2.6, value: '301,3 t', label: 'recolhidas à parte em 2025, por 4 entidades', size: 30 });
  stat(s, { x: M + 2.9, y: 5.2, w: 2.6, value: '9,1%', label: 'do têxtil gerado chega à recolha seletiva (estimativa)', size: 30, color: C.accent1 });
  // 200 pontos: 18 recolhidos à parte (9,1%), 182 no lixo. Cada ponto ≈ 16,5 t.
  const cols = 20;
  const cell = 0.305;
  const x0 = 6.75;
  const y0 = 2.45;
  for (let i = 0; i < 200; i++) {
    const cx = x0 + (i % cols) * cell;
    const cy = y0 + Math.floor(i / cols) * cell;
    s.addShape(pres.shapes.OVAL, { x: cx, y: cy, w: cell * 0.74, h: cell * 0.74, fill: { color: i < 18 ? C.accent1 : C.text1, transparency: i < 18 ? 0 : 10 }, line: { type: 'none' }, objectName: `Ponto ${i + 1}` });
  }
  s.addShape(pres.shapes.OVAL, { x: x0, y: y0 + 10 * cell + 0.15, w: 0.17, h: 0.17, fill: { color: C.accent1 }, line: { type: 'none' }, objectName: 'Legenda recolhido' });
  body(s, 'recolhido à parte', { x: x0 + 0.25, y: y0 + 10 * cell + 0.1, w: 1.8, h: 0.3, fontSize: 12 });
  s.addShape(pres.shapes.OVAL, { x: x0 + 2.2, y: y0 + 10 * cell + 0.15, w: 0.17, h: 0.17, fill: { color: C.text1 }, line: { type: 'none' }, objectName: 'Legenda lixo' });
  body(s, 'no lixo indiferenciado (cada ponto ≈ 16,5 t)', { x: x0 + 2.45, y: y0 + 10 * cell + 0.1, w: 3.6, h: 0.3, fontSize: 12 });
  source(s, 'Vitrus, R&C 2025, p. 8 (43 050,5 t = 84,0% do indiferenciado do concelho) e têxtil recolhido em 2025; APA, RARU 2025, p. 24 (5,86%). Captura = 301,3 ÷ (3 003,3 + 301,3) t.');
  talk(s, {
    time: '0:15–0:40',
    title: 'O problema',
    say: `Em 2025, o concelho deitou cerca de 51 mil toneladas ao lixo indiferenciado. Segundo a APA, 5,86% é têxtil: perto de ${n(K.potential_t)} toneladas por ano a caminho do aterro. Recolhidas à parte, só 301. Hoje, 9,1%. O resto perde-se.`,
    cue: 'Dizer «estimativa» uma vez. Base confirmada pela Vitrus a 22 de outubro: 5,86% da APA sobre o indiferenciado do concelho.',
  });
}

// 3. Valor na reutilização --------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch' });
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
  talk(s, {
    time: '0:40–0:55',
    title: 'O que interessa',
    say: 'E o que se recolhe vale pela reutilização: 59% volta a ser usado. Mas depende de como se recolhe: 73% numa entidade, 9% noutra, com mais de metade de rejeito. Têxtil limpo e seco é o que tem valor.',
    cue: 'Apontar para a barra da Vitrus: 56,9% de rejeito.',
  });
}

// 4. Lei -----------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch' });
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
  talk(s, {
    time: '0:55–1:20',
    title: 'A lei',
    say: 'A recolha seletiva de têxteis é obrigatória desde janeiro de 2025, e hoje paga-a o município. A diretiva europeia põe os produtores a pagar até 2028, mas só as peças novas e só o custo eficiente, fixado com as autoridades locais. Quem chegar a essa mesa sem saber quanto custa cada tonelada não tem como defender o seu número.',
    cue: 'Não dizer que em 2028 os produtores pagam tudo: o têxtil que já está nas casas continua a pesar no município.',
  });
}

// 6. Ouvimos a Vitrus --------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch' });
  s.addText('21 E 22 DE OUTUBRO', { placeholder: 'eyebrow' });
  s.addText('Ouvimos a Vitrus e refizemos o modelo, duas vezes', { placeholder: 'title' });
  const rows = [
    ['Não tem contentores de têxtil e não os quer: o têxtil de contentor vem contaminado', 'A rede deixou de ter contentores de têxtil'],
    ['O saco estraga-se na caixa compactadora; a solução é um meio novo de recolha', 'Uma viatura só para o têxtil, sem compactação'],
    ['Não há viaturas livres à tarde', 'Saiu o plano B das viaturas paradas'],
    ['Usem 5,86% (APA) sobre o indiferenciado do concelho', 'A procura passou a 3 003,3 t por ano (estimativa)'],
    ['Aterro: 40 €/t de TGR + 65,64 €/t da Resinorte', 'Cada tonelada desviada poupa 105,64 €'],
  ];
  const head = (t) => ({ text: t, options: { bold: true, fontSize: 11, charSpacing: 2, color: C.accent1, fill: { color: 'ECE7DC' } } });
  s.addTable(
    [[head('A VITRUS DISSE'), head('O QUE MUDOU NO NOVELO')], ...rows.map(([a, b]) => [{ text: a, options: { color: C.text1 } }, { text: b, options: { color: C.text1, bold: true } }])],
    { x: M, y: 2.3, w: 8.6, colW: [4.6, 4.0], fontFace: THEME.bodyFontFace, fontSize: 14, border: { type: 'solid', pt: 0.75, color: HEX.linha }, fill: { color: 'FBF9F4' }, margin: [0.12, 0.16, 0.12, 0.16], valign: 'middle', rowH: [0.42, 0.72, 0.72, 0.6, 0.72, 0.6], fontSize: 13, objectName: 'O que mudou' },
  );
  s.addText('24 h', { x: 9.7, y: 2.35, w: 3.0, h: 1.5, fontFace: THEME.headFontFace, fontSize: 96, color: C.accent1, margin: 0, align: 'center', valign: 'middle', isTextBox: true, objectName: '24 horas' });
  body(s, 'Cada resposta da Vitrus entrou no modelo no próprio dia: sem contentores, com uma viatura dedicada.', { x: 9.75, y: 4.0, w: 2.9, h: 1.2, fontSize: 15, color: C.text1, align: 'center' });
  source(s, 'Emails do mentor da Vitrus, 21 e 22 out 2026; registo de alterações do repositório.');
  talk(s, {
    time: '1:20–1:40',
    title: 'Ouvimos a Vitrus',
    say: 'Fomos ouvir a Vitrus. Disse-nos duas coisas. Contentores de têxtil, não: o têxtil chega contaminado. E o saco também não pode ir no camião do lixo: estraga-se na compactadora. De cada vez, refizemos o modelo no próprio dia.',
    cue: 'Ritmo: duas respostas, uma pausa, «no próprio dia».',
  });
}

// 7. A rede -------------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Pitch' });
  s.addText('A RESPOSTA', { placeholder: 'eyebrow' });
  s.addText('Uma rede sem contentores, com uma viatura só para o têxtil', { placeholder: 'title' });
  const { w, h } = fit('mapa-rede.png', 5.6, 5.4);
  s.addImage({ path: A('mapa-rede.png'), x: W - M - w + 0.1, y: 7.5 - h - 0.5, w, h, objectName: 'Mapa da rede', altText: 'Mapa do cenário de 60 000 euros por ano: rotas da viatura de têxtil a partir de Polvoreira, freguesias com paragens em locais existentes e com saco à porta, escolas' });
  const items = [
    { n: '1', color: C.background1, title: 'Uma viatura só para o têxtil, sem compactação', text: `O meio novo de recolha que a Vitrus pede: ${K.vehicles} viatura, ${n(K.vehicle_days_week, 1)} dias por semana, ${n(K.km_year)} km/ano a partir do estaleiro de Polvoreira.` },
    { n: '2', color: C.accent2, title: 'Paragem nos locais por onde já se passa', text: `${MODE.existing.points} pontos em ${MODE.existing.zones} freguesias, sem contentor novo: ${n(MODE.existing.tonnes, 1)} t/ano.` },
    { n: '3', color: C.accent3, title: 'Saco fechado à porta, num dia fixo', text: `Onde compensa: ${MODE.on_demand.zones} freguesias, de 2 em 2 semanas, ${n(MODE.on_demand.tonnes, 1)} t/ano.` },
    { n: '4', color: C.accent4, title: 'Escolas como pontos com pessoas', text: '86 escolas candidatas: o saco é entregue em mão.' },
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
  source(s, 'Cenário de referência por freguesia, 60 000 €/ano (otimizador Novelo, 22 out 2026, estimativa); depósito e respostas da Vitrus de 22 out 2026; INE; CAOP 2019.', true);
  talk(s, {
    time: '1:40–2:05',
    title: 'A resposta',
    say: `A resposta: uma rede sem um único contentor novo, com uma viatura só para o têxtil, sem compactação. Para nos locais por onde já se passa, ${MODE.existing.points} pontos em ${MODE.existing.zones} freguesias; recolhe o saco fechado à porta onde compensa; e usa as escolas como pontos com pessoas. Sai do estaleiro da Vitrus em Polvoreira.`,
    cue: 'Preço da viatura, se perguntarem: 42 500 € sem IVA, pressuposto tirado de um concurso público (Vila Nova de Gaia, TED 338951-2024), a 8 anos.',
  });
}

// 8. Resultado -------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch' });
  s.addText('O RESULTADO · 60 000 €/ANO', { placeholder: 'eyebrow' });
  s.addText(`${n(K.tonnes_year, 1)} t por ano fora do lixo, a ${n(K.annual_cost_eur / K.tonnes_year, 1)} €/t, sem um único contentor novo`, { placeholder: 'title' });
  const tiles = [
    { v: `${n(K.tonnes_year, 1)} t`, l: 'desviadas do lixo por ano', hero: true },
    { v: `${n(K.annual_cost_eur / K.tonnes_year, 1)} €/t`, l: `custo por tonelada (P10 a P90: ${n(MC.p10, 1)} a ${n(MC.p90, 1)})` },
    { v: `${n(K.reusable_t, 1)} t`, l: `reutilizáveis (${n(K.reusable_t_low)} a ${n(K.reusable_t_high)} t)` },
    { v: `${K.vehicles} viatura`, l: `nova, só para o têxtil: ${n(K.vehicle_capex_eur)} € (pressuposto)` },
  ];
  const tw = 2.85;
  tiles.forEach((t, i) => {
    const x = M + i * (tw + 0.2);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.3, w: tw, h: 1.25, rectRadius: 0.1, fill: { color: t.hero ? C.accent1 : 'FBF9F4' }, line: { color: t.hero ? C.accent1 : C.accent5, width: 0.75 }, objectName: `Cartão ${t.v}` });
    s.addText(t.v, { x: x + 0.2, y: 2.38, w: tw - 0.4, h: 0.65, fontFace: THEME.headFontFace, fontSize: 30, color: t.hero ? C.background1 : C.text1, margin: 0, valign: 'bottom', isTextBox: true, objectName: `Valor ${t.v}` });
    s.addText(t.l, { x: x + 0.2, y: 3.05, w: tw - 0.4, h: 0.42, fontFace: THEME.bodyFontFace, fontSize: 11, color: t.hero ? C.background1 : C.accent4, margin: 0, valign: 'top', isTextBox: true, objectName: `Legenda ${t.v}` });
  });
  estimate(s, W - M - 1.05, 0.55);
  // curva custo por tonelada (cenários por freguesia a vários orçamentos)
  s.addChart(
    pres.charts.LINE,
    [{ name: '€ por tonelada', labels: NUM.curve.map((p) => `${n(p.budget / 1000)} mil €\n${n(p.tonnes)} t · ${n(p.eurPerT, 1)} €/t`), values: NUM.curve.map((p) => Math.round(p.eurPerT * 10) / 10) }],
    {
      x: M, y: 3.85, w: 7.0, h: 2.9, chartColors: [HEX.floresta], lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 10,
      catAxisLabelColor: HEX.tinta, catAxisLabelFontSize: 10, catAxisLabelFontFace: '+mn-lt', valAxisLabelColor: HEX.pedra, valAxisLabelFontSize: 10, valAxisLabelFontFace: '+mn-lt',
      valAxisMinVal: 0, valAxisMaxVal: 200, valAxisMajorUnit: 50, valGridLine: { color: HEX.linha, size: 0.75 }, catGridLine: { style: 'none' },
      showValue: false, showLegend: false, showTitle: true, title: 'Custo por tonelada (€/t) a cada orçamento anual', titleFontSize: 12, titleColor: HEX.tinta, titleFontFace: '+mn-lt',
      objectName: 'Curva de custo',
    },
  );
  card(s, { x: 7.9, y: 3.85, w: W - M - 7.9, h: 2.9, name: 'Poupança no tratamento' });
  s.addText('A poupança no tratamento paga a operação', { x: 8.15, y: 3.98, w: 4.4, h: 0.4, fontFace: THEME.headFontFace, fontSize: 17, color: C.text1, margin: 0, isTextBox: true, objectName: 'Título poupança' });
  const maxV = Math.max(K.annual_cost_eur, K.avoided_treatment_eur);
  [
    ['Custo anual da rede', K.annual_cost_eur, C.accent4],
    ['Tratamento evitado', K.avoided_treatment_eur, C.accent1],
  ].forEach(([label, v, color], i) => {
    const y = 4.5 + i * 0.68;
    s.addText([{ text: label, options: { color: C.text1 } }, { text: `   ${n(v)} €`, options: { bold: true, color: C.text1 } }], { x: 8.15, y, w: 4.4, h: 0.26, fontFace: THEME.bodyFontFace, fontSize: 12, margin: 0, isTextBox: true, objectName: `Etiqueta ${label}` });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.15, y: y + 0.29, w: 4.3 * (v / maxV), h: 0.22, rectRadius: 0.5, fill: { color }, line: { type: 'none' }, objectName: `Barra ${label}` });
  });
  body(s, `Custo líquido: ${n(K.net_annual_cost_eur)} €/ano. Tratamento: ${n(K.tonnes_year, 1)} t × 105,64 €/t (Vitrus). Captura do têxtil gerado: de 9,1% para ${n(CAPTURE_AFTER, 1)}%.`, { x: 8.15, y: 5.95, w: 4.45, h: 0.75, fontSize: 11, color: C.text1 });
  source(s, 'Otimizador Novelo (OR-Tools CP-SAT e VRP) sobre os dados da Vitrus; cenários por freguesia de 22 out 2026; Monte Carlo com 500 amostras; tratamento: Vitrus (40 €/t TGR + 65,64 €/t Resinorte).');
  talk(s, {
    time: '2:05–2:35',
    title: 'O resultado',
    say: `Com 60 mil euros por ano, o otimizador desvia ${n(K.tonnes_year)} toneladas por ano do lixo, a ${n(K.annual_cost_eur / K.tonnes_year)} euros por tonelada; ${n(K.reusable_t)} reutilizáveis. E o ponto é este: cada tonelada que sai do lixo poupa 105,64 euros de aterro. São ${n(K.avoided_treatment_eur)} euros por ano, mais do que custa a operação. A rede paga-se com o que deixa de ir para o aterro.`,
    cue: `Estimativa: os custos por hora e por km da Vitrus ainda não chegaram. Em 8 de cada 10 simulações, entre ${n(MC.p10)} e ${n(MC.p90)} €/t.`,
  });
}

// 9. Demo -------------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch' });
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
  source(s, 'Captura da app com os dados de 22 out 2026. Se a rede falhar: vídeo da demonstração no último anexo.');
  talk(s, {
    time: '2:35–3:50',
    title: 'Demonstração',
    say: 'Isto não é um protótipo: está em produção, com os dados reais da Vitrus. Aqui está o cenário de 60 mil euros: toneladas, euros por tonelada e o mapa. Este é o plano da viatura, freguesia a freguesia. Aqui, a cobertura: a rede não fica só onde rende, como a diretiva exige. E posso perguntar em português: e se o orçamento fosse 80 mil euros?',
    cue: 'Abrir o cenário de referência já calculado (não esperar pelo otimizador). A pergunta dos 80 000 € já foi feita uma vez: a resposta vem em 6 a 10 s. Se a rede falhar, passar o vídeo do último anexo.',
  });
}

// 9b. IA ---------------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Pitch' });
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
  talk(s, {
    time: '3:50–4:05',
    title: 'A IA',
    say: 'A inteligência artificial só traduz a pergunta. Quem faz as contas é o otimizador, e um verificador recusa qualquer número que não venha do resultado. Em 155 perguntas de teste, 100% dos números verificados.',
    cue: 'Sem IA, o simulador, o plano e o relatório continuam a funcionar.',
  });
}

// 10. Do saco ao fio ---------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch' });
  s.addText('DO SACO AO FIO', { placeholder: 'eyebrow' });
  s.addText('Cada quilo com origem, destino e passaporte', { placeholder: 'title' });
  const steps = [
    ['triagem.png', '1 · Triagem por foto', 'A IA sugere fibra, estado e marca a partir da etiqueta; o operador confirma.'],
    ['lote.png', '2 · Lote com QR', 'Composição, peso e histórico de cada lote.'],
    ['m-passport.png', '3 · Passaporte público', 'Quem recebe lê o QR no telemóvel.'],
    ['p-1.png', '4 · Relatório RAP', 'Um PDF para a mesa onde se fixa o custo eficiente.'],
  ].filter(([f]) => fs.existsSync(A(f)));
  const colW = (W - 2 * M - (steps.length - 1) * 0.3) / steps.length;
  steps.forEach(([file, title, text], i) => {
    const x = M + i * (colW + 0.3);
    const r = fit(file, colW, 3.3);
    image(s, file, { x: x + (colW - r.w) / 2, y: 2.3 + (3.3 - r.h) / 2, w: r.w, h: r.h, name: title });
    s.addText([{ text: title, options: { bold: true, color: C.text1, breakLine: true } }, { text, options: { color: C.accent4, fontSize: 12 } }], { x, y: 5.8, w: colW, h: 0.95, fontFace: THEME.bodyFontFace, fontSize: 14, margin: 0, valign: 'top', isTextBox: true, objectName: `Passo ${title}` });
  });
  talk(s, {
    time: '4:05–4:20',
    title: 'Do saco ao fio',
    say: 'Na entrega, uma foto da etiqueta sugere a fibra e o estado, e o operador confirma. Cada lote leva um QR com o seu passaporte. E a câmara recebe, num clique, o relatório para a mesa da responsabilidade do produtor.',
    cue: 'A foto não vê a fibra; a etiqueta sim. O operador confirma sempre.',
  });
}

// 11. O que já está provado ---------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Pitch' });
  s.addText('EM RESUMO', { placeholder: 'eyebrow' });
  s.addText('O que já está provado', { placeholder: 'title' });
  const rows = [
    ['Impacto', `${n(K.tonnes_year, 1)} t por ano fora do lixo e ${n(K.reusable_t, 1)} t reutilizáveis; a poupança no tratamento (${n(K.avoided_treatment_eur)} €) paga a operação; captura de 9,1% para ${n(CAPTURE_AFTER, 1)}% (estimativas).`],
    ['Inovação', 'Uma rede sem contentores, com uma viatura só para o têxtil, desenhada canal a canal por um otimizador. IA que conduz o modelo e nunca inventa um número.'],
    ['Viabilidade', `Em produção, com os dados e as respostas da Vitrus. Pressupostos à vista, incerteza calculada, ${TESTS.api} testes da API e ${TESTS.web} da web em cada entrega.`],
    ['Continuidade', 'Um piloto de 3 meses pronto a arrancar, escolhido pelo próprio Novelo. Replicável em qualquer município com o seu inventário de contentores.'],
  ];
  rows.forEach(([name, proof], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * 6.15;
    const y = 2.3 + row * 2.2;
    card(s, { x, y, w: 5.95, h: 2.0, name: `Prova ${name}` });
    s.addText(name, { x: x + 0.3, y: y + 0.22, w: 5.4, h: 0.55, fontFace: THEME.headFontFace, fontSize: 26, color: C.accent1, margin: 0, valign: 'top', isTextBox: true, objectName: `Título ${name}` });
    s.addText(proof, { x: x + 0.3, y: y + 0.85, w: 5.4, h: 1.05, fontFace: THEME.bodyFontFace, fontSize: 13, color: C.text1, margin: 0, valign: 'top', isTextBox: true, objectName: `Texto ${name}` });
  });
  source(s, 'Cenário de referência de 60 000 €/ano (estimativa); verificação completa e avaliação do copiloto de 22 out 2026; novelo.helder.si e código aberto.');
  talk(s, {
    time: '4:20–4:35',
    title: 'O que já está provado',
    say: `Em resumo: ${n(K.tonnes_year)} toneladas por ano fora do lixo, pagas pela poupança no tratamento. Uma rede sem contentores, com IA que não inventa números. Em produção, com os dados e as respostas da Vitrus. E pronta a replicar em qualquer município.`,
  });
}

// 12. Pedido -----------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Pitch' });
  s.addText('O PRÓXIMO PASSO', { placeholder: 'eyebrow' });
  s.addText('Pedimos um piloto de 3 meses em duas freguesias', { placeholder: 'title' });
  const steps = [
    ['O Novelo escolhe as duas freguesias', `Para aprender o máximo pelo menor custo: contraste urbano e rural, densidade e custo de arranque. Hoje sugere ${PILOT_NAMES}.`],
    ['Mede contra o previsto', `Toneladas, €/t e rejeito. Para a medição valer, pelo menos ${n(NUM.pilot.signal_floor.min_tonnes_pilot, 2)} t em 3 meses (tamanho da amostra); previsto: ${n(NUM.pilot.signal_floor.tonnes_pilot, 2)} t.`],
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
  talk(s, {
    time: '4:35–5:00',
    title: 'O pedido',
    say: `Pedimos um piloto de três meses em duas freguesias, escolhidas pelo próprio Novelo, para trocar pressupostos por números medidos. ${n(K.tonnes_year)} toneladas por ano fora do lixo, pagas pela poupança no tratamento, sem um único contentor novo. Obrigado.`,
    cue: 'Dizer a frase-âncora devagar. Agradecer e parar.',
  });
}

// ================================================================================================ ANEXOS
pres.addSection({ title: 'Anexos' });

// 5. Onde se perde ---------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Pitch' });
  s.addText('ONDE SE PERDE', { placeholder: 'eyebrow' });
  s.addText('O têxtil perde-se onde o camião já passa', { placeholder: 'title' });
  const { w, h } = fit('mapa-contentores.png', 6.4, 6.0);
  s.addImage({ path: A('mapa-contentores.png'), x: W - M - w + 0.2, y: 7.5 - h - 0.35, w, h, objectName: 'Mapa dos contentores', altText: 'Mapa de Guimarães com as 48 freguesias e os contentores municipais' });
  stat(s, { x: M, y: 2.35, w: 4, value: '2 751', label: 'contentores municipais de indiferenciado, orgânico e seletivo', dark: true, size: 54 });
  stat(s, { x: M, y: 3.85, w: 4, value: '2 026', label: 'locais por onde a viatura já passa', dark: true, size: 40 });
  stat(s, { x: M, y: 5.0, w: 4, value: '40 · 29', label: 'circuitos e viaturas da Vitrus', dark: true, size: 40 });
  source(s, 'Vitrus Ambiente: pacote QGIS de contentores (20 out 2026; 2 722 com coordenadas no mapa), circuitos e turnos; DGT, CAOP 2019.', true);
  s.addNotes('Anexo. O têxtil perde-se nos 2 751 contentores municipais, onde a viatura da Vitrus já passa todos os dias: o inventário real da Vitrus é a base geográfica do modelo.');
}

// 13. Provar ---------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Anexos' });
  s.addText('PROVAR', { placeholder: 'eyebrow' });
  s.addText('A cobertura que a diretiva exige, e a incerteza à vista', { placeholder: 'title' });
  const a = fit('cobertura.png', 5.9, 4.0);
  image(s, 'cobertura.png', { x: M, y: 2.3, w: a.w, h: a.h, name: 'Separador Cobertura' });
  const b = fit('incerteza.png', 5.6, 4.0);
  image(s, 'incerteza.png', { x: W - M - b.w, y: 2.3, w: b.w, h: b.h, name: 'Separador Incerteza' });
  body(s, [{ text: `${n(coverShare(true), 1)}% contra ${n(coverShare(false), 1)}%: `, options: { bold: true, color: C.text1 } }, { text: 'população servida dentro e fora das freguesias predominantemente urbanas (art. 22.º-C, n.º 9, b); estimativa).' }], { x: M, y: 2.3 + a.h + 0.25, w: 5.9, h: 0.6, fontSize: 13 });
  body(s, [{ text: `${n(MC.p10, 1)} a ${n(MC.p90, 1)} €/t: `, options: { bold: true, color: C.text1 } }, { text: 'em 8 de cada 10 de 500 simulações; o tornado mostra que pressuposto pesa mais.' }], { x: W - M - b.w, y: 2.3 + b.h + 0.25, w: b.w, h: 0.6, fontSize: 13 });
  s.addNotes('Anexo. Para «e se os pressupostos estiverem errados?» e «a rede só serve as zonas fáceis?»: a incerteza é um resultado, e a cobertura segue o art. 22.º-C, n.º 9, b).');
}

// 15. Rigor ---------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'CLARO', sectionTitle: 'Anexos' });
  s.addText('RIGOR', { placeholder: 'eyebrow' });
  s.addText('Nenhum número sem fonte', { placeholder: 'title' });
  const rows = [
    ['301,3 t recolhidas em 2025 e destino (59,4 / 26,5 / 14,1%)', 'Vitrus Ambiente', 'Dado'],
    ['≈ 51 250 t de indiferenciado no concelho e 5,86% de têxtil', 'Vitrus (R&C 2025, p. 8; 22 out 2026); APA (RARU 2025)', 'Dado; 3 003,3 t é estimativa'],
    ['Tratamento em aterro: 105,64 €/t (40 TGR + 65,64 Resinorte)', 'Vitrus Ambiente (22 out 2026)', 'Dado'],
    ['40 circuitos, 29 viaturas, 101 turnos, 82 localidades', 'Vitrus Ambiente', 'Dado'],
    ['2 751 contentores municipais em 2 026 locais', 'Vitrus Ambiente (pacote QGIS)', 'Dado'],
    ['População e tipologia de cada freguesia', 'INE; CAOP 2019 (DGT)', 'Dado'],
    ['Custos por recolha e por km, viatura nova, captura por canal', 'Pressupostos da equipa, visíveis no ecrã', 'Por validar com a Vitrus'],
  ];
  const head = (t) => ({ text: t, options: { bold: true, fontSize: 11, charSpacing: 2, color: C.accent1, fill: { color: 'ECE7DC' } } });
  s.addTable([[head('DADO'), head('FONTE'), head('ESTADO')], ...rows.map((r) => r.map((t, i) => ({ text: t, options: { color: i === 2 ? C.accent1 : C.text1, bold: i === 2 } })))], {
    x: M, y: 2.3, w: W - 2 * M, colW: [5.6, 3.9, 2.63], fontFace: THEME.bodyFontFace, fontSize: 12, border: { type: 'solid', pt: 0.75, color: HEX.linha }, fill: { color: 'FBF9F4' }, margin: [0.08, 0.16, 0.08, 0.16], valign: 'middle', rowH: 0.46, objectName: 'Fontes',
  });
  body(s, 'Todo o valor estimado leva a palavra «estimativa» no ecrã, e os pressupostos mudam-se no ecrã com recálculo imediato. Os custos por hora e por km da Vitrus ainda não chegaram: são pressupostos.', { x: M, y: 6.15, w: W - 2 * M, h: 0.8, fontSize: 12 });
  s.addNotes('Anexo. O que ainda não sabemos, dizemo-lo: o custo por hora e por km das viaturas da Vitrus e o preço final da viatura nova.');
}

// 16. Como foi feito ---------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Anexos' });
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
  s.addNotes('Anexo. A verificação completa (lint, tipos, testes da API com os limites reais do solver, testes da web, marca e contrato) corre antes de cada entrega.');
}

// 17. Vídeo -------------------------------------------------------------------------------------------
{
  const s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Anexos' });
  s.addText('PLANO B', { placeholder: 'eyebrow' });
  s.addText('O Novelo em dois minutos', { placeholder: 'title' });
  const video = path.join(__dirname, 'assets', 'novelo-16x9-deck.mp4');
  if (fs.existsSync(video)) {
    const vw = 8.6;
    s.addMedia({ type: 'video', path: video, cover: `data:image/png;base64,${fs.readFileSync(A('video-capa.png')).toString('base64')}`, x: (W - vw) / 2, y: 2.25, w: vw, h: (vw * 9) / 16, objectName: 'Vídeo do Novelo' });
  }
  s.addNotes('Anexo. Se a demonstração ao vivo falhar (rede, API), passar este vídeo e o PDF RAP pré-gerado.');
}

(async () => {
  const file = path.join(OUT, 'novelo-pitch.pptx');
  await pres.writeFile({ fileName: file });
  await applyTheme(file, THEME);
  const md = [
    '# Guião do pitch',
    '',
    'Gerado por `pitch/build.js` a partir das notas do orador do deck (`node build.js`). Cinco minutos, doze diapositivos; os números vêm da API (cenário de referência de 60 000 €/ano, estimativas).',
    '',
    '| Tempo | Diapositivo | Fala |',
    '| --- | --- | --- |',
    ...GUIAO.map((g) => `| ${g.time} | ${g.title} | ${g.say.replace(/\|/g, '\\|')} |`),
    '',
    '## Notas de palco',
    '',
    ...GUIAO.filter((g) => g.cue).map((g) => `- **${g.title}.** ${g.cue}`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(__dirname, '../docs/projeto/guiao-do-pitch.md'), md);
  console.log(file);
})();
